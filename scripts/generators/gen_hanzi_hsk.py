#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_hanzi_hsk.py — 从 HSK 3.0 词表生成汉字答题题库骨架。

输入：.tmp/hsk-source/hsk30/hsk30.csv （ivankra/hsk30 仓库）
输出：data/hanzi-hsk.json

产物结构：
  - 词组填空题（type:"fill-blank", word=原词，挖 1 字为答案，opts 含答案+3 干扰项）
  - 单字题骨架（example 留 "" 待 E3 LLM 补，opts 含答案+3 干扰项）

不联网，不调 LLM。仅筛 HSK 3.0 level==1。

运行：python scripts/generators/gen_hanzi_hsk.py
"""
import csv, json, random, sys, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC  = ROOT / ".tmp" / "hsk-source" / "hsk30" / "hsk30.csv"
OUT  = ROOT / "data" / "hanzi-hsk.json"

LEVEL_FILTER = "1"          # HSK 3.0 level
DECOY_N      = 3            # 干扰项数量
SEED         = 20260702     # 可复现

# 常用字 -> emoji 小映射（能覆盖多少覆盖多少，命中算 bonus）
EMOJI = {
    "山":"⛰️","水":"💧","火":"🔥","木":"🌳","日":"☀️","月":"🌙","星":"⭐",
    "天":"🌤️","地":"🌍","人":"🧑","口":"👄","手":"✋","目":"👀","耳":"👂",
    "心":"❤️","头":"🗣️","足":"🦶","雨":"🌧️","风":"🌬️","云":"☁️","雪":"❄️",
    "石":"🪨","土":"🟫","金":"🪙","马":"🐎","牛":"🐂","羊":"🐑","鸟":"🐦",
    "鱼":"🐟","虫":"🐛","龙":"🐉","狗":"🐕","猫":"🐈","花":"🌸","草":"🌿",
    "树":"🌲","车":"🚗","船":"🚢","飞机":"✈️","书":"📖","笔":"✏️","米":"🍚",
    "茶":"🍵","水":"💧","火":"🔥","太阳":"☀️","月亮":"🌙","眼睛":"👁️",
    "妈妈":"👩","爸爸":"👨","哥":"👦","姐":"👧","八":"8️⃣","二":"2️⃣","一":"1️⃣",
    "三":"3️⃣","四":"4️⃣","五":"5️⃣","六":"6️⃣","七":"7️⃣","九":"9️⃣","十":"🔟",
    "上":"⬆️","下":"⬇️","左":"⬅️","右":"➡️","中":"🎯","大":"🔼","小":"🔽",
    "多":"➕","少":"➖","好":"👍","不":"🚫","是":"✅","的":"📌","了":"🔚",
    "钱":"💰","电":"⚡","光":"💡","声":"🔊","色":"🎨","年":"📅","月":"🌙",
    "日":"☀️","时":"⏰","分":"📐","秒":"⏱️","个":"🔢","点":"📍","去":"🚶",
    "来":"🏃","吃":"🍽️","喝":"🥤","看":"👁️","听":"👂","说":"💬","读":"📖",
    "写":"✍️","学":"🎓","坐":"🪑","站":"🧍","走":"🚶","跑":"🏃","买":"🛒",
    "卖":"💸","爱":"❤️","家":"🏠","国":"🎌","城":"🏙️","路":"🛣️","门":"🚪",
    "窗":"🪟","床":"🛏️","桌":"🪑","椅":"🪑","衣":"👕","鞋":"👟","帽":"🎩",
}

def is_han(ch):
    return '一' <= ch <= '鿿'

def only_han(s):
    return ''.join(c for c in s if is_han(c))

def load_words():
    """返回 [(simplified_clean, pinyin, pos), ...] 仅保留至少 1 个汉字的词。"""
    if not SRC.exists():
        sys.exit(f"[ERR] 词表不存在: {SRC}。请先 clone ivankra/hsk30")
    out = []
    with SRC.open(encoding='utf-8') as f:
        for row in csv.DictReader(f):
            if row.get('Level') != LEVEL_FILTER:
                continue
            raw  = row.get('Simplified','').strip()
            py   = row.get('Pinyin','').strip()
            pos  = row.get('POS','').strip()
            han  = only_han(raw)
            if not han or not py:
                continue
            out.append((han, py, pos))
    return out

def build_char_pool(words):
    """收集所有 L1 单字（去重），附词级 pinyin 标注「待 E3 校准」。"""
    seen = {}
    for han, py, _ in words:
        for i, c in enumerate(han):
            if c not in seen:
                # 词级 pinyin 拆分到单字不准，仅作占位
                seen[c] = {
                    "char": c,
                    "pinyin": py,            # 占位：词级 pinyin，待 E3 校准
                    "_pinyin_ambiguous": True,
                }
    return seen

def pick_distractors(answer, pool_chars, n=DECOY_N, rng=random):
    cands = [c for c in pool_chars if c != answer]
    if len(cands) < n:
        # 不够就放宽（极少见，L1 字数充足）
        return cands
    return rng.sample(cands, n)

def make_fill_blank(word, pinyin, pos, pool_chars, rng):
    """词组填空：挖词中第一个汉字为答案（保证答案字来自 L1）。example 用「？+剩余」格式。"""
    chars = list(word)
    # 优先挖非首字（更难），但保证挖出的字在 pool 内
    target_idx = None
    for i in range(len(chars)-1, -1, -1):
        if chars[i] in pool_chars:
            target_idx = i
            break
    if target_idx is None:
        target_idx = 0
    answer = chars[target_idx]
    # example：挖空处用 ？，其余原字保留
    disp = chars.copy()
    disp[target_idx] = "？"
    example = "".join(disp)
    decoys = pick_distractors(answer, pool_chars, DECOY_N, rng)
    opts = decoys + [answer]
    rng.shuffle(opts)
    return {
        "type": "fill-blank",
        "word": word,
        "pinyin": pinyin,
        "pos": pos or "",
        "emoji": "",
        "example": example,
        "answer": answer,
        "opts": opts,
        "modes": ["fill-blank"],
    }

def make_char_skeleton(char_info, pool_chars, rng):
    """单字题骨架：example 留空待 E3 LLM 补。"""
    c = char_info["char"]
    decoys = pick_distractors(c, pool_chars, DECOY_N, rng)
    opts = decoys + [c]
    rng.shuffle(opts)
    return {
        "char": c,
        "pinyin": char_info["pinyin"],
        "emoji": EMOJI.get(c, ""),
        "example": "",   # 待 E3 补
        "answer": c,
        "opts": opts,
        "modes": ["choose-char-by-pinyin"],
    }

def main():
    rng = random.Random(SEED)
    words = load_words()
    print(f"[INFO] L1 词数（清洗后）: {len(words)}")

    multi = [(w,p,pos) for (w,p,pos) in words if len(w) >= 2]
    print(f"[INFO] 多字词（→词组填空题）: {len(multi)}")

    pool = build_char_pool(words)
    pool_chars = sorted(pool.keys())
    print(f"[INFO] L1 去重单字总数: {len(pool_chars)}")

    fill_items = [make_fill_blank(w,p,pos,pool_chars,rng) for (w,p,pos) in multi]
    char_items = [make_char_skeleton(pool[c], pool_chars, rng) for c in sorted(pool)]

    emoji_hit = sum(1 for it in char_items if it["emoji"])
    emoji_rate = emoji_hit / len(char_items) if char_items else 0

    payload = {
        "source": "HSK 3.0 Level 1",
        "version": "1.0",
        "generated": "2026-07-02",
        "note": "由 scripts/generators/gen_hanzi_hsk.py 从 ivankra/hsk30 词表生成。"
                "词组填空 example 用「？+剩余字」占位（免 LLM）；"
                "单字题 example 留空待 E3 SiliconFlow API 补；"
                "单字 pinyin 为词级占位，待 E3 校准。",
        "levels": {
            "hsk1": fill_items + char_items,
        },
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f"[OK] 写出 {OUT}")
    print(f"[STAT] 词组填空题: {len(fill_items)}")
    print(f"[STAT] 单字骨架:   {len(char_items)}")
    print(f"[STAT] emoji 覆盖: {emoji_hit}/{len(char_items)} = {emoji_rate:.1%}")
    print(f"[STAT] 待 E3 补 example: {len(char_items)} 条（单字）+ 0 条（填空 example 已占位）")

if __name__ == "__main__":
    main()
