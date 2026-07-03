#!/usr/bin/env python3
"""E5 样本验证：用 Agnes (agnes-image-2.1-flash) 给汉字/词语配图。
儿童课本插图风格。本轮只生样本，不改 data/JSON。

用法:
    python scripts/generators/gen_hanzi_images.py --sample 10 --out .tmp/hanzi-img-sample

复用 generate_pets.py 的 Agnes 调用模式（POST /images/generations, b64_json）。
"""
import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE_URL = "https://apihub.agnes-ai.com/v1"
MODEL = "agnes-image-2.1-flash"
IMG_SIZE = "512x512"  # 课本插图清晰度够，体积可控
MAX_RETRY = 2  # 失败重试次数

PROMPT_TEMPLATE = (
    "Cute children's textbook illustration of {desc}, "
    "bright warm colors, simple clean background, "
    "friendly flat style, no text, no words"
)

# 10 条样本：字/词 → (拼音短名, 英文释义)
# 词组来自 data/hanzi-hsk.json，单字为常见有画面感字。
SAMPLES = [
    ("山",   "shan",     "a tall green mountain with a snow-capped peak"),
    ("水",   "shui",     "clear blue stream of water flowing gently over rocks"),
    ("日",   "ri",       "a bright yellow sun shining in a blue sky with rays"),
    ("月",   "yue",      "a gentle crescent moon with stars in the night sky"),
    ("花",   "hua",      "a pretty red flower with green leaves and stem"),
    ("电话", "dianhua",  "a classic red rotary telephone on a desk"),
    ("孩子", "haizi",    "a happy smiling little child waving both hands"),
    ("老师", "laoshi",   "a kind female teacher with glasses holding a book"),
    ("朋友", "pengyou",  "two happy children holding hands as best friends"),
    ("学校", "xuexiao",  "a small cute school building with a clock and flag"),
]


def load_token(env_path: str = ".env") -> str:
    """从 .env 读取 AGNES_TOKEN（手动解析，避免依赖 python-dotenv）。"""
    token = os.environ.get("AGNES_TOKEN")
    if token:
        return token
    if not os.path.exists(env_path):
        raise RuntimeError(f".env not found: {env_path}")
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line.startswith("AGNES_TOKEN="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise RuntimeError("AGNES_TOKEN not found in .env")


def gen_one(prompt: str, token: str, timeout: int = 120) -> dict:
    """调一次 Agnes images API，返回 {ok, img_bytes} 或 {ok:False, error}。"""
    url = f"{BASE_URL}/images/generations"
    body = json.dumps({
        "model": MODEL,
        "prompt": prompt,
        "n": 1,
        "size": IMG_SIZE,
        # 注：agnes-image-2.1-flash 不支持 response_format（HTTP 400），
        # 默认返回 url，由下方 url 分支下载。
    }).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        err = e.read().decode(errors="replace")
        return {"ok": False, "error": f"HTTP {e.code}: {err[:300]}"}
    except Exception as e:
        return {"ok": False, "error": str(e)}

    try:
        item = data["data"][0]
        # agnes-image-2.1-flash 返回 data[0] = {b64_json: None|str, url: str|None, revised_prompt}
        # 优先 url（实测 b64_json 常为 None），b64 非空才用
        if item.get("b64_json"):
            img_bytes = base64.b64decode(item["b64_json"])
        elif item.get("url"):
            with urllib.request.urlopen(item["url"], timeout=90) as r:
                img_bytes = r.read()
        else:
            return {"ok": False, "error": f"no image data: {str(item)[:200]}"}
    except Exception as e:
        return {"ok": False, "error": f"parse: {e} - raw: {str(data)[:400]}"}

    return {"ok": True, "img_bytes": img_bytes}


def gen_with_retry(prompt: str, token: str, name: str) -> dict:
    """带重试的生图。"""
    last_err = ""
    for attempt in range(1, MAX_RETRY + 2):  # 1 + 2 retries
        r = gen_one(prompt, token)
        if r["ok"]:
            return r
        last_err = r["error"]
        # 鉴权/参数错误不重试
        if (last_err.startswith("HTTP 401") or last_err.startswith("HTTP 403")
                or last_err.startswith("HTTP 400")):
            return {"ok": False, "error": f"[no retry] {last_err}"}
        if attempt <= MAX_RETRY:
            time.sleep(1.5 * attempt)
    return {"ok": False, "error": last_err}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", type=int, default=0,
                    help="只生前 N 条样本（0=全部），默认 0")
    ap.add_argument("--out", default=".tmp/hanzi-img-sample",
                    help="输出目录")
    args = ap.parse_args()

    # 项目根 = 脚本的上两级
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root = os.path.abspath(os.path.join(script_dir, "..", ".."))
    env_path = os.path.join(root, ".env")
    out_dir = os.path.join(root, args.out) if not os.path.isabs(args.out) else args.out

    token = load_token(env_path)
    # 不打印 token，只确认长度
    print(f"[env] AGNES_TOKEN loaded (len={len(token)})")
    print(f"[cfg] model={MODEL} size={IMG_SIZE} out={out_dir}")

    os.makedirs(out_dir, exist_ok=True)

    samples = SAMPLES[:args.sample] if args.sample > 0 else SAMPLES
    print(f"[run] {len(samples)} samples, retry={MAX_RETRY}\n")

    results = []
    t_total = time.time()
    for char, pinyin, desc in samples:
        fname = f"{pinyin}.png"
        out_path = os.path.join(out_dir, fname)
        # 幂等跳过（>5KB 视为有效）
        if os.path.exists(out_path) and os.path.getsize(out_path) > 5 * 1024:
            sz = os.path.getsize(out_path)
            results.append({"ok": True, "char": char, "pinyin": pinyin,
                            "desc": desc, "fname": fname, "path": out_path,
                            "size_kb": round(sz / 1024, 1), "skipped": True,
                            "elapsed": 0.0})
            print(f"  [skip] {char} ({pinyin}) exists {round(sz/1024,1)}KB")
            continue

        prompt = PROMPT_TEMPLATE.format(desc=desc)
        print(f"  [gen ] {char} ({pinyin}): {desc[:50]}")
        t0 = time.time()
        r = gen_with_retry(prompt, token, fname)
        elapsed = round(time.time() - t0, 1)
        if r["ok"]:
            img_bytes = r["img_bytes"]
            with open(out_path, "wb") as f:
                f.write(img_bytes)
            results.append({"ok": True, "char": char, "pinyin": pinyin,
                            "desc": desc, "fname": fname, "path": out_path,
                            "size_kb": round(len(img_bytes) / 1024, 1),
                            "elapsed": elapsed})
            print(f"         -> {fname} {round(len(img_bytes)/1024,1)}KB ({elapsed}s)")
        else:
            results.append({"ok": False, "char": char, "pinyin": pinyin,
                            "desc": desc, "fname": fname, "path": out_path,
                            "error": r["error"], "elapsed": elapsed})
            print(f"         FAILED ({elapsed}s): {r['error'][:160]}")
        time.sleep(0.4)
    total_elapsed = round(time.time() - t_total, 1)

    # 汇总
    print("\n=== Summary ===")
    ok = sum(1 for r in results if r["ok"])
    print(f"OK: {ok}/{len(results)}  total_time={total_elapsed}s")
    for r in results:
        status = "OK" if r["ok"] else "FAIL"
        extra = (f"{r['size_kb']}KB {r['elapsed']}s"
                 if r["ok"] else r.get("error", "")[:90])
        print(f"  [{status}] {r['char']:4s} {r['pinyin']:9s} {r['fname']:14s} {extra}")

    # 写 result.json 供 summary 引用
    import json as _json
    with open(os.path.join(out_dir, "_result.json"), "w", encoding="utf-8") as f:
        _json.dump({"results": results, "total_elapsed": total_elapsed,
                    "model": MODEL, "size": IMG_SIZE}, f, ensure_ascii=False, indent=2)

    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
