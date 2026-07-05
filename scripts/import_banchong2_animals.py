from __future__ import annotations

import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib import parse, request

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[1]
PETS_JSON = REPO_ROOT / "data" / "pets.json"
LORE_JSON = REPO_ROOT / "data" / "pokedex-lore-draft.json"
SNAPSHOT_DIR = REPO_ROOT / "data" / "source-snapshots"
ASSET_DIR = REPO_ROOT / "assets" / "banchong2" / "萌爪伙伴族"
ANIMALS_SNAPSHOT = SNAPSHOT_DIR / "banchong2-animals.json"
LEVELS_SNAPSHOT = SNAPSHOT_DIR / "banchong2-levels.json"
MANIFEST_PATH = SNAPSHOT_DIR / "banchong2-import-manifest.json"

BASE_URL = "https://daydayupjfgl.com"
LEVEL_MAP = [1, 2, 4, 6, 8, 10]
SERIES_NAME = "萌爪伙伴族"
BOOKLET_NAME = "萌爪伙伴册"
SOURCE_ID = "banchong2"


PET_META_OVERRIDES = {
    "阿拉斯加": {
        "id": "bc2_alaskan",
        "emoji": "🐺",
        "rarity": "rare",
        "stats": [118, 7, 5, 6],
        "origin": "雪邮坡驿站",
        "school": "晨风陪跑班",
        "work": "雪路陪跑员",
        "hobby": "陪孩子晨跑、叼回掉落的围巾和手套",
        "specialty": "在冷风和长路里稳稳带队，不让队伍掉节奏",
        "ability": "耐寒领路和长距离陪伴",
        "scene_id": "mountain",
        "scene_name": "雪山之巅",
        "traits": ["稳当", "耐心", "护短", "有安全感"],
        "skills": [
            ["雪路引航", "在风雪路上先一步探路，帮队伍避开湿滑路段。"],
            ["厚毛保暖", "把暖烘烘的体温分给身边伙伴，减轻寒冷带来的紧张。"],
            ["长途陪跑", "越是需要坚持的时候，越能稳住全队步调。"],
        ],
    },
    "比熊": {
        "id": "bc2_bichon",
        "emoji": "🐶",
        "rarity": "common",
        "stats": [96, 5, 4, 6],
        "origin": "奶云小巷",
        "school": "微笑礼仪班",
        "work": "暖场迎新员",
        "hobby": "蹭蹭新朋友、帮大家整理小领结",
        "specialty": "一靠近就能把气氛变轻松，让害羞的小朋友愿意开口",
        "ability": "情绪安抚和笑容传递",
        "scene_id": "forest",
        "scene_name": "神秘森林",
        "traits": ["亲人", "软萌", "爱热闹", "很会安慰人"],
        "skills": [
            ["棉云抱抱", "用软乎乎的抱抱把低落情绪轻轻揉散。"],
            ["微笑签到", "一见面就把欢迎感拉满，让队伍更快熟络起来。"],
            ["毛球鼓劲", "在大家犹豫时第一个摇尾巴，带动全队往前走。"],
        ],
    },
    "布偶": {
        "id": "bc2_ragdoll",
        "emoji": "🐱",
        "rarity": "rare",
        "stats": [102, 6, 4, 5],
        "origin": "午后窗台馆",
        "school": "抱抱研究社",
        "work": "安静陪读员",
        "hobby": "趴在书页边打呼噜、陪人翻绘本",
        "specialty": "会用稳定的陪伴感把周围的节奏慢下来",
        "ability": "舒缓专注和温柔陪读",
        "scene_id": "waterfall",
        "scene_name": "彩虹瀑布",
        "traits": ["温柔", "安静", "黏人", "会照顾情绪"],
        "skills": [
            ["软垫守页", "趴在书边稳住纸张，让阅读时间更安定。"],
            ["呼噜安眠", "轻轻一呼噜，就能让紧张的心情慢慢平复。"],
            ["抱抱暂停键", "在大家太急的时候，帮队伍切回舒服节奏。"],
        ],
    },
    "仓鼠": {
        "id": "bc2_hamster",
        "emoji": "🐹",
        "rarity": "common",
        "stats": [84, 5, 3, 7],
        "origin": "零食齿轮仓",
        "school": "小小整理课",
        "work": "口袋补给员",
        "hobby": "囤种子、排队点心、检查口袋有没有破洞",
        "specialty": "能把小东西收得井井有条，临时补给特别快",
        "ability": "快速整理和小份补给",
        "scene_id": "forest",
        "scene_name": "神秘森林",
        "traits": ["机灵", "勤快", "爱储备", "停不下来"],
        "skills": [
            ["滚轮快递", "用超快脚程把小补给一趟趟送到队友身边。"],
            ["颊囊仓库", "把零碎的重要小物件安全收好，不怕临时找不到。"],
            ["碎步巡查", "一边跑一边查漏补缺，最适合善后和整理。"],
        ],
    },
    "金毛": {
        "id": "bc2_golden",
        "emoji": "🐕",
        "rarity": "rare",
        "stats": [112, 6, 5, 5],
        "origin": "暖阳草坡",
        "school": "巡园服务班",
        "work": "阳光巡游员",
        "hobby": "捡球、陪孩子跑步、把散落的小旗子重新插好",
        "specialty": "特别会照看全队状态，谁掉队它都会先发现",
        "ability": "稳定陪伴和团队照看",
        "scene_id": "forest",
        "scene_name": "神秘森林",
        "traits": ["可靠", "外向", "大方", "会照顾人"],
        "skills": [
            ["阳光摆尾", "用热情的回应把队友的犹豫感一扫而空。"],
            ["巡园回收", "一边前进一边把掉落的球、卡片和线索捡回来。"],
            ["同行守望", "总能第一时间发现谁落在了后面。"],
        ],
    },
    "柯基": {
        "id": "bc2_corgi",
        "emoji": "🐕",
        "rarity": "common",
        "stats": [100, 6, 4, 7],
        "origin": "短腿邮路站",
        "school": "快报练习班",
        "work": "短腿快报员",
        "hobby": "冲在前面送消息、练习转身急停、收集小徽章",
        "specialty": "个子不高但反应超快，最适合做队伍里的消息传递员",
        "ability": "快速折返和即时提醒",
        "scene_id": "beach",
        "scene_name": "蔚蓝海滩",
        "traits": ["精神", "直率", "活泼", "执行快"],
        "skills": [
            ["嗖嗖传信", "一下子就把消息从队头送到队尾。"],
            ["急停甩尾", "在关键拐角稳稳刹住，不让同伴撞上去。"],
            ["短腿冲刺", "别看腿短，起步速度总能抢在最前面。"],
        ],
    },
    "橘猫": {
        "id": "bc2_orange_cat",
        "emoji": "🐈",
        "rarity": "common",
        "stats": [98, 6, 4, 4],
        "origin": "晒台点心铺",
        "school": "午睡观察课",
        "work": "窗台值日生",
        "hobby": "晒肚皮、守点心、慢悠悠巡视窗边花盆",
        "specialty": "明明看起来懒洋洋，却总能在最舒服的时机提醒大家休息",
        "ability": "节奏放松和舒适观察",
        "scene_id": "waterfall",
        "scene_name": "彩虹瀑布",
        "traits": ["松弛", "嘴馋", "会享受", "不慌不忙"],
        "skills": [
            ["暖阳打盹", "用放松的节奏把队伍从紧绷状态里拉出来。"],
            ["点心守望", "盯着补给包不让零食被风吹跑。"],
            ["慢拍提醒", "在大家太着急的时候，提醒先喘口气再继续。"],
        ],
    },
    "兔子": {
        "id": "bc2_bunny",
        "emoji": "🐇",
        "rarity": "common",
        "stats": [90, 5, 3, 8],
        "origin": "铃兰跳跳田",
        "school": "轻跃训练班",
        "work": "花圃跳跳员",
        "hobby": "跳过石阶、闻草叶、把小胡萝卜藏进土堆里",
        "specialty": "动作轻又快，适合去看那些别人容易踩乱的小路",
        "ability": "轻盈侦查和快速回转",
        "scene_id": "forest",
        "scene_name": "神秘森林",
        "traits": ["轻快", "敏感", "认真", "干净利落"],
        "skills": [
            ["蹦跳探路", "先一步跳过石阶和树根，把安全路线找出来。"],
            ["草丛耳报", "耳朵一竖就能听见周围的细小动静。"],
            ["胡萝卜回旋", "绕一圈回来时，已经顺手把线索一起带回来了。"],
        ],
    },
    "银渐层": {
        "id": "bc2_silver_shaded",
        "emoji": "🐈",
        "rarity": "rare",
        "stats": [101, 6, 4, 6],
        "origin": "月雾梳毛馆",
        "school": "绒光礼仪课",
        "work": "月光梳毛师",
        "hobby": "整理尾巴、巡看镜面、给同伴梳顺炸开的毛",
        "specialty": "很会把乱糟糟的状态重新收整回体面和安定",
        "ability": "秩序整理和细节照看",
        "scene_id": "castle",
        "scene_name": "云端城堡",
        "traits": ["讲究", "细腻", "从容", "有分寸"],
        "skills": [
            ["绒光整理", "把毛发和情绪一起梳顺，让大家重新进入状态。"],
            ["银尾转身", "在狭小空间里灵巧掉头，不碰乱任何东西。"],
            ["静夜巡看", "越安静的时候，越容易发现被忽略的细节。"],
        ],
    },
    "边牧": {
        "id": "bc2_border_collie",
        "emoji": "🐕",
        "rarity": "epic",
        "stats": [108, 7, 5, 8],
        "origin": "风哨训练场",
        "school": "协作指挥班",
        "work": "队伍指挥生",
        "hobby": "排站位、记路线、在草地上练习口令转向",
        "specialty": "特别会看全局，几乎能把每个伙伴安排到最舒服的位置",
        "ability": "全队调度和路径规划",
        "scene_id": "beach",
        "scene_name": "蔚蓝海滩",
        "traits": ["聪明", "专注", "执行强", "很有主意"],
        "skills": [
            ["口令分线", "一句短口令就能让全队各自回到正确位置。"],
            ["风向预判", "先看环境变化，再决定最省力的前进路线。"],
            ["全场点名", "谁没跟上、谁太着急，它都会立刻发现。"],
        ],
    },
    "卡皮巴拉": {
        "id": "bc2_capybara",
        "emoji": "🦫",
        "rarity": "rare",
        "stats": [120, 5, 6, 4],
        "origin": "温泉慢慢湾",
        "school": "和气相处课",
        "work": "河畔和气员",
        "hobby": "泡温水、陪朋友发呆、把岸边小石头排整齐",
        "specialty": "有种让大家自动放慢、自动不吵架的奇妙松弛感",
        "ability": "情绪缓冲和团体安抚",
        "scene_id": "beach",
        "scene_name": "蔚蓝海滩",
        "traits": ["平和", "佛系", "稳重", "不抢不急"],
        "skills": [
            ["温泉缓冲", "把急躁的气氛慢慢降下来，让队伍重新同步。"],
            ["慢慢看岸", "不着急冲刺，反而更能看见隐藏的小线索。"],
            ["圆脸和解", "只要它待在旁边，大家就更愿意心平气和说话。"],
        ],
    },
    "萨摩耶": {
        "id": "bc2_samoyed",
        "emoji": "🐕",
        "rarity": "rare",
        "stats": [106, 6, 5, 6],
        "origin": "雪团欢迎屋",
        "school": "笑脸接待课",
        "work": "笑脸迎宾员",
        "hobby": "对每个人摇尾巴、帮忙叼小旗、在门口练习招呼声",
        "specialty": "只要它一出现，场面就会立刻明亮起来",
        "ability": "氛围点亮和迎新鼓劲",
        "scene_id": "mountain",
        "scene_name": "雪山之巅",
        "traits": ["热情", "明亮", "大方", "有感染力"],
        "skills": [
            ["笑脸开场", "让刚开始还有点拘谨的伙伴很快放松下来。"],
            ["白团冲锋", "带着软乎乎的气势往前跑，特别会提振士气。"],
            ["迎风招呼", "在冷风里也能把欢迎感稳稳送到别人面前。"],
        ],
    },
}

NAME_ID_MAP = {
    "阿拉斯加": "bc2_alaskan",
    "比熊": "bc2_bichon",
    "冰晶恐龙": "bc2_crystal_dino",
    "布偶": "bc2_ragdoll",
    "仓鼠": "bc2_hamster",
    "刺猬": "bc2_hedgehog",
    "海豚": "bc2_dolphin",
    "狐狸": "bc2_fox",
    "蝴蝶": "bc2_butterfly",
    "金毛": "bc2_golden",
    "金丝猴": "bc2_golden_monkey",
    "锦鲤": "bc2_koi",
    "橘猫": "bc2_orange_cat",
    "柯基": "bc2_corgi",
    "蓝猫": "bc2_blue_cat",
    "企鹅": "bc2_penguin",
    "狮子": "bc2_lion",
    "兔子": "bc2_bunny",
    "乌龟": "bc2_turtle",
    "熊猫": "bc2_panda",
    "羊驼": "bc2_alpaca",
    "银渐层": "bc2_silver_shaded",
    "白蛇": "bc2_white_snake",
    "边牧": "bc2_border_collie",
    "博美": "bc2_pomeranian",
    "大象": "bc2_elephant",
    "德牧": "bc2_german_shepherd",
    "凤凰": "bc2_phoenix",
    "金渐层": "bc2_golden_shaded",
    "九尾狐": "bc2_nine_tailed_fox",
    "卡皮巴拉": "bc2_capybara",
    "狸花猫": "bc2_tabby_cat",
    "美短": "bc2_american_shorthair",
    "奶牛猫": "bc2_cow_cat",
    "萨摩耶": "bc2_samoyed",
    "三花猫": "bc2_calico_cat",
    "蜗牛": "bc2_snail",
    "蜥蜴": "bc2_lizard",
    "雪纳瑞": "bc2_schnauzer",
    "鹦鹉": "bc2_parrot",
}

DOG_NAMES = {"阿拉斯加", "比熊", "金毛", "柯基", "边牧", "博美", "德牧", "萨摩耶", "雪纳瑞"}
CAT_NAMES = {"布偶", "橘猫", "蓝猫", "银渐层", "金渐层", "狸花猫", "美短", "奶牛猫", "三花猫"}
SMALL_NAMES = {"仓鼠", "刺猬", "兔子", "蜗牛"}
AQUATIC_NAMES = {"海豚", "锦鲤", "企鹅", "乌龟"}
WILD_NAMES = {"狐狸", "金丝猴", "狮子", "熊猫", "羊驼", "大象"}
REPTILE_NAMES = {"白蛇", "蜥蜴"}
WING_NAMES = {"蝴蝶", "鹦鹉"}
MYTHIC_NAMES = {"冰晶恐龙", "凤凰", "九尾狐"}
SPECIAL_ARCHETYPES = {"卡皮巴拉": "capybara"}

EMOJI_OVERRIDES = {
    "阿拉斯加": "🐺",
    "比熊": "🐶",
    "冰晶恐龙": "🦖",
    "布偶": "🐱",
    "仓鼠": "🐹",
    "刺猬": "🦔",
    "海豚": "🐬",
    "狐狸": "🦊",
    "蝴蝶": "🦋",
    "金毛": "🐕",
    "金丝猴": "🐒",
    "锦鲤": "🐟",
    "橘猫": "🐈",
    "柯基": "🐕",
    "蓝猫": "🐈",
    "企鹅": "🐧",
    "狮子": "🦁",
    "兔子": "🐇",
    "乌龟": "🐢",
    "熊猫": "🐼",
    "羊驼": "🦙",
    "银渐层": "🐈",
    "白蛇": "🐍",
    "边牧": "🐕",
    "博美": "🐶",
    "大象": "🐘",
    "德牧": "🐕",
    "凤凰": "🪽",
    "金渐层": "🐈",
    "九尾狐": "🦊",
    "卡皮巴拉": "🦫",
    "狸花猫": "🐈",
    "美短": "🐈",
    "奶牛猫": "🐈",
    "萨摩耶": "🐕",
    "三花猫": "🐈",
    "蜗牛": "🐌",
    "蜥蜴": "🦎",
    "雪纳瑞": "🐕",
    "鹦鹉": "🦜",
}

RARITY_OVERRIDES = {
    "比熊": "common",
    "仓鼠": "common",
    "刺猬": "common",
    "橘猫": "common",
    "柯基": "common",
    "兔子": "common",
    "蜗牛": "common",
    "蓝猫": "rare",
    "金丝猴": "rare",
    "锦鲤": "rare",
    "乌龟": "rare",
    "白蛇": "epic",
    "边牧": "epic",
    "大象": "epic",
    "狮子": "epic",
    "熊猫": "epic",
    "冰晶恐龙": "legendary",
    "凤凰": "legendary",
    "九尾狐": "legendary",
}

ARCHETYPE_DEFAULT_RARITY = {
    "dog": "rare",
    "cat": "rare",
    "small": "common",
    "aquatic": "rare",
    "wild": "rare",
    "reptile": "rare",
    "wing": "rare",
    "mythic": "epic",
    "capybara": "rare",
}

ARCHETYPE_BASE_STATS = {
    "dog": [102, 6, 5, 6],
    "cat": [98, 6, 4, 6],
    "small": [86, 5, 3, 7],
    "aquatic": [102, 6, 5, 5],
    "wild": [108, 7, 6, 5],
    "reptile": [96, 6, 5, 5],
    "wing": [92, 6, 4, 8],
    "mythic": [114, 8, 6, 7],
    "capybara": [118, 5, 6, 4],
}

RARITY_BONUS = {
    "common": [0, 0, 0, 0],
    "rare": [6, 1, 1, 0],
    "epic": [12, 2, 2, 1],
    "legendary": [18, 3, 2, 2],
}

ARCHETYPE_PROFILES = {
    "dog": {
        "default_emoji": "🐕",
        "origins": ["风铃跑道站", "暖阳陪跑坡", "晨雾巡游路"],
        "schools": ["同行陪伴班", "节奏训练课", "巡场服务班"],
        "works": ["队伍陪跑员", "同行守望员", "迎风接应员"],
        "hobbies": ["陪孩子跑步、叼回散落的小旗和球", "帮队友看包、巡看路线、在草地上练习转弯", "追着晨风练冲刺、给新朋友送欢迎信"],
        "specialties": ["稳定陪伴和队伍照看", "在长路和热闹场面里稳住全队节奏", "很快发现谁需要鼓劲或提醒"],
        "abilities": ["队伍陪跑和即时接应", "长距离护送和鼓劲", "边跑边看顾全队状态"],
        "scenes": [("forest", "神秘森林"), ("beach", "蔚蓝海滩"), ("mountain", "雪山之巅")],
        "traits": ["可靠", "热情", "会照顾人", "执行快", "有安全感", "不轻易掉线"],
        "skills": [
            ["同行摆尾", "用热情回应把队伍的犹豫感一扫而空。"],
            ["巡路回看", "一边前进一边确认没有同伴掉队，也不会漏掉重要线索。"],
            ["迎风接应", "在大家需要鼓劲的时候，第一时间冲到最前面接应。"],
        ],
    },
    "cat": {
        "default_emoji": "🐈",
        "origins": ["午后窗台馆", "绒尾观察室", "月雾梳毛屋"],
        "schools": ["抱抱研究社", "绒光礼仪课", "安静观察班"],
        "works": ["陪读观察员", "窗台值日生", "绒尾整理师"],
        "hobbies": ["趴在书页边打呼噜、陪人翻绘本", "整理尾巴、巡看镜面、帮同伴梳顺炸毛", "晒着暖光慢悠悠巡视窗边和花盆"],
        "specialties": ["让周围节奏自然慢下来，适合陪读和安抚情绪", "把乱糟糟的状态重新整理回体面和安定", "用轻柔陪伴把大家带回舒服的专注感"],
        "abilities": ["舒缓专注和温柔陪读", "秩序整理和细节照看", "把紧绷气氛慢慢放松下来"],
        "scenes": [("waterfall", "彩虹瀑布"), ("castle", "云端城堡"), ("forest", "神秘森林")],
        "traits": ["温柔", "从容", "会照顾情绪", "有分寸", "细腻", "松弛"],
        "skills": [
            ["软垫守页", "把阅读和观察时光稳稳托住，不让节奏散掉。"],
            ["绒尾整理", "把毛发、补给和情绪一起梳顺，重新找回秩序。"],
            ["呼噜安眠", "用安静又稳定的呼噜声慢慢平复紧张感。"],
        ],
    },
    "small": {
        "default_emoji": "🐾",
        "origins": ["种子口袋坊", "齿轮储备仓", "铃兰跳跳田"],
        "schools": ["小小整理课", "轻跃训练班", "微光观察课"],
        "works": ["补给小帮手", "轻步探路员", "口袋整理员"],
        "hobbies": ["囤小种子、排点心、检查口袋有没有破洞", "跳过石阶、闻草叶、把找到的小物件收进安全角落", "沿着小路碎步巡查，把散落的线索一件件带回来"],
        "specialties": ["动作轻快又细心，最适合做小范围探路和善后整理", "能把零碎的小东西收得很稳，不怕临时找不到", "在别人不注意的角落里先一步发现线索"],
        "abilities": ["快速整理和轻步回收", "轻盈侦查和小件补给", "碎步巡查和细节发现"],
        "scenes": [("forest", "神秘森林"), ("cave", "水晶洞窟"), ("beach", "蔚蓝海滩")],
        "traits": ["机灵", "勤快", "爱储备", "反应快", "认真", "停不下来"],
        "skills": [
            ["碎步巡查", "用轻快脚程把零碎线索一件件巡回来。"],
            ["口袋补给", "把小补给藏在最顺手的位置，临时需要时反应特别快。"],
            ["轻跳探路", "先一步跳过石阶和窄缝，把安全路线试出来。"],
        ],
    },
    "aquatic": {
        "default_emoji": "🐬",
        "origins": ["潮汐栈桥湾", "水纹练习池", "珊瑚回响口"],
        "schools": ["水纹协作班", "潮声引路课", "漂流观察社"],
        "works": ["潮汐巡看员", "水路引导员", "海湾记录生"],
        "hobbies": ["在水边绕圈巡看、记录浪花和漂流物的位置", "陪伙伴练习下水和靠岸、熟悉潮汐节奏", "整理水边收来的贝壳和光亮石子"],
        "specialties": ["很会看水流和环境变化，适合在移动路线里做引导", "能把散开的队伍重新带回同一节奏", "在水边和风口环境里保持冷静观察"],
        "abilities": ["潮汐判断和水路引导", "在湿滑环境里稳住节奏", "用流动感把队伍重新同步"],
        "scenes": [("underwater", "珊瑚王国"), ("beach", "蔚蓝海滩"), ("waterfall", "彩虹瀑布")],
        "traits": ["冷静", "流畅", "会观察", "节奏稳", "适应力强", "不怕环境变化"],
        "skills": [
            ["潮汐引线", "先读懂环境变化，再把伙伴带向更安全顺手的路线。"],
            ["水纹回响", "用稳定的移动节奏把散开的队伍重新拉回同步。"],
            ["浪尖提醒", "一有细小变化就及时提醒，最适合在动态环境里护航。"],
        ],
    },
    "wild": {
        "default_emoji": "🐾",
        "origins": ["山风观察谷", "高地守望坡", "野趣巡场线"],
        "schools": ["野趣探索课", "高地巡看班", "山路记忆社"],
        "works": ["高地观察员", "山路守望生", "野外引导员"],
        "hobbies": ["沿着山路巡看爪印、回头确认小队有没有落下", "收集路边石片和枝叶，记住每一段地形变化", "在高地练习稳步转身和远距离观察"],
        "specialties": ["视野开阔，特别适合做山路和开阔地带的观察员", "在陌生环境里也能很快记住路线和节奏", "力量感和耐心兼备，能撑起队伍的安全感"],
        "abilities": ["高地巡看和路线守望", "陌生环境快速适应", "把开阔地形变成可读地图"],
        "scenes": [("mountain", "雪山之巅"), ("forest", "神秘森林"), ("desert", "沙漠绿洲")],
        "traits": ["稳重", "有耐力", "看得远", "护着同伴", "不怕路难", "会判断"],
        "skills": [
            ["高地回看", "在开阔地形里快速扫清全队位置，不让同伴掉线。"],
            ["山路稳步", "越是复杂的路况，越能保持可靠又清楚的节奏。"],
            ["远望定向", "靠耐心和视野把零散线索慢慢拼回完整路线。"],
        ],
    },
    "reptile": {
        "default_emoji": "🐍",
        "origins": ["暖岩静坡", "石阶回音洞", "砂纹观察台"],
        "schools": ["耐心观察课", "静步巡看班", "岩纹记忆社"],
        "works": ["暖岩巡看员", "静步观察生", "石阶守位员"],
        "hobbies": ["沿着石阶慢慢巡看，把温热和阴凉的位置记在心里", "趴在暖岩边安静观察风向、脚印和细小动静", "把找到的小石片排成记忆线，方便之后回看路线"],
        "specialties": ["动作不算张扬，却很会在安静环境里捕捉细节", "特别适合蹲守和长时间观察，不容易被打乱节奏", "对冷热变化和地形缝隙的感知很敏锐"],
        "abilities": ["静步蹲守和细节捕捉", "暖岩环境适应", "沿着痕迹慢慢还原路线"],
        "scenes": [("cave", "水晶洞窟"), ("desert", "沙漠绿洲"), ("castle", "云端城堡")],
        "traits": ["安静", "敏锐", "耐心", "节制", "会埋伏观察", "不爱浪费力气"],
        "skills": [
            ["静步贴岩", "把动静压到最轻，在复杂环境里先听见别人听不到的信号。"],
            ["暖岩留痕", "通过地面留下的细小痕迹判断谁刚经过这里。"],
            ["缓拍锁定", "不急着出手，而是先把环境和线索全部看清。"],
        ],
    },
    "wing": {
        "default_emoji": "🪽",
        "origins": ["风羽回音塔", "云边停栖台", "轻翅观景桥"],
        "schools": ["空巡练习班", "回声传讯课", "轻羽观察社"],
        "works": ["天际传讯员", "高处巡看生", "轻翅引路员"],
        "hobbies": ["沿着高处回廊练习转身、把远处变化先记下来", "收集羽片和小风铃，记录哪里的风最顺", "在高处练习喊声和回响，确认消息能传多远"],
        "specialties": ["视角高、反应快，适合做远距离提醒和传讯", "一旦离开地面视角，就更容易看懂队伍该往哪边走", "能把轻盈感变成很稳的路线提示"],
        "abilities": ["高处观察和空中提醒", "远距离传讯", "轻盈转向和路线预判"],
        "scenes": [("castle", "云端城堡"), ("space", "太空站"), ("stargarden", "星光花园")],
        "traits": ["机敏", "轻快", "看得远", "擅长传讯", "很会预判", "带点浪漫感"],
        "skills": [
            ["风羽传讯", "先一步把远处动静转成队伍听得懂的提醒。"],
            ["高空回看", "从更高视角重新整理路线，不容易被局部混乱带偏。"],
            ["轻翅转向", "一旦发现前路不顺，就能快速给出更轻巧的替代路线。"],
        ],
    },
    "mythic": {
        "default_emoji": "✨",
        "origins": ["星辉灵境台", "霜光巡礼门", "云焰守望庭"],
        "schools": ["灵兽巡礼班", "星野守望课", "古纹观察社"],
        "works": ["灵境守望员", "星辉引导生", "巡礼记录官"],
        "hobbies": ["在有光的地方练习静立和远望，把风向和气息变化都记下来", "巡看古纹与云影，确认哪里还留着昨日的线索", "把观察到的亮点和足迹写成一份份可回看的记录"],
        "specialties": ["辨识度极高，适合做整册里的压轴观察对象", "常能把复杂的环境整理出清楚的主线感", "不仅强，还很会把队伍的注意力重新拉回正确方向"],
        "abilities": ["灵境观察和压轴引导", "把复杂现场整理出主线", "让队伍在高压环境里仍保持判断力"],
        "scenes": [("stargarden", "星光花园"), ("castle", "云端城堡"), ("mountain", "雪山之巅")],
        "traits": ["有气场", "判断准", "沉着", "带队感强", "辨识度高", "压场但不冷硬"],
        "skills": [
            ["灵光定线", "在最复杂的场面里先把真正重要的线索点亮。"],
            ["巡礼回响", "把散乱的动静重新整理成一条能跟上的主线。"],
            ["守望压场", "越是关键时刻，越能稳住全队的判断和胆量。"],
        ],
    },
    "capybara": {
        "default_emoji": "🦫",
        "origins": ["温泉慢慢湾", "河畔放空桥", "暖石休息埠"],
        "schools": ["和气相处课", "慢节奏观察班", "河岸陪伴社"],
        "works": ["河畔和气员", "温泉等候生", "暖岸安抚员"],
        "hobbies": ["泡温水、陪朋友发呆、把岸边小石头排整齐", "沿着河岸慢慢散步，顺手把零散小物摆回原位", "在大家急躁时默默待在旁边，让气氛自己慢下来"],
        "specialties": ["有种让大家自动放慢、自动不吵架的奇妙松弛感", "特别适合做团队里的缓冲带，让每个人都重新同步下来", "越是不争不抢，越能把细小线索留在大家眼里"],
        "abilities": ["情绪缓冲和团体安抚", "把快节奏慢慢拉回平和状态", "在松弛氛围里放大细节观察力"],
        "scenes": [("beach", "蔚蓝海滩"), ("waterfall", "彩虹瀑布"), ("forest", "神秘森林")],
        "traits": ["平和", "佛系", "稳重", "不抢不急", "气氛好", "松弛感强"],
        "skills": [
            ["温泉缓冲", "把急躁气氛慢慢降下来，让队伍重新同步。"],
            ["慢慢看岸", "不着急冲刺，反而更能看见隐藏的小线索。"],
            ["圆脸和解", "只要它待在旁边，大家就更愿意心平气和说话。"],
        ],
    },
}


def stable_pick(name: str, options: list) -> object:
    return options[sum(ord(ch) for ch in name) % len(options)]


def rotate_pick(name: str, options: list[str], count: int) -> list[str]:
    start = sum(ord(ch) for ch in name) % len(options)
    doubled = options + options
    return doubled[start : start + count]


def classify_pet(name: str) -> str:
    if name in SPECIAL_ARCHETYPES:
        return SPECIAL_ARCHETYPES[name]
    if name in DOG_NAMES:
        return "dog"
    if name in CAT_NAMES:
        return "cat"
    if name in SMALL_NAMES:
        return "small"
    if name in AQUATIC_NAMES:
        return "aquatic"
    if name in REPTILE_NAMES:
        return "reptile"
    if name in WING_NAMES:
        return "wing"
    if name in MYTHIC_NAMES:
        return "mythic"
    if name in WILD_NAMES:
        return "wild"
    raise KeyError(f"missing archetype for pet: {name}")


def build_stats(archetype: str, rarity: str) -> list[int]:
    base = ARCHETYPE_BASE_STATS[archetype]
    bonus = RARITY_BONUS[rarity]
    return [base[i] + bonus[i] for i in range(4)]


def build_pet_meta(name: str) -> dict:
    if name in PET_META_OVERRIDES:
        return PET_META_OVERRIDES[name]
    if name not in NAME_ID_MAP:
        raise KeyError(f"missing id mapping for pet: {name}")

    archetype = classify_pet(name)
    profile = ARCHETYPE_PROFILES[archetype]
    rarity = RARITY_OVERRIDES.get(name, ARCHETYPE_DEFAULT_RARITY[archetype])
    scene_id, scene_name = stable_pick(name, profile["scenes"])

    return {
        "id": NAME_ID_MAP[name],
        "emoji": EMOJI_OVERRIDES.get(name, profile["default_emoji"]),
        "rarity": rarity,
        "stats": build_stats(archetype, rarity),
        "origin": stable_pick(name, profile["origins"]),
        "school": stable_pick(name, profile["schools"]),
        "work": stable_pick(name, profile["works"]),
        "hobby": stable_pick(name, profile["hobbies"]),
        "specialty": stable_pick(name, profile["specialties"]),
        "ability": stable_pick(name, profile["abilities"]),
        "scene_id": scene_id,
        "scene_name": scene_name,
        "traits": rotate_pick(name, profile["traits"], 4),
        "skills": profile["skills"],
    }


def http_json(url: str, token: str) -> object:
    headers = {
        "Authorization": f"Bearer {token}",
        "Referer": f"{BASE_URL}/parent",
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0",
    }
    req = request.Request(url, headers=headers)
    with request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    if payload.get("code") != 200 or not payload.get("success"):
        raise RuntimeError(f"API failed for {url}: {payload}")
    return payload.get("data")


def http_image(url: str, token: str) -> bytes:
    headers = {
        "Authorization": f"Bearer {token}",
        "Referer": f"{BASE_URL}/parent",
        "User-Agent": "Mozilla/5.0",
    }
    req = request.Request(url, headers=headers)
    with request.urlopen(req, timeout=30) as resp:
        return resp.read()


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def replace_level_url(base_asset_url: str, level: int) -> str:
    prefix, _, tail = base_asset_url.rpartition("/")
    _, dot, ext = tail.partition(".")
    if not prefix or not dot:
        raise ValueError(f"unsupported asset path: {base_asset_url}")
    raw_path = f"{prefix}/{level}.{ext}"
    return f"{BASE_URL}{parse.quote(raw_path)}"


def snapshot_source_catalog(token: str) -> tuple[list[dict], list[dict]]:
    animals = http_json(f"{BASE_URL}/api/pets", token)
    levels = http_json(f"{BASE_URL}/api/pets/levels", token)
    animal_rows = [row for row in animals if row.get("category") == "ANIMAL"]
    write_json(ANIMALS_SNAPSHOT, animal_rows)
    write_json(LEVELS_SNAPSHOT, levels)
    return animal_rows, levels


def load_source_animals() -> list[dict]:
    if not ANIMALS_SNAPSHOT.exists():
        raise FileNotFoundError("missing animals snapshot; run with BANCHONG2_TOKEN first")
    return json.loads(ANIMALS_SNAPSHOT.read_text(encoding="utf-8"))


def build_lore(meta: dict, pet_name: str) -> dict:
    codex_title = meta["work"]
    subtitle = f"{meta['school']}结业生 · {meta['scene_name']}常驻伙伴"
    intro = f"{pet_name}是{BOOKLET_NAME}里很有辨识度的一位伙伴，擅长{meta['specialty']}。"
    childhood = f"小时候的{pet_name}总在{meta['origin']}附近练习{meta['hobby'].split('、')[0]}，也是那里最早学会照顾同伴的小家伙之一。"
    story = (
        f"{pet_name}来自{meta['origin']}，小时候在{meta['school']}里最爱练习{meta['hobby']}。"
        f"长大后，它成了{meta['work']}，负责{meta['specialty']}。"
        f"平时它最喜欢{meta['hobby']}，也因此练出了{meta['ability']}。"
        f"每次队伍里有人着急、掉队或情绪低下来，{pet_name}总会先靠过去，用自己的节奏把大家重新带回舒服又有力量的状态。"
    )
    return {
        "galleryId": "adventure",
        "codexTitle": codex_title,
        "subtitle": subtitle,
        "intro": intro,
        "origin": meta["origin"],
        "childhood": childhood,
        "school": meta["school"],
        "work": meta["work"],
        "hobby": meta["hobby"],
        "specialty": meta["specialty"],
        "ability": meta["ability"],
        "sceneId": meta["scene_id"],
        "sceneName": meta["scene_name"],
        "story": story,
        "traits": meta["traits"],
        "skills": [{"name": name, "desc": desc} for name, desc in meta["skills"]],
    }


def build_pet_entries(selected_rows: list[dict]) -> tuple[list[dict], list[dict], list[dict]]:
    flat_entries: list[dict] = []
    series_entries: list[dict] = []
    lore_entries: list[dict] = []

    for row in selected_rows:
        name = row["name"]
        meta = build_pet_meta(name)
        stage_paths = []
        stage_map = {}
        for stage_index, level in enumerate(LEVEL_MAP):
            rel_path = f"assets/{SOURCE_ID}/{SERIES_NAME}/{name}-{stage_index}.webp"
            stage_paths.append(rel_path)
            stage_map[str(stage_index)] = rel_path

        hp, atk, defense, spd = meta["stats"]
        series_pet = {
            "id": meta["id"],
            "name": name,
            "emoji": meta["emoji"],
            "series": SERIES_NAME,
            "rarity": meta["rarity"],
            "desc": f"{BOOKLET_NAME}宠物",
            "base_hp": hp,
            "base_atk": atk,
            "source": SOURCE_ID,
            "stages": [{"stage": i, "imageUrl": path} for i, path in enumerate(stage_paths)],
        }
        flat_pet = {
            **series_pet,
            "base_def": defense,
            "base_spd": spd,
            "imageUrl": stage_paths[2],
            "imageStages": stage_map,
            "imageStyle": "banchong",
        }
        lore_entry = {
            "id": meta["id"],
            "name": name,
            "series": SERIES_NAME,
            "source": SOURCE_ID,
            "rarity": meta["rarity"],
            **build_lore(meta, name),
        }
        series_entries.append(series_pet)
        flat_entries.append(flat_pet)
        lore_entries.append(lore_entry)

    return series_entries, flat_entries, lore_entries


def write_assets(selected_rows: list[dict], token: str) -> list[dict]:
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    manifest_rows = []
    for row in selected_rows:
        name = row["name"]
        meta = build_pet_meta(name)
        stages = []
        for stage_index, level in enumerate(LEVEL_MAP):
            asset_url = replace_level_url(row["baseAssetUrl"], level)
            output_path = ASSET_DIR / f"{name}-{stage_index}.webp"
            if not output_path.exists() or output_path.stat().st_size == 0:
                raw = http_image(asset_url, token)
                image = Image.open(io.BytesIO(raw))
                converted = image.convert("RGBA")
                converted.save(output_path, format="WEBP", quality=88, method=6)
            stages.append(
                {
                    "stage": stage_index,
                    "sourceLevel": level,
                    "sourceUrl": asset_url,
                    "localPath": f"assets/{SOURCE_ID}/{SERIES_NAME}/{name}-{stage_index}.webp",
                }
            )
        manifest_rows.append(
            {
                "id": meta["id"],
                "sourcePetId": row["id"],
                "name": name,
                "series": SERIES_NAME,
                "source": SOURCE_ID,
                "maxLevel": row["maxLevel"],
                "mappedLevels": LEVEL_MAP,
                "stages": stages,
            }
        )
    write_json(MANIFEST_PATH, manifest_rows)
    return manifest_rows


def update_pets_json(series_entries: list[dict], flat_entries: list[dict]) -> None:
    db = json.loads(PETS_JSON.read_text(encoding="utf-8"))
    series = db.get("series") or {}
    flat = db.get("flat") or []

    flat = [pet for pet in flat if pet.get("source") != SOURCE_ID]
    flat.extend(flat_entries)

    series[SERIES_NAME] = {
        "name": SERIES_NAME,
        "count": len(series_entries),
        "pets": series_entries,
    }

    db["series"] = series
    db["flat"] = flat
    db["total"] = len(flat)
    db.setdefault("sources", {})
    db["sources"][SOURCE_ID] = f"班宠乐园2 动物 {len(flat_entries)} 种"

    write_json(PETS_JSON, db)


def update_lore_json(lore_entries: list[dict]) -> None:
    db = json.loads(LORE_JSON.read_text(encoding="utf-8"))
    pets = db.get("pets") or []
    pets = [pet for pet in pets if pet.get("source") != SOURCE_ID]
    pets.extend(lore_entries)
    db["pets"] = pets
    db["generatedAt"] = datetime.now(timezone.utc).isoformat()
    write_json(LORE_JSON, db)


def main() -> None:
    token = os.environ.get("BANCHONG2_TOKEN", "").strip()

    if token:
        animals, levels = snapshot_source_catalog(token)
    else:
        animals = load_source_animals()
        levels = json.loads(LEVELS_SNAPSHOT.read_text(encoding="utf-8"))

    level_values = [row.get("level") for row in levels]
    if level_values != list(range(1, 11)):
        raise RuntimeError(f"unexpected levels payload: {level_values}")

    selected_rows = []
    for row in animals:
        name = row["name"]
        build_pet_meta(name)
        selected_rows.append(row)

    if token:
        write_assets(selected_rows, token)
    elif not MANIFEST_PATH.exists():
        raise FileNotFoundError("missing import manifest and no BANCHONG2_TOKEN was provided")

    series_entries, flat_entries, lore_entries = build_pet_entries(selected_rows)
    update_pets_json(series_entries, flat_entries)
    update_lore_json(lore_entries)

    print(
        json.dumps(
            {
                "imported": len(flat_entries),
                "series": SERIES_NAME,
                "booklet": BOOKLET_NAME,
                "source": SOURCE_ID,
                "levels": LEVEL_MAP,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
