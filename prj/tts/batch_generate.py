#!/usr/bin/env python
# 用 VoxCPM2 虚拟环境跑：
#   "D:/PythonEnvs/tts-voxcpm/Scripts/python.exe" batch_generate.py
# 单进程加载一次模型，批量生成固定文本 mp3 + map.json。
import hashlib
import json
import re as _re
import time
from pathlib import Path

import soundfile as sf
from voxcpm import VoxCPM


def _voice_clean(text):
    """与 js/voice.js _cleanGalgameText 对齐：去所有空格后再 trim。"""
    if not isinstance(text, str):
        return ""
    text = _re.sub(r"\s+", "", text)
    return text.strip()


REPO_ROOT = Path(__file__).resolve().parents[2]
OUT = REPO_ROOT / "assets" / "voice"
OUT.mkdir(parents=True, exist_ok=True)
MODEL = "D:/HuggingFaceCache/VoxCPM2"
VOICE_PREFIX = "(温柔的女声，语速缓慢，充满关怀，像妈妈在给孩子讲睡前故事)"
STORIES_DIR = REPO_ROOT / "data" / "stories"
SCENES_PATH = REPO_ROOT / "data" / "scenes.json"
VOICE_MAP_PATH = OUT / "map.json"


STATIC_TEXTS = [
    # ---------- 遛弯 js/walk.js（ROUTES name/desc + RANDOM_EVENTS msg 初始+结果）----------
    "🌳 公园",
    "环境优雅，适合散步",
    "🌊 河边",
    "清凉宜人，风景优美",
    "🛍️ 商场",
    "繁华热闹，偶遇惊喜",
    "🏫 学校",
    "充满活力，适合学习",
    "🐾 遇到其他宠物，打了个招呼！",
    "🐾 遇到其他宠物，亲密度+1",
    "🎁 捡到了一个有趣的道具！",
    "🎁 捡到了一个小球！",
    "💎 发现了一块宝箱碎片！",
    "💎 发现宝箱碎片！",
    "🌧️ 天气变差了，淋雨了...",
    "🌧️ 淋雨了，HP-5",
    "🍖 发现了一份美食！",
    "🍖 发现美食，HP+10",
    "🦋 看到了一只漂亮的蝴蝶！",
    "🦋 遇到蝴蝶，心情愉悦！",
    "🐦 听到小鸟在唱歌...",
    "🐦 听到小鸟在唱歌，快乐值+!",
    "✨ 散步让身体变得更强壮了！",
    "✨ 遛弯结束，获得 EXP",
    "🐕 遇到了一群狗狗在玩耍",
    "🐕 遇到狗狗玩耍，亲密度+1",
    "🧶 捡到了一团毛线",
    "🧶 捡到毛线球！",
    "👣 踩到了一块小石头...",
    "👣 踩到小石头，HP-2",
    "🍦 闻到了冰淇淋的味道！",
    "🍦 闻到美食，心情大好！",
    "🦴 捡到一根美味的骨头",
    "🦴 捡到骨头！",
    "🌈 看到了一道彩虹！",
    "🌈 看到彩虹，心情变好！",
    "🏃 运动量达标啦！",
    "🏃 运动达标，EXP+3",
    # 数学 PK 反馈（js/math-pk.js）
    "⚡ 你赢了！",
    "🤖 机器人赢了",
    # 宠物小屋气泡 _bubble（js/home.js）
    "💫 我倒下了…快来救我！",
    "🍽️ 我饿了…",
    "🛁 我脏脏…",
    "🤕 好虚弱…",
    # 宠物小屋点击台词 SPEECH_LINES（js/home.js）
    "主人最好啦~",
    "今天也元气满满！",
    "想出去玩~",
    "抱抱我嘛！",
    "嘿嘿，开心！",
    "好饿啊...",
    "肚子咕咕叫",
    "求投喂~",
    "主人有吃的吗？",
    "好脏呀想洗澡",
    "需要清洁一下~",
    "黏糊糊的不舒服",
    "...需要救援...",
    "起不来了...",
    "眼前发黑...",
    "头好晕...",
    "没什么力气呢",
    "想休息一会儿",
    "哼哼~",
    "陪陪我嘛",
    "在发呆中",
    "今天天气不错呢",
    "主人加油！",
    # 宠物小屋/救援提示（js/home.js）
    "请先选择一只宠物",
    "宠物倒下了，请先救援",
    "成长分不足（需 10 分）",
    "🎉 宠物苏醒了！又可以一起去冒险啦～",
    "宠物不需要救援",
    # pet.js 行动结果 msg
    "宠物需要先复活",
    "积分不足（需 10 分）",
    "HP 太低，不能玩耍（先去探索或休息）",
    "玩耍成功！快乐 +15，亲密 +5，经验 +5",
    "休息成功！恢复 30% HP，亲密 +2",
    "洗澡成功！清洁 +30，快乐 +5",
    # app.js 通用提示
    "成长分不足，快去完成任务赚积分吧！",
    "😊 待机",
    "😄 开心",
    "⚔️ 攻击",
    "背包中没有宠物粮，简单恢复 10 HP（探索获得宠物粮可喂食更多）",
    "宠物倒下了，请先去宠物小屋救援 🆘",
]


def _append_text(bucket, text):
    if isinstance(text, str) and text.strip():
        bucket.append(text)


def _load_story_texts():
    texts = []
    for story_path in sorted(STORIES_DIR.glob("*.json")):
        data = json.loads(story_path.read_text(encoding="utf-8"))
        _append_text(texts, data.get("ending_text"))
        for event in data.get("events", []):
            event_type = event.get("type")
            if event_type in {"narrate", "discover", "encounter", "choice", "math"}:
                _append_text(texts, event.get("text"))
            if event_type == "math":
                _append_text(texts, event.get("question"))
                _append_text(texts, event.get("reward", {}).get("msg"))
            if event_type == "choice":
                for option in event.get("options", []):
                    _append_text(texts, option.get("text"))
                    _append_text(texts, option.get("reward"))
    return texts


def _load_scene_texts():
    texts = []
    scenes = json.loads(SCENES_PATH.read_text(encoding="utf-8")).get("scenes", [])
    for scene in scenes:
        for field in ("name", "description", "story"):
            _append_text(texts, scene.get(field))
    return texts


def _load_existing_map_texts():
    if not VOICE_MAP_PATH.exists():
        return []
    data = json.loads(VOICE_MAP_PATH.read_text(encoding="utf-8"))
    return [text for text in data.keys() if isinstance(text, str) and text.strip()]


def build_texts():
    ordered = []
    ordered.extend(_load_story_texts())
    ordered.extend(_load_scene_texts())
    ordered.extend(STATIC_TEXTS)
    ordered.extend(_load_existing_map_texts())

    seen = set()
    deduped = []
    for text in ordered:
        key = _voice_clean(text)
        if key and key not in seen:
            seen.add(key)
            deduped.append(text)
    return deduped


def main():
    texts = build_texts()

    print(f"loading model from {MODEL} ...")
    t0 = time.time()
    model = VoxCPM.from_pretrained(MODEL, load_denoiser=False)
    sr = model.tts_model.sample_rate
    print(f"model loaded in {time.time()-t0:.1f}s, sample_rate={sr}")
    print(f"total texts: {len(texts)}")

    mapping = {}
    timings = []
    for i, text in enumerate(texts):
        key = _voice_clean(text)
        digest = hashlib.md5(key.encode("utf-8")).hexdigest()
        out = OUT / f"{digest}.mp3"
        if out.exists() and out.stat().st_size > 100:
            mapping[key] = digest
            continue
        t = time.time()
        wav = model.generate(
            text=VOICE_PREFIX + text,
            cfg_value=2.0,
            inference_timesteps=10,
        )
        sf.write(str(out), wav, sr)
        dt = time.time() - t
        mapping[key] = digest
        timings.append((i, len(text), dt))
        print(f"[{i+1}/{len(texts)}] {len(text)}字 {dt:.1f}s {digest}")

    with open(OUT / "map.json", "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)

    if timings:
        print("\n=== 耗时统计（仅新生成）===")
        head = timings[:5] + ([(-1, 0, 0.0)] if len(timings) > 5 else [])
        for idx, n, dt in head:
            label = "..." if idx < 0 else f"#{idx+1}"
            print(f"  text{label} ({n}字): {dt:.1f}s")
        nums = [x[2] for x in timings]
        print(f"  最快={min(nums):.1f}s 最慢={max(nums):.1f}s 平均={sum(nums)/len(nums):.1f}s n={len(nums)}")
    print(f"DONE: {len(mapping)} entries -> {OUT/'map.json'}")


if __name__ == "__main__":
    main()
