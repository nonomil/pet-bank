from __future__ import annotations

import argparse
import io
import json
import os
import random
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib import parse, request

from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[1]
PETS_JSON = REPO_ROOT / "data" / "pets.json"
LORE_JSON = REPO_ROOT / "data" / "pokedex-lore-draft.json"
SNAPSHOT_DIR = REPO_ROOT / "data" / "source-snapshots"
PLANTS_SNAPSHOT = SNAPSHOT_DIR / "banchong2-plants.json"
LEVELS_SNAPSHOT = SNAPSHOT_DIR / "banchong2-levels.json"
MANIFEST_PATH = SNAPSHOT_DIR / "banchong2-plants-import-manifest.json"
ASSET_DIR = REPO_ROOT / "assets" / "banchong2" / "甜芽花园族"

BASE_URL = "https://daydayupjfgl.com"
SOURCE_ID = "banchong2_plant"
ORIGIN_SOURCE = "banchong2"
SERIES_NAME = "甜芽花园族"
BOOKLET_NAME = "甜芽花园册"
GALLERY_ID = "sunshine"
LEVEL_MAP = [1, 2, 4, 6, 8, 10]
DEFAULT_CATALOG = Path(tempfile.gettempdir()) / "daydayup-pets-api.json"


PLANT_PROFILES = {
    "flower": {
        "school": "晨露花语班",
        "work": "花圃迎光员",
        "origin_suffix": "花语坡",
        "hobby": "收集露珠、整理花瓣、给伙伴准备香香贴纸",
        "specialty": "用明亮花色和温柔节奏把大家带回好心情",
        "ability": "情绪安抚和花香鼓励",
        "traits": ["明亮", "温柔", "爱整理", "会鼓励"],
        "skills": [
            ("晨露点名", "用一滴亮晶晶的露珠提醒大家开始今天的小目标。"),
            ("花瓣鼓掌", "把细碎花瓣轻轻扬起，让完成任务的伙伴得到小小掌声。"),
            ("香气休息", "在紧张时送出柔和香气，帮队伍慢慢放松下来。"),
        ],
    },
    "fruit": {
        "school": "甜果补给班",
        "work": "果园能量师",
        "origin_suffix": "甜果湾",
        "hobby": "清点果篮、准备点心、把奖励贴纸摆成小山",
        "specialty": "把努力后的奖励变得具体又有仪式感",
        "ability": "补给规划和奖励提醒",
        "traits": ["甜暖", "慷慨", "元气", "很会庆祝"],
        "skills": [
            ("甜果补给", "把今日努力变成一份小补给，让伙伴有继续前进的力气。"),
            ("果篮清点", "快速整理奖励和道具，避免开心时漏掉任何收获。"),
            ("闪闪糖分", "在完成难题后送出一点甜味，让成就感停留久一点。"),
        ],
    },
    "tree": {
        "school": "年轮观察班",
        "work": "成长记录员",
        "origin_suffix": "年轮庭",
        "hobby": "记录身高刻度、收藏落叶、给成长日记盖章",
        "specialty": "把每天一点点进步稳稳记录下来",
        "ability": "长期陪伴和成长复盘",
        "traits": ["稳重", "耐心", "可靠", "记性好"],
        "skills": [
            ("年轮刻度", "把今天的努力刻成一圈小小年轮，提醒大家进步正在发生。"),
            ("树荫复盘", "在安静树荫下回看错题和收获，让下一次更有把握。"),
            ("落叶书签", "用一片叶子标记重要时刻，方便以后重新找到成长证据。"),
        ],
    },
    "crop": {
        "school": "田埂行动班",
        "work": "小田任务员",
        "origin_suffix": "金穗田",
        "hobby": "数小苗、排任务格、把今日清单贴到木牌上",
        "specialty": "把大目标拆成一格一格的小任务",
        "ability": "任务拆解和坚持提醒",
        "traits": ["踏实", "勤快", "有条理", "不怕重复"],
        "skills": [
            ("田格计划", "把复杂任务切成几块小田格，一块一块完成。"),
            ("金穗提醒", "在伙伴想放弃时轻轻摇一摇，提醒还差最后一点。"),
            ("丰收贴纸", "每完成一格任务，就贴上一枚小小丰收贴。"),
        ],
    },
    "quirky": {
        "school": "奇芽观察班",
        "work": "奇趣守护员",
        "origin_suffix": "奇芽角",
        "hobby": "观察小刺、卷起藤蔓、把害羞心情藏进叶子里",
        "specialty": "用独特外形提醒大家每个伙伴都可以不一样",
        "ability": "边界保护和独特观察",
        "traits": ["特别", "敏感", "有边界", "观察细"],
        "skills": [
            ("奇芽侦察", "用不一样的角度发现别人忽略的小线索。"),
            ("小刺边界", "温柔提醒大家保持距离和节奏，不急着靠太近。"),
            ("卷叶避风", "在情绪太满时卷起一片叶子，给伙伴留出安静空间。"),
        ],
    },
}


PLANT_META = {
    "波斯菊": {"slug": "cosmos", "emoji": "🌸", "kind": "flower", "rarity": "common"},
    "草莓": {"slug": "strawberry", "emoji": "🍓", "kind": "fruit", "rarity": "common"},
    "含羞草": {"slug": "mimosa", "emoji": "🌿", "kind": "quirky", "rarity": "rare"},
    "葫芦": {"slug": "gourd", "emoji": "🍈", "kind": "quirky", "rarity": "common"},
    "金桔": {"slug": "kumquat", "emoji": "🍊", "kind": "fruit", "rarity": "common"},
    "牡丹": {"slug": "peony", "emoji": "🌺", "kind": "flower", "rarity": "rare"},
    "蒲公英": {"slug": "dandelion", "emoji": "🌼", "kind": "flower", "rarity": "common"},
    "千禧果": {"slug": "cherry_tomato", "emoji": "🍅", "kind": "fruit", "rarity": "common"},
    "柿子树": {"slug": "persimmon_tree", "emoji": "🌳", "kind": "tree", "rarity": "rare"},
    "仙人球": {"slug": "cactus_ball", "emoji": "🌵", "kind": "quirky", "rarity": "rare"},
    "向日葵": {"slug": "sunflower", "emoji": "🌻", "kind": "flower", "rarity": "common"},
    "绣球花": {"slug": "hydrangea", "emoji": "💠", "kind": "flower", "rarity": "rare"},
    "樱桃": {"slug": "cherry", "emoji": "🍒", "kind": "fruit", "rarity": "common"},
    "银杏树": {"slug": "ginkgo_tree", "emoji": "🍂", "kind": "tree", "rarity": "rare"},
    "竹子": {"slug": "bamboo", "emoji": "🎋", "kind": "tree", "rarity": "rare"},
    "榴莲": {"slug": "durian", "emoji": "🍈", "kind": "fruit", "rarity": "epic"},
    "芒果": {"slug": "mango", "emoji": "🥭", "kind": "fruit", "rarity": "common"},
    "苹果": {"slug": "apple", "emoji": "🍎", "kind": "fruit", "rarity": "common"},
    "葡萄": {"slug": "grape", "emoji": "🍇", "kind": "fruit", "rarity": "common"},
    "桃子": {"slug": "peach", "emoji": "🍑", "kind": "fruit", "rarity": "common"},
    "西瓜": {"slug": "watermelon", "emoji": "🍉", "kind": "fruit", "rarity": "common"},
    "香蕉": {"slug": "banana", "emoji": "🍌", "kind": "fruit", "rarity": "common"},
    "玉米": {"slug": "corn", "emoji": "🌽", "kind": "crop", "rarity": "common"},
}

RARITY_BONUS = {
    "common": (0, 0, 0, 0),
    "rare": (8, 1, 1, 1),
    "epic": (16, 2, 1, 2),
}
KIND_BASE_STATS = {
    "flower": (92, 5, 4, 6),
    "fruit": (96, 5, 3, 6),
    "tree": (112, 4, 7, 3),
    "crop": (104, 5, 5, 4),
    "quirky": (98, 5, 6, 5),
}


def write_json(path: Path, data: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_json(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def load_catalog(catalog_path: Path) -> list[dict]:
    if catalog_path.exists():
        payload = read_json(catalog_path)
        rows = payload.get("data", payload) if isinstance(payload, dict) else payload
        if not isinstance(rows, list):
            raise TypeError(f"catalog must be a list or API envelope: {catalog_path}")
        plants = [row for row in rows if row.get("category") == "PLANT"]
        if plants:
            return plants

    if PLANTS_SNAPSHOT.exists():
        return read_json(PLANTS_SNAPSHOT)

    raise FileNotFoundError(
        f"missing plant catalog. Expected {catalog_path} or {PLANTS_SNAPSHOT}"
    )


def replace_level_url(base_asset_url: str, level: int) -> str:
    prefix, _, tail = base_asset_url.rpartition("/")
    _, dot, ext = tail.partition(".")
    if not prefix or not dot:
        raise ValueError(f"unsupported asset path: {base_asset_url}")
    raw_path = f"{prefix}/{level}.{ext}"
    return f"{BASE_URL}{parse.quote(raw_path)}"


def http_image(url: str) -> bytes:
    headers = {
        "Referer": f"{BASE_URL}/parent",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0",
    }
    req = request.Request(url, headers=headers)
    with request.urlopen(req, timeout=30) as resp:
        return resp.read()


def sleep_between(delay: float, jitter: float) -> None:
    wait = max(0.0, delay + random.uniform(0.0, max(0.0, jitter)))
    if wait:
        time.sleep(wait)


def build_meta(name: str) -> dict:
    if name not in PLANT_META:
        raise KeyError(f"missing plant meta: {name}")
    meta = PLANT_META[name]
    profile = PLANT_PROFILES[meta["kind"]]
    rarity = meta["rarity"]
    base = KIND_BASE_STATS[meta["kind"]]
    bonus = RARITY_BONUS[rarity]
    stats = [base[i] + bonus[i] for i in range(4)]
    return {
        **meta,
        "id": f"bc2p_{meta['slug']}",
        "stats": stats,
        "origin": f"{name}{profile['origin_suffix']}",
        "school": profile["school"],
        "work": profile["work"],
        "hobby": profile["hobby"],
        "specialty": profile["specialty"],
        "ability": profile["ability"],
        "traits": profile["traits"],
        "skills": profile["skills"],
        "sceneId": "forest",
        "sceneName": "神秘森林",
    }


def build_lore(meta: dict, name: str) -> dict:
    intro = f"{name}是{BOOKLET_NAME}里的花果伙伴，擅长{meta['specialty']}。"
    childhood = f"小时候的{name}常在{meta['origin']}练习{meta['hobby'].split('、')[0]}，慢慢学会把自己的节奏分享给身边伙伴。"
    story = (
        f"{name}来自{meta['origin']}，在{meta['school']}里学会了{meta['ability']}。"
        f"长大后，它成了{meta['work']}，负责{meta['specialty']}。"
        f"平时它最喜欢{meta['hobby']}。"
        f"当孩子完成一个小任务、需要一点鼓励或想把今天的进步记下来时，{name}会把花果能量变成温柔提示，让努力变得看得见。"
    )
    return {
        "galleryId": GALLERY_ID,
        "codexTitle": meta["work"],
        "subtitle": f"{meta['school']}结业生 · {BOOKLET_NAME}常驻伙伴",
        "intro": intro,
        "origin": meta["origin"],
        "childhood": childhood,
        "school": meta["school"],
        "work": meta["work"],
        "hobby": meta["hobby"],
        "specialty": meta["specialty"],
        "ability": meta["ability"],
        "sceneId": meta["sceneId"],
        "sceneName": meta["sceneName"],
        "story": story,
        "traits": meta["traits"],
        "skills": [{"name": skill_name, "desc": desc} for skill_name, desc in meta["skills"]],
    }


def build_pet_entries(rows: list[dict]) -> tuple[list[dict], list[dict], list[dict]]:
    series_entries: list[dict] = []
    flat_entries: list[dict] = []
    lore_entries: list[dict] = []

    for row in rows:
        name = row["name"]
        meta = build_meta(name)
        stage_paths = []
        image_stages = {}
        for stage_index, _level in enumerate(LEVEL_MAP):
            rel_path = f"assets/banchong2/{SERIES_NAME}/{name}-{stage_index}.webp"
            stage_paths.append(rel_path)
            image_stages[str(stage_index)] = rel_path

        hp, atk, defense, spd = meta["stats"]
        series_pet = {
            "id": meta["id"],
            "name": name,
            "emoji": meta["emoji"],
            "series": SERIES_NAME,
            "rarity": meta["rarity"],
            "desc": f"{BOOKLET_NAME}伙伴",
            "base_hp": hp,
            "base_atk": atk,
            "source": SOURCE_ID,
            "originSource": ORIGIN_SOURCE,
            "stages": [{"stage": i, "imageUrl": path} for i, path in enumerate(stage_paths)],
        }
        flat_pet = {
            **series_pet,
            "base_def": defense,
            "base_spd": spd,
            "imageUrl": stage_paths[2],
            "imageStages": image_stages,
            "imageStyle": "banchong",
        }
        lore_entry = {
            "id": meta["id"],
            "name": name,
            "series": SERIES_NAME,
            "source": SOURCE_ID,
            "originSource": ORIGIN_SOURCE,
            "rarity": meta["rarity"],
            **build_lore(meta, name),
        }
        series_entries.append(series_pet)
        flat_entries.append(flat_pet)
        lore_entries.append(lore_entry)

    return series_entries, flat_entries, lore_entries


def write_assets(
    rows: list[dict],
    delay: float,
    jitter: float,
    dry_run: bool,
    max_downloads: int,
) -> tuple[list[dict], bool]:
    manifest_rows = []
    download_count = 0
    completed_all = True
    if not dry_run:
        ASSET_DIR.mkdir(parents=True, exist_ok=True)

    for row in rows:
        name = row["name"]
        meta = build_meta(name)
        stages = []
        for stage_index, level in enumerate(LEVEL_MAP):
            asset_url = replace_level_url(row["baseAssetUrl"], level)
            output_path = ASSET_DIR / f"{name}-{stage_index}.webp"
            local_path = f"assets/banchong2/{SERIES_NAME}/{name}-{stage_index}.webp"

            action = "skip"
            if dry_run:
                action = "would-download" if not output_path.exists() else "would-skip"
            elif not output_path.exists() or output_path.stat().st_size == 0:
                if max_downloads and download_count >= max_downloads:
                    completed_all = False
                    break
                action = "download"
                raw = http_image(asset_url)
                image = Image.open(io.BytesIO(raw))
                converted = image.convert("RGBA")
                converted.save(output_path, format="WEBP", quality=88, method=6)
                download_count += 1
                sleep_between(delay, jitter)

            print(f"{action}: {name} stage={stage_index} level={level} -> {local_path}")
            stages.append(
                {
                    "stage": stage_index,
                    "sourceLevel": level,
                    "sourceUrl": asset_url,
                    "localPath": local_path,
                }
            )

        if not completed_all:
            break

        manifest_rows.append(
            {
                "id": meta["id"],
                "sourcePetId": row["id"],
                "name": name,
                "category": "PLANT",
                "series": SERIES_NAME,
                "source": SOURCE_ID,
                "originSource": ORIGIN_SOURCE,
                "maxLevel": row["maxLevel"],
                "mappedLevels": LEVEL_MAP,
                "stages": stages,
            }
        )

    if not dry_run and completed_all:
        write_json(MANIFEST_PATH, manifest_rows)
    return manifest_rows, completed_all


def update_pets_json(series_entries: list[dict], flat_entries: list[dict], dry_run: bool) -> None:
    db = read_json(PETS_JSON)
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
    db["sources"][SOURCE_ID] = f"班宠乐园2 植物 {len(flat_entries)} 种"

    if not dry_run:
        write_json(PETS_JSON, db)


def update_lore_json(lore_entries: list[dict], dry_run: bool) -> None:
    db = read_json(LORE_JSON)
    pets = db.get("pets") or []
    pets = [pet for pet in pets if pet.get("source") != SOURCE_ID]
    pets.extend(lore_entries)
    db["pets"] = pets
    db["generatedAt"] = datetime.now(timezone.utc).isoformat()

    if not dry_run:
        write_json(LORE_JSON, db)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import banchong2 PLANT pets as local webp assets.")
    parser.add_argument("--catalog", type=Path, default=Path(os.environ.get("BANCHONG2_CATALOG_JSON", DEFAULT_CATALOG)))
    parser.add_argument("--dry-run", action="store_true", help="Print planned downloads and data changes without writing files.")
    parser.add_argument("--skip-assets", action="store_true", help="Only update JSON data; requires assets/manifest to already exist.")
    parser.add_argument("--delay", type=float, default=1.1, help="Base delay after each successful image download.")
    parser.add_argument("--jitter", type=float, default=0.6, help="Random extra delay after each successful image download.")
    parser.add_argument("--max-downloads", type=int, default=0, help="Stop after this many new image downloads; useful for slow, resumable batches.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    plants = load_catalog(args.catalog)
    if len(plants) != len(PLANT_META):
        raise RuntimeError(f"expected {len(PLANT_META)} plant rows, got {len(plants)}")

    levels = read_json(LEVELS_SNAPSHOT)
    level_values = [row.get("level") for row in levels]
    if level_values != list(range(1, 11)):
        raise RuntimeError(f"unexpected levels payload: {level_values}")

    for row in plants:
        build_meta(row["name"])

    if not args.skip_assets:
        _manifest_rows, completed_all = write_assets(
            plants,
            args.delay,
            args.jitter,
            args.dry_run,
            max(0, args.max_downloads),
        )
        if not completed_all:
            print(
                json.dumps(
                    {
                        "partial": True,
                        "message": "asset batch complete; rerun the script to resume",
                        "maxDownloads": args.max_downloads,
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return
    elif not MANIFEST_PATH.exists() and not args.dry_run:
        raise FileNotFoundError("missing plant import manifest while --skip-assets was provided")

    series_entries, flat_entries, lore_entries = build_pet_entries(plants)
    update_pets_json(series_entries, flat_entries, args.dry_run)
    update_lore_json(lore_entries, args.dry_run)

    if not args.dry_run:
        write_json(PLANTS_SNAPSHOT, plants)

    print(
        json.dumps(
            {
                "imported": len(flat_entries),
                "series": SERIES_NAME,
                "booklet": BOOKLET_NAME,
                "source": SOURCE_ID,
                "originSource": ORIGIN_SOURCE,
                "levels": LEVEL_MAP,
                "dryRun": args.dry_run,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
