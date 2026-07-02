#!/usr/bin/env python3
"""
E3 — 用 SiliconFlow (OpenAI 兼容) 给单字题补 example + 校准 pinyin。

输入：data/hanzi-hsk.json
  - 筛 levels.hsk1 里 example=="" 且 modes 含 choose-char-by-pinyin 的单字条目（约 300）。
输出：
  - 原地更新 data/hanzi-hsk.json（先备份 .bak）
  - data/hanzi-hsk.json.fill-report.json（成功/失败/跳过计数 + 失败字列表）

== 配置来源（优先级）==
  1. 环境变量 HFLLM_BASE_URL / HFLLM_MODEL / HFLLM_TOKEN
  2. 项目根 .env（python-dotenv 或手动解析）
  注：token 绝不打印到日志/summary。脚本仅在 Authorization header 内使用。

== 用法 ==
  # 先跑 10 条小批量验证
  python scripts/generators/fill_hanzi_examples.py --limit 10
  # 跑全量
  python scripts/generators/fill_hanzi_examples.py
  # 自定义并发/重试
  python scripts/generators/fill_hanzi_examples.py --workers 4 --retries 3 --sleep 0.5
"""

from __future__ import annotations
import argparse
import json
import os
import re
import sys
import time
import shutil
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

try:
    import requests
except ImportError:
    sys.stderr.write("缺少 requests：pip install requests\n")
    raise

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data" / "hanzi-hsk.json"
REPORT = ROOT / "data" / "hanzi-hsk.json.fill-report.json"
BAK = ROOT / "data" / "hanzi-hsk.json.bak"


def _load_dotenv_manual() -> None:
    """手动解析 .env（无 python-dotenv 时兜底）。优先级低于已存在的环境变量。"""
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


_load_dotenv_manual()

API_URL = os.environ.get("HFLLM_BASE_URL", "").strip()
MODEL = os.environ.get("HFLLM_MODEL", "deepseek-v4-flash").strip()

PROMPT_TMPL = """你是小学语文启蒙老师。给定一个汉字，产出它的标准拼音与一句适合小学低年级的例句。

要求：
1) pinyin：带声调符号的标准拼音（如 shān, hǎo, nǚ, yī）。多音字按【日常最常用读音】给单字读音，不要给词级读音（例如「好」单字应 hǎo，不是 hào）。
2) example：10-20 字的简短中文例句，必须包含目标字【恰好一次】，且目标字前后用 ** 包裹，如「我们一起去爬**山**看日出。」。例句要口语化、积极、适合小学生。
3) 只返回一行严格 JSON，不要 markdown、不要解释。格式：{{"pinyin":"...","example":"..."}}

目标汉字：{ch}"""


# ---------------- 配置 ----------------

def get_config() -> dict:
    """从环境变量（.env 已注入）取 base/model/token。绝不打印 token。"""
    base = os.environ.get("HFLLM_BASE_URL", "").strip()
    model = os.environ.get("HFLLM_MODEL", "").strip() or "deepseek-v4-flash"
    token = os.environ.get("HFLLM_TOKEN", "").strip()
    return {"base": base, "model": model, "token": token}


# ---------------- LLM ----------------

_JSON_RE = re.compile(r"\{[^{}]*\}", re.DOTALL)


def _extract_json(content: str) -> dict | None:
    """从模型输出里抠出首个 JSON 对象。"""
    if not content:
        return None
    # 直接试
    try:
        return json.loads(content.strip())
    except Exception:
        pass
    m = _JSON_RE.search(content)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            return None
    return None


def call_llm(char: str, cfg: dict, retries: int = 2, sleep: float = 0.5) -> dict | None:
    """对单个汉字调一次，返回 {"pinyin","example"} 或 None。失败指数退避重试。"""
    payload = {
        "model": cfg["model"],
        "messages": [{"role": "user", "content": PROMPT_TMPL.format(ch=char)}],
        "temperature": 0.7,
        "max_tokens": 200,
    }
    headers = {
        "Authorization": f"Bearer {cfg['token']}",
        "Content-Type": "application/json",
    }
    last_err = ""
    for attempt in range(retries + 1):
        try:
            resp = requests.post(cfg["base"], headers=headers, json=payload, timeout=60)
            if resp.status_code == 429:
                last_err = "rate_limit_429"
                time.sleep(sleep * (2 ** attempt) + 0.5)
                continue
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            obj = _extract_json(content)
            if obj and "example" in obj and "pinyin" in obj:
                return obj
            last_err = f"bad_json:{content[:60]}"
        except Exception as e:
            last_err = f"{type(e).__name__}:{str(e)[:80]}"
        time.sleep(sleep * (2 ** attempt))
    sys.stderr.write(f"  [{char}] 失败: {last_err[:80]}\n")
    return None


def validate(obj: dict, char: str) -> tuple[str, str, list[str]]:
    """返回 (example, pinyin, issues)。检查目标字恰好出现一次且被**包裹。"""
    issues = []
    ex = str(obj.get("example", "")).strip()
    py = str(obj.get("pinyin", "")).strip()
    if not ex or not py:
        issues.append("空字段")
        return ex, py, issues
    # 目标字包裹检测
    wrapped = f"**{char}**"
    if wrapped not in ex:
        # 是否含目标字
        if char in ex:
            issues.append("含目标字但未用**包裹")
        else:
            issues.append("不含目标字")
    # 目标字在例句中出现的总次数（去掉 ** 后计）
    plain = ex.replace("**", "")
    if plain.count(char) > 1:
        issues.append(f"目标字出现>1次({plain.count(char)})")
    # 长度
    if len(plain) < 8 or len(plain) > 30:
        issues.append(f"长度异常({len(plain)})")
    return ex, py, issues


# ---------------- 主流程 ----------------

def load_data() -> dict:
    with open(DATA, "r", encoding="utf-8") as f:
        return json.load(f)


def save_data(doc: dict) -> None:
    # 备份（仅首次）
    if not BAK.exists():
        shutil.copy2(DATA, BAK)
    with open(DATA, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=2)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="只跑前 N 条（0=全量）")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--retries", type=int, default=2)
    ap.add_argument("--sleep", type=float, default=0.5)
    ap.add_argument("--dry-run", action="store_true", help="只调 API 不写回文件")
    args = ap.parse_args()

    cfg = get_config()
    if not cfg["base"] or not cfg["token"]:
        sys.stderr.write(
            "[阻塞] 未找到配置。请在项目根 .env 设置：\n"
            "  HFLLM_BASE_URL=https://opencode.ai/zen/go/v1/chat/completions\n"
            "  HFLLM_MODEL=deepseek-v4-flash\n"
            "  HFLLM_TOKEN=sk-...\n"
        )
        sys.exit(2)

    doc = load_data()
    items = doc["levels"]["hsk1"]
    # 筛单字题（example 空 + choose-char-by-pinyin）
    targets = [it for it in items if not it.get("example") and "choose-char-by-pinyin" in it.get("modes", [])]
    total = len(targets)
    print(f"[info] 模型={cfg['model']} 候选单字={total} workers={args.workers} retries={args.retries}")

    if args.limit > 0:
        targets = targets[: args.limit]
        print(f"[info] 小批量模式：仅前 {len(targets)} 条")

    # 索引回写
    success, failed, skipped = 0, 0, 0
    fail_list, sample = [], []
    t0 = time.time()

    def worker(it):
        ch = it["char"]
        obj = call_llm(ch, cfg, retries=args.retries, sleep=args.sleep)
        if obj is None:
            return it, None, ["llm_failed"]
        ex, py, issues = validate(obj, ch)
        return it, {"example": ex, "pinyin": py, "issues": issues}, issues

    with ThreadPoolExecutor(max_workers=args.workers) as ex_pool:
        futures = {ex_pool.submit(worker, it): it for it in targets}
        done = 0
        for fut in as_completed(futures):
            it, result, issues = fut.result()
            done += 1
            ch = it["char"]
            if result is None or not result.get("example"):
                failed += 1
                fail_list.append({"char": ch, "issues": issues})
                tag = "FAIL"
            elif result.get("issues"):
                # 有瑕疵但仍写回（保留可用结果），记录到 sample 供人工抽检
                if not args.dry_run:
                    it["example"] = result["example"]
                    it["pinyin"] = result["pinyin"]
                success += 1
                if len(sample) < 12:
                    sample.append({"char": ch, **result})
                tag = "OK*"
            else:
                if not args.dry_run:
                    it["example"] = result["example"]
                    it["pinyin"] = result["pinyin"]
                success += 1
                if len(sample) < 12:
                    sample.append({"char": ch, **result})
                tag = "OK"
            if done % 20 == 0 or done <= 5 or tag != "OK":
                print(f"  [{done}/{len(targets)}] {ch} {tag} {issues if issues else ''}")

    elapsed = time.time() - t0
    if not args.dry_run and success > 0:
        save_data(doc)

    report = {
        "model": cfg["model"],
        "total_candidates": total,
        "processed": len(targets),
        "success": success,
        "failed": failed,
        "skipped": skipped,
        "dry_run": args.dry_run,
        "elapsed_sec": round(elapsed, 1),
        "fail_list": fail_list,
        "sample": sample,
    }
    with open(REPORT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print("\n===== 报告 =====")
    print(f"模型: {cfg['model']}")
    print(f"处理: {len(targets)} / 候选 {total}")
    print(f"成功: {success}  失败: {failed}  跳过: {skipped}")
    print(f"耗时: {elapsed:.1f}s  报告: {REPORT}")
    if fail_list:
        print("失败字:", ", ".join(x["char"] for x in fail_list[:30]))
    print("\n抽检（前 5 条）:")
    for s in sample[:5]:
        print(f"  {s['char']} [{s['pinyin']}] {s['example']}  issues={s.get('issues', [])}")


if __name__ == "__main__":
    main()
