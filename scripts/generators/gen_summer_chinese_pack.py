import json
import re
from pathlib import Path

from pypinyin import Style, lazy_pinyin


ROOT = Path(__file__).resolve().parents[2]
PACK_DIR = ROOT / "data" / "learn" / "packs" / "summer-chinese-bridge-2026"
MODULE_DIR = PACK_DIR / "modules"


MANUAL_CHAR_OVERRIDES = {
    "爸": {"pinyin": "bà", "example": "爸爸在看书。"},
    "妈": {"pinyin": "mā", "example": "妈妈在做饭。"},
    "爷": {"pinyin": "yé", "example": "爷爷带我散步。"},
    "奶": {"pinyin": "nǎi", "example": "奶奶给我讲故事。"},
    "班": {"pinyin": "bān", "example": "我们一起上学。"},
    "课": {"pinyin": "kè", "example": "今天有一节中文课。"},
    "早": {"pinyin": "zǎo", "example": "早上好，小朋友。"},
    "晚": {"pinyin": "wǎn", "example": "晚上一起看书。"},
    "睡": {"pinyin": "shuì", "example": "晚上要早睡。"},
    "觉": {"pinyin": "jiào", "example": "早睡觉，身体好。"},
    "洗": {"pinyin": "xǐ", "example": "吃饭前要洗手。"},
    "脸": {"pinyin": "liǎn", "example": "早上先洗脸。"},
    "刷": {"pinyin": "shuā", "example": "刷牙后再吃饭。"},
    "牙": {"pinyin": "yá", "example": "小牙齿要保护。"},
    "杯": {"pinyin": "bēi", "example": "水杯要放好。"},
    "鞋": {"pinyin": "xié", "example": "回家先换鞋。"},
    "凉": {"pinyin": "liáng", "example": "树下有凉风。"},
    "雪": {"pinyin": "xuě", "example": "冬天下雪了。"},
    "黑": {"pinyin": "hēi", "example": "黑夜里有月亮。"},
    "昨": {"pinyin": "zuó", "example": "今天比昨天更会读。"},
    "怕": {"pinyin": "pà", "example": "看到数字不害怕。"},
    "急": {"pinyin": "jí", "example": "喝水不要着急。"},
    "轻": {"pinyin": "qīng", "example": "上学更轻松。"},
    "松": {"pinyin": "sōng", "example": "上学更轻松。"},
    "讲": {"pinyin": "jiǎng", "example": "小朋友讲礼貌。"},
    "礼": {"pinyin": "lǐ", "example": "见人先问好。"},
    "貌": {"pinyin": "mào", "example": "讲话要有礼貌。"},
    "别": {"pinyin": "bié", "example": "分别时说再见。"},
    "分": {"pinyin": "fēn", "example": "把水果分给朋友。"},
    "享": {"pinyin": "xiǎng", "example": "我会和朋友分享。"},
    "步": {"pinyin": "bù", "example": "天天读，就会有进步。"},
    "颗": {"pinyin": "kē", "example": "像点亮一颗星星。"},
    "鹅": {"pinyin": "é", "example": "鹅鹅鹅，向天歌。"},
    "曲": {"pinyin": "qū", "example": "曲项向天歌。"},
    "项": {"pinyin": "xiàng", "example": "曲项向天歌。"},
    "床": {"pinyin": "chuáng", "example": "床前明月光。"},
    "前": {"pinyin": "qián", "example": "床前明月光。"},
    "疑": {"pinyin": "yí", "example": "疑是地上霜。"},
    "霜": {"pinyin": "shuāng", "example": "疑是地上霜。"},
    "父": {"pinyin": "fù", "example": "父母呼，应勿缓。"},
    "母": {"pinyin": "mǔ", "example": "父母命，行勿懒。"},
    "呼": {"pinyin": "hū", "example": "父母呼，应勿缓。"},
    "应": {"pinyin": "yīng", "example": "父母呼，应勿缓。"},
    "勿": {"pinyin": "wù", "example": "父母命，行勿懒。"},
    "缓": {"pinyin": "huǎn", "example": "父母呼，应勿缓。"},
    "命": {"pinyin": "mìng", "example": "父母命，行勿懒。"},
    "懒": {"pinyin": "lǎn", "example": "父母命，行勿懒。"},
    "信": {"pinyin": "xìn", "example": "慢慢读，心里更有信心。"},
    "容": {"pinyin": "róng", "example": "心里更从容。"},
    "巾": {"pinyin": "jīn", "example": "给爸爸拿纸巾。"},
    "碗": {"pinyin": "wǎn", "example": "我会摆好碗。"},
    "纸": {"pinyin": "zhǐ", "example": "给爸爸拿纸巾。"},
    "灯": {"pinyin": "dēng", "example": "屋子里的灯很亮。"},
    "报": {"pinyin": "bào", "example": "爷爷爱看报。"},
    "整": {"pinyin": "zhěng", "example": "房间更整齐。"},
    "齐": {"pinyin": "qí", "example": "房间更整齐。"},
    "袋": {"pinyin": "dài", "example": "手要放进口袋。"},
    "疑": {"pinyin": "yí", "example": "疑是地上霜。"},
    "容": {"pinyin": "róng", "example": "心里更从容。"},
}


MORNING_READING_TEXTS = [
    ("你好，暑假", "早上好，太阳笑。小朋友，起得早。", "先把中文节奏找回来。"),
    ("我爱读中文", "我爱读书，也爱写字。一天一点点，中文更熟了。", "用轻量晨读进入状态。"),
    ("洗脸刷牙", "洗脸刷牙，把手洗。干干净净去吃早饭。", "把生活习惯和中文词语连起来。"),
    ("见面问好", "见到老师说你好，见到朋友问个好。", "练习礼貌问候。"),
    ("书包准备好", "书包里，有书本。有笔和本，也有水。", "熟悉上学常用物品。"),
    ("一起去学校", "坐下读书，站好排队。大家一起学。", "适应学校场景。"),
    ("小手来帮忙", "小手来帮忙，收好书，放好笔。", "让孩子感到自己做得到。"),
    ("上课和下课", "上课眼看老师，下课一起玩。", "认识课堂节奏。"),
    ("今天读一点", "今天会读一个字，明天再读一个字。", "建立持续感。"),
    ("自己来做", "我会自己穿衣，也会自己回家。", "强化独立意识。"),
    ("吃饭前洗手", "吃饭前，要洗手。吃饭时，小口慢慢吃。", "口语化习惯短句。"),
    ("喝水不着急", "喝水不着急，一口一口喝。", "让朗读贴近日常。"),
    ("早睡早起", "早睡早起，白天有精神。", "复现家庭常说的生活句。"),
    ("坐正看书", "看书要坐正，写字要安静。", "为小学课堂习惯做铺垫。"),
    ("学会排队", "学会排队，不抢不闹。", "建立规则意识。"),
    ("先听再说", "有人说话，我先听。轮到我，再开口。", "帮助孩子适应集体表达。"),
    ("会说谢谢", "做错了事，说对不起。别人帮我，说谢谢。", "礼貌表达。"),
    ("请你先来", "请你先来，我在后面等一等。", "排队和等待。"),
    ("东西放回去", "东西用完放回去，房间就会更整齐。", "收纳习惯。"),
    ("一点一点做", "今天做一点，明天再做一点，好习惯慢慢长大。", "强调积累。"),
    ("全家吃早饭", "爸爸上班，妈妈做饭。我也来帮一点。", "家庭场景。"),
    ("说说今天做什么", "全家一起吃早饭，说说今天做什么。", "完整口语场景。"),
    ("爷爷奶奶", "爷爷爱看报，奶奶爱种花。", "家庭成员识别。"),
    ("回到家里", "回到家里，先放书包，再换鞋。", "放学回家动线。"),
    ("晚上听故事", "晚上一起看书，听一个小故事。", "把朗读和故事连接起来。"),
    ("给家人帮忙", "我给妈妈拿水杯，也给爸爸拿纸巾。", "帮助家人。"),
    ("家里有爱", "家里有爱，心里有光。", "温暖稳定的句子。"),
    ("朋友来家里", "朋友来家里玩，一起看书，一起说话。", "社交场景。"),
    ("我爱我的家", "我爱我的家，也爱家里每一个人。", "重复句式帮助朗读。"),
    ("睡前说晚安", "睡前说晚安，做个甜甜的梦。", "结束一天。"),
    ("春天来了", "春天花开，小草变绿。", "季节词。"),
    ("夏天的树下", "夏天太阳大，树下有凉风。", "自然观察。"),
    ("秋天果子红", "秋天果子红，田里稻子黄。", "颜色和季节。"),
    ("冬天有点冷", "冬天风有点冷，手要放进口袋。", "穿插生活提醒。"),
    ("白云和小鸟", "白云在天上，鸟儿在树上。", "位置词。"),
    ("小河和小鱼", "小河向前跑，小鱼在水里游。", "拟人化朗读。"),
    ("月亮和星星", "月亮像小船，星星眨眨眼。", "夜晚想象。"),
    ("下雨的时候", "下雨的时候，听雨点说话。", "培养语感。"),
    ("雪花来了", "雪花从天上来，大地变白了。", "冬季画面。"),
    ("看到山和海", "看到山，想到远方。看到海，想到大船。", "视野拓展。"),
    ("排排坐", "一二三，排排坐。四五六，拍拍手。", "数数节奏。"),
    ("上下左右", "上下左右看一看，前后来回走一走。", "空间方向。"),
    ("大的帮小的", "大的帮小的，多的分少的。", "比较关系。"),
    ("星期有顺序", "今天是星期一，明天就是星期二。", "时间概念。"),
    ("早上和晚上", "早上读一读，晚上想一想。", "晨读和回顾。"),
    ("会等时间", "我会看时间，也会等时间。", "时间意识。"),
    ("红花和白云", "红花开，白云飞，青山真好看。", "颜色观察。"),
    ("白天和黑夜", "黑夜里有月亮，白天里有太阳。", "昼夜切换。"),
    ("数字不害怕", "看到数字不害怕，一个一个慢慢来。", "减轻数学焦虑。"),
    ("今天比昨天", "今天比昨天更会读，明天比今天更会写。", "看见进步。"),
    ("讲礼貌", "小朋友，讲礼貌。见面问好，分别说再见。", "礼貌表达。"),
    ("你帮我，我帮你", "你帮我，我帮你，大家都是好朋友。", "合作句式。"),
    ("我会分享", "我会分享，也会等一等。", "社交节奏。"),
    ("学中文不着急", "学中文，不着急。天天读，就会有进步。", "降低压力。"),
    ("不会的字", "看到不会的字，先多看，再多读。", "遇到困难时的策略。"),
    ("点亮小星星", "学会一个字，就像点亮一颗小星星。", "学习激励。"),
    ("咏鹅", "鹅，鹅，鹅，曲项向天歌。", "用熟悉的古诗进入文言节奏。"),
    ("静夜思", "床前明月光，疑是地上霜。", "朗朗上口的古诗。"),
    ("弟子规一", "父母呼，应勿缓。父母命，行勿懒。", "经典短句启蒙。"),
    ("天天读一点", "天天读一点，上学更轻松。", "以积极句子收束整个资料包。"),
]


POEMS = [
    ("咏鹅", "鹅，鹅，鹅，曲项向天歌。"),
    ("静夜思", "床前明月光，疑是地上霜。"),
    ("春晓", "春眠不觉晓，处处闻啼鸟。"),
    ("画", "远看山有色，近听水无声。"),
    ("登鹳雀楼", "白日依山尽，黄河入海流。"),
    ("悯农", "锄禾日当午，汗滴禾下土。"),
    ("池上", "小娃撑小艇，偷采白莲回。"),
    ("古朗月行", "小时不识月，呼作白玉盘。")
]


CLASSICS = [
    ("弟子规一", "父母呼，应勿缓。父母命，行勿懒。"),
    ("弟子规二", "出必告，反必面。居有常，业无变。"),
    ("弟子规三", "长者先，幼者后。长呼人，即代叫。"),
    ("弟子规四", "晨必盥，兼漱口。便溺回，辄净手。"),
    ("礼貌短句一", "见人先问好，说话轻一点。"),
    ("礼貌短句二", "你帮我，我谢谢。做错了，说对不起。"),
    ("礼貌短句三", "排队不着急，轮到我再来。"),
    ("礼貌短句四", "借东西，先开口。用完了，快送回。")
]


WEEKLY_REVIEW_PROMPTS = [
    "这一周我最喜欢读的句子是什么？",
    "这一周我最熟的三个字是什么？",
    "我在哪一天读得最顺？为什么？",
    "哪几个字我还想再看一遍？",
]


def strip_example(text: str) -> str:
    return re.sub(r"\*\*(.+?)\*\*", r"\1", text or "").replace("？", "")


def load_char_library():
    questions = json.loads((ROOT / "data" / "hanzi-questions.json").read_text(encoding="utf-8"))
    hsk = json.loads((ROOT / "data" / "hanzi-hsk.json").read_text(encoding="utf-8"))
    library = {}

    for items in questions["levels"].values():
        for item in items:
            char = item.get("char")
            pinyin = item.get("pinyin")
            if not char or not pinyin:
                continue
            library[char] = {
                "char": char,
                "pinyin": pinyin,
                "example": strip_example(item.get("example", "")),
            }

    for item in hsk["levels"]["hsk1"]:
        char = item.get("char")
        pinyin = item.get("pinyin")
        if not char or not pinyin:
            continue
        existing = library.get(char, {"char": char})
        existing["pinyin"] = existing.get("pinyin") or pinyin
        example = strip_example(item.get("example", ""))
        if example and not existing.get("example"):
            existing["example"] = example
        library[char] = existing

    for char, data in MANUAL_CHAR_OVERRIDES.items():
        existing = library.get(char, {"char": char})
        existing.update(data)
        library[char] = existing

    return library


def to_pinyin(text: str, library: dict) -> str:
    chunks = []
    missing = []
    for ch in text:
        if ch in library and library[ch].get("pinyin"):
            chunks.append(library[ch]["pinyin"])
        elif ch in "，。！？；：、（）《》“” ":
            chunks.append(ch)
        elif ch == "\n":
            chunks.append("\n")
        else:
            auto = "".join(lazy_pinyin(ch, style=Style.TONE, neutral_tone_with_five=True)) or ch
            chunks.append(auto)
            if auto == ch:
                missing.append(ch)
    return " ".join(chunks).replace(" ，", "，").replace(" 。", "。").replace(" ！", "！").replace(" ？", "？").replace(" ：", "：").replace(" ；", "；").replace(" 、", "、"), sorted(set(missing))


def build_literacy_lessons(library: dict):
    ordered_chars = list(library.keys())
    base_chars = ordered_chars[:300]

    review_groups = [
        ["人", "口", "手", "日", "月", "山", "水", "火", "木", "田"],
        ["一", "二", "三", "上", "下", "大", "小", "多", "少", "中"],
        ["我", "你", "他", "她", "好", "家", "来", "回", "爸", "妈"],
        ["学", "生", "书", "本", "笔", "字", "写", "读", "看", "校"],
        ["云", "雨", "风", "雪", "天", "气", "春", "夏", "秋", "冬"],
        ["花", "草", "树", "林", "叶", "果", "鸟", "马", "牛", "鱼"],
        ["东", "西", "南", "北", "前", "后", "左", "右", "里", "外"],
        ["早", "晚", "今", "明", "年", "月", "日", "时", "分", "点"],
        ["吃", "喝", "米", "面", "果", "水", "口", "手", "杯", "碗"],
        ["走", "跑", "看", "听", "说", "写", "读", "笑", "开", "关"],
        ["爷", "奶", "爸", "妈", "哥", "姐", "弟", "妹", "友", "师"],
        ["红", "白", "黑", "青", "黄", "明", "光", "星", "月", "云"],
        ["请", "谢", "对", "不", "好", "先", "后", "来", "等", "回"],
        ["车", "船", "门", "路", "桥", "河", "海", "山", "林", "田"],
        ["会", "爱", "心", "友", "家", "学", "书", "字", "好", "笑"],
    ]

    lessons = []
    for idx in range(30):
        chars = base_chars[idx * 10:(idx + 1) * 10]
        items = []
        for char in chars:
            row = library[char]
            items.append({
                "char": char,
                "pinyin": row.get("pinyin", ""),
                "example": row.get("example", f"认识“{char}”这个字。")
            })
        lessons.append({
            "id": f"day-{idx + 1:02d}",
            "day": idx + 1,
            "title": f"识字练习 {idx + 1:02d}",
            "focus": "每天 10 个字，先认识、再朗读、最后回看一遍。",
            "items": items
        })

    for offset, chars in enumerate(review_groups, start=31):
        items = []
        for char in chars:
            row = library.get(char, {"pinyin": "", "example": f"认识“{char}”这个字。"})
            items.append({
                "char": char,
                "pinyin": row.get("pinyin", ""),
                "example": row.get("example", f"认识“{char}”这个字。")
            })
        lessons.append({
            "id": f"day-{offset:02d}",
            "day": offset,
            "title": f"复习巩固 {offset - 30:02d}",
            "focus": "把前面学过的高频字重新放回生活场景里，看一眼、读一眼、说一句。",
            "items": items
        })

    return lessons


def build_morning_reading(library: dict):
    lessons = []
    all_missing = set()
    for idx, (title, content, focus) in enumerate(MORNING_READING_TEXTS, start=1):
        pinyin, missing = to_pinyin(content, library)
        all_missing.update(missing)
        lessons.append({
            "id": f"day-{idx:02d}",
            "day": idx,
            "title": title,
            "content": content,
            "pinyinContent": pinyin,
            "focus": focus,
            "estimatedMinutes": 5
        })
    return lessons, sorted(all_missing)


def build_poem_lessons(library: dict, source):
    lessons = []
    missing = set()
    for idx, (title, content) in enumerate(source, start=1):
        pinyin, bad = to_pinyin(content, library)
        missing.update(bad)
        lessons.append({
            "id": f"item-{idx:02d}",
            "title": title,
            "content": content,
            "pinyinContent": pinyin
        })
    return lessons, sorted(missing)


def build_weekly_reviews():
    weeks = []
    for idx in range(1, 9):
        weeks.append({
            "id": f"week-{idx:02d}",
            "week": idx,
            "title": f"第 {idx} 周回看",
            "prompt": WEEKLY_REVIEW_PROMPTS[(idx - 1) % len(WEEKLY_REVIEW_PROMPTS)],
            "checklist": [
                "读一读这周最喜欢的 2 句晨读。",
                "认一认这周最熟的 5 个字。",
                "圈出还想再看一看的内容。",
            ],
        })
    return weeks


def build_plan():
    weeks = []
    for idx in range(1, 10):
        reading_start = min((idx - 1) * 7 + 1, 60)
        reading_end = min(idx * 7, 60)
        literacy_start = min((idx - 1) * 6 + 1, 45)
        literacy_end = min((idx - 1) * 6 + 6, 45)
        if idx == 9:
            literacy_start = 45
            literacy_end = 45
        weeks.append({
            "id": f"week-{idx:02d}",
            "title": f"第 {idx} 周：幼小衔接中文节奏 {idx}",
            "focus": "晨读每天一小段，识字每天 10 个字；周末回看，不追求快，只追求熟。",
            "readingRange": [reading_start, reading_end],
            "literacyRange": [literacy_start, literacy_end],
            "suggestion": "如果哪一天没跟上，就把那天的内容顺延到第二天，保持轻松节奏。"
        })
    return {
        "summary": "整体按“轻晨读 + 轻识字 + 每周复盘”的暑假节奏设计，先让孩子熟悉中文节奏和常见字，再慢慢建立朗读自信。",
        "dailyRoutine": [
            "晨读 5 分钟",
            "识字 8-10 分钟",
            "读完就打勾，不需要一次学很久"
        ],
        "weeks": weeks
    }


def main():
    PACK_DIR.mkdir(parents=True, exist_ok=True)
    MODULE_DIR.mkdir(parents=True, exist_ok=True)

    library = load_char_library()
    morning_reading, reading_missing = build_morning_reading(library)
    literacy = build_literacy_lessons(library)
    poems, poem_missing = build_poem_lessons(library, POEMS)
    classics, classic_missing = build_poem_lessons(library, CLASSICS)
    weekly_reviews = build_weekly_reviews()
    plan = build_plan()

    char_library_out = {"items": sorted(library.values(), key=lambda x: x["char"])}
    (PACK_DIR / "char-library.json").write_text(json.dumps(char_library_out, ensure_ascii=False, indent=2), encoding="utf-8")
    (MODULE_DIR / "morning-reading.json").write_text(json.dumps({
        "id": "morning-reading",
        "type": "reading",
        "title": "60 天晨读",
        "lessons": morning_reading
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    (MODULE_DIR / "literacy-45days.json").write_text(json.dumps({
        "id": "literacy-45days",
        "type": "literacy",
        "title": "45 天识字",
        "lessons": literacy
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    (MODULE_DIR / "weekly-review.json").write_text(json.dumps({
        "id": "weekly-review",
        "type": "review",
        "title": "每周复盘",
        "lessons": weekly_reviews
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    (MODULE_DIR / "poems.json").write_text(json.dumps({
        "id": "poems",
        "type": "reading",
        "title": "古诗积累",
        "lessons": poems
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    (MODULE_DIR / "classics.json").write_text(json.dumps({
        "id": "classics",
        "type": "reading",
        "title": "经典短句",
        "lessons": classics
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    (PACK_DIR / "plan.json").write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")

    missing = sorted(set(reading_missing + poem_missing + classic_missing))
    print("generated morning_reading", len(morning_reading))
    print("generated literacy", len(literacy))
    print("generated weekly review", len(weekly_reviews))
    if missing:
        print("missing pinyin chars:", "".join(missing))
    else:
        print("missing pinyin chars: none")


if __name__ == "__main__":
    main()
