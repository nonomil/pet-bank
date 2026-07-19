"""Generate and attach uniform Minecraft vocabulary card-back scene art.

Agnes is asked for four related scenes in one 2x2 sheet. The sheet is cropped
locally into four 512px PNGs and reused by semantic card themes, so every card
gets a real local back image without issuing one request per vocabulary item.
"""

from __future__ import annotations

import argparse
import base64
import io
import json
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
VOCAB_PATH = ROOT / "data" / "learn" / "packs" / "english-mc-hybrid-2026" / "modules" / "minecraft-vocab.json"
PROMPT_EXPORT_PATH = ROOT / "data" / "learn" / "packs" / "english-mc-hybrid-2026" / "minecraft-card-back-prompts.json"
KEY_PATH = ROOT / "docs" / "生图" / "生图接口资源key" / "Agnes生图key.md"
ENDPOINT = "https://apihub.agnes-ai.com/v1/images/generations"
MODEL = "agnes-image-2.1-flash"
THEME_SOURCE = {
    "combat-items": "grok-imagine-image-quality",
    "actions-modes": "grok-imagine-image-quality",
    "colors-icons": "grok-imagine-image-quality",
}
OUTPUT_ROOT = ROOT / "assets" / "learn" / "english-vocab" / "minecraft-card-backs"
PROMPT_ROOT = ROOT / "docs" / "我的世界--单词学习" / "生图提示词" / "minecraft-card-backs"
RAW_ROOT = ROOT / "tmp" / "minecraft-card-back-sheets"
PREFIX = "assets/learn/english-vocab/minecraft-card-backs/"


THEMES: dict[str, dict[str, Any]] = {
    "blocks-building": {
        "label": "blocks and building",
        "match": r"block|brick|plank|wood|stone|cobble|wall|floor|roof|build|construct|方块|砖|木|石|建筑|墙|地板|屋顶",
        "scenes": [
            "a child places a bright building block on a small bridge",
            "a block house under construction beside a campfire",
            "a close view of a neat stone and wood doorway",
            "a tiny builder repairs a path before sunset",
        ],
    },
    "tools-mining": {
        "label": "tools and mining",
        "match": r"pickaxe|axe|shovel|hoe|tool|\bmine\b|\bore\b|diamond|coal|iron|gold|镐|斧|铲|工具|矿|钻石|煤|铁|金",
        "scenes": [
            "a pickaxe breaks a glowing ore block in a safe lit mine",
            "a child explorer carries a wooden tool beside a mine cart",
            "a small diamond vein shines behind a torch",
            "a friendly miner sorts stone, coal, and bright ore",
        ],
    },
    "mobs-friendly": {
        "label": "friendly mobs and animals",
        "match": r"\bcow\b|\bpig\b|sheep|chicken|\bcat\b|\bdog\b|wolf|horse|dolphin|bee|fish|animal|mob|牛|猪|羊|鸡|猫|狗|狼|马|海豚|蜜蜂|鱼|生物",
        "scenes": [
            "a friendly blocky cow waits beside a meadow fence",
            "a child feeds a pig near a small village path",
            "a dolphin leaps from a clear blue river",
            "a tamed wolf follows an explorer beside the camp",
        ],
    },
    "mobs-hostile": {
        "label": "hostile mobs and safe encounters",
        "match": r"creeper|zombie|skeleton|spider|blaze|slime|witch|phantom|ghast|enderman|hostile|苦力怕|僵尸|骷髅|蜘蛛|烈焰|史莱姆|女巫|恶魂|末影人",
        "scenes": [
            "a small creeper stays behind a safe torch-lit fence",
            "an explorer raises a shield while a zombie waits far away",
            "a slime bounces harmlessly beside a marked path",
            "a skeleton encounter in a bright cave with plenty of distance",
        ],
    },
    "plants-food": {
        "label": "plants and food",
        "match": r"apple|bread|cake|carrot|potato|wheat|seed|flower|tree|leaves|sapling|mushroom|crop|farm|fruit|food|苹果|面包|蛋糕|胡萝卜|土豆|小麦|种子|花|树|树叶|树苗|蘑菇|农场|食物",
        "scenes": [
            "a child harvests a ripe carrot in a tidy farm",
            "a red apple rests on a wooden table by a tree",
            "a bright flower garden grows beside the camp",
            "a tiny sapling is planted beside a stream",
        ],
    },
    "village-structures": {
        "label": "villages and structures",
        "match": r"village|\bhouse\b|door|window|chest|tower|castle|temple|ship|boat|rail|bridge|structure|村庄|房子|门|窗|箱子|塔|城堡|神殿|船|铁路|桥|结构",
        "scenes": [
            "a warmly lit village gate opens at sunset",
            "a chest sits inside a tidy wooden house",
            "a blocky bridge crosses a river toward a village",
            "a mine rail leads from a small tower to the camp",
        ],
    },
    "biomes-weather": {
        "label": "biomes and weather",
        "match": r"biome|forest|grass|jungle|desert|snow|ice|ocean|river|lake|mountain|hill|beach|rain|sun|sky|biome|森林|草原|丛林|沙漠|雪|冰|海洋|河|湖|山|小山|海滩|雨|太阳|天空",
        "scenes": [
            "a sunny grassland trail follows a winding river",
            "a snowy mountain pass glows under a clear sky",
            "a quiet forest clearing with a small wooden sign",
            "a calm ocean shore beside a blocky boat",
        ],
    },
    "nether-lava": {
        "label": "Nether and fire",
        "match": r"nether|lava|fire|portal|blaze|soul|magma|下界|熔岩|火|传送门|灵魂|岩浆",
        "scenes": [
            "a purple portal stands safely above a lava lake",
            "a fire-resistant explorer crosses a basalt bridge",
            "a warm fire charm glows beside a nether camp",
            "a distant blaze guards a bright portal in red mist",
        ],
    },
    "end-dragon": {
        "label": "The End and the dragon",
        "match": r"ender|dragon|end|eye of|obsidian|end stone|末影|龙|末地|末影之眼|黑曜石",
        "scenes": [
            "a brave explorer raises an Eye of Ender before a portal",
            "an End island floats beneath a dark starry sky",
            "a distant blocky dragon circles crystal towers",
            "a team prepares a bright shield at the dragon arena",
        ],
    },
    "effects-potions": {
        "label": "effects and potions",
        "match": r"potion|effect|strength|speed|haste|resistance|regeneration|invisibility|poison|water breathing|状态|药水|效果|力量|速度|抗性|再生|隐身|中毒|水下呼吸",
        "scenes": [
            "a colorful potion bottle glows on an alchemy table",
            "a speed effect trail follows an explorer on a path",
            "a protective bubble surrounds a child beside the camp",
            "a brewing stand makes a gentle swirl of potion light",
        ],
    },
    "combat-items": {
        "label": "weapons, armor, and combat items",
        "match": r"sword|bow|arrow|shield|armor|helmet|helmet|crossbow|trident|weapon|damage|attack|combat|剑|弓|箭|盾|盔甲|头盔|武器|伤害|攻击|战斗",
        "scenes": [
            "a wooden sword and shield rest beside a training target",
            "an explorer practices an arrow shot at a safe target",
            "a bright armor set hangs in a small camp workshop",
            "a team blocks a harmless incoming fireball with a shield",
        ],
    },
    "actions-modes": {
        "label": "survival actions and game modes",
        "match": r"survival|creative|adventure|spectator|hardcore|inventory|\bcraft\b|smelt|enchant|sleep|\brun\b|jump|look|find|carry|\buse\b|make|play|mode|生存|创造|冒险|旁观|极限|背包|合成|熔炼|附魔|睡觉|奔跑|跳|看|寻找|携带|使用|制作|游戏模式",
        "scenes": [
            "a child crafts a useful item at a camp table",
            "an explorer checks a full inventory beside a chest",
            "a friendly guide points toward the next trail",
            "a player runs and jumps across a bright grass path",
        ],
    },
    "redstone-transport": {
        "label": "redstone and transport",
        "match": r"redstone|lever|button|piston|observer|rail|minecart|powered|signal|红石|拉杆|按钮|活塞|观察者|铁轨|矿车|信号",
        "scenes": [
            "a redstone lamp lights when a child presses a button",
            "a piston opens a small secret doorway",
            "a minecart rolls along a powered rail",
            "a simple redstone circuit glows beside the camp",
        ],
    },
    "colors-icons": {
        "label": "colors, icons, and discoveries",
        "match": r"black|white|red|blue|green|yellow|purple|orange|gray|grey|icon|map|compass|color|black|white|颜色|图标|地图|指南针",
        "scenes": [
            "a colorful collection of voxel blocks arranged on a camp table",
            "a compass points toward a bright flag on the trail",
            "a map is opened beside a glowing campfire",
            "a rainbow of wool blocks decorates a small bridge",
        ],
    },
}


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_key(path: Path) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        value = line.strip().strip("\"'")
        if len(value) >= 32 and " " not in value and not value.startswith("#") and "/" not in value:
            return value
    raise RuntimeError(f"No Agnes key found in {path}")


def slug(value: str) -> str:
    value = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return value[:50] or "scene"


def extract_bytes(value: Any) -> bytes | None:
    if isinstance(value, dict):
        for key in ("b64_json", "image_base64", "result"):
            candidate = value.get(key)
            if isinstance(candidate, str) and len(candidate) > 1000:
                if candidate.startswith("data:") and "," in candidate:
                    candidate = candidate.split(",", 1)[1]
                return base64.b64decode(candidate)
        if isinstance(value.get("url"), str):
            with urllib.request.urlopen(value["url"], timeout=300) as response:
                return response.read()
        for child in value.values():
            result = extract_bytes(child)
            if result:
                return result
    elif isinstance(value, list):
        for child in value:
            result = extract_bytes(child)
            if result:
                return result
    return None


def theme_for(card: dict[str, Any]) -> str:
    category = str(card.get("category") or "").strip().lower()
    category_theme = {
        "block": "blocks-building",
        "tool": "tools-mining",
        "weapon": "combat-items",
        "mob": "mobs-friendly",
        "biome": "biomes-weather",
        "structure": "village-structures",
        "food": "plants-food",
        "plant": "plants-food",
        "color": "colors-icons",
        "effect": "effects-potions",
        "advancement": "actions-modes",
    }
    if category in category_theme:
        if category == "mob":
            hostile = str(card.get("word") or "").lower()
            if re.search(r"creeper|zombie|skeleton|spider|blaze|slime|witch|phantom|ghast|enderman", hostile):
                return "mobs-hostile"
        return category_theme[category]
    text = " ".join(str(card.get(key) or "") for key in ("word", "translation", "tags", "sentence"))
    for key, theme in THEMES.items():
        if re.search(theme["match"], text, re.IGNORECASE):
            return key
    return "actions-modes"


def make_prompt(theme_key: str, cards: list[dict[str, Any]]) -> str:
    theme = THEMES[theme_key]
    examples = ", ".join(str(card.get("word") or "Minecraft word") for card in cards[:8])
    panels = " ".join(f"Panel {index + 1}: {scene}." for index, scene in enumerate(theme["scenes"]))
    return (
        "Create one square 2x2 multi-panel sheet for the back illustrations of children's English learning flashcards. "
        "The four panels must be separate, equal-sized, cleanly crop-able scenes with no borders, no grid lines, "
        "no overlap, and no blended subjects between panels. Use a consistent bright child-friendly Minecraft-inspired "
        "voxel adventure style, soft pixel-art lighting, natural colors, simple shapes, and calm empty space around "
        "each central subject. This sheet represents the theme " + theme["label"] + ". " + panels + " "
        f"Representative vocabulary includes: {examples}. "
        "No readable text, no letters, no numbers, no Chinese characters, no pinyin, no logos, no watermark, "
        "no UI, no collage outside the four panels, no unrelated objects."
    )


def request_sheet(prompt: str, api_key: str, retries: int = 3) -> bytes:
    payload = json.dumps({"model": MODEL, "prompt": prompt, "n": 1, "size": "1024x1024"}).encode("utf-8")
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        request = urllib.request.Request(ENDPOINT, data=payload, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=360) as response:
                image = extract_bytes(json.loads(response.read().decode("utf-8")))
            if not image:
                raise RuntimeError("Agnes response contains no image bytes")
            return image
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, RuntimeError, json.JSONDecodeError) as error:
            last_error = error
            if isinstance(error, urllib.error.HTTPError) and error.code not in (429, 500, 502, 503, 504):
                raise
            if attempt < retries:
                time.sleep(8 * attempt)
    raise RuntimeError(f"Agnes sheet generation failed: {last_error}")


def valid_png(path: Path) -> bool:
    if not path.exists() or path.stat().st_size <= 1024:
        return False
    try:
        with Image.open(path) as image:
            return image.format == "PNG" and image.size == (512, 512)
    except Exception:
        return False


def legacy_card_back(card: dict[str, Any]) -> Path | None:
    """Find a pre-existing card-specific back by its stable word slug."""
    token = slug(str(card.get("word") or ""))
    if not token:
        return None
    matches = [path for path in OUTPUT_ROOT.glob("card-*.png") if token in path.stem]
    if len(matches) != 1 or not valid_png(matches[0]):
        return None
    return matches[0]


def crop_sheet(raw: bytes, outputs: list[Path]) -> None:
    with Image.open(io.BytesIO(raw)) as source:
        image = source.convert("RGB")
        if image.width < 2 or image.height < 2:
            raise RuntimeError(f"invalid Agnes sheet dimensions: {image.size}")
        half_w, half_h = image.width // 2, image.height // 2
        boxes = [(0, 0, half_w, half_h), (half_w, 0, image.width, half_h), (0, half_h, half_w, image.height), (half_w, half_h, image.width, image.height)]
        for output, box in zip(outputs, boxes):
            output.parent.mkdir(parents=True, exist_ok=True)
            image.crop(box).resize((512, 512), Image.Resampling.LANCZOS).save(output, "PNG", optimize=True)
            if not valid_png(output):
                raise RuntimeError(f"invalid cropped card-back PNG: {output}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--limit-themes", type=int, default=0)
    parser.add_argument("--force", action="store_true", help="regenerate even when the theme PNGs already exist")
    args = parser.parse_args()

    document = read_json(VOCAB_PATH)
    cards = document.get("cards", [])
    # Restore dedicated art before assigning theme art. This makes --apply
    # idempotent and protects any future hand-selected card-specific image.
    for card in cards:
        legacy = legacy_card_back(card)
        if legacy:
            card["backImage"] = str(legacy.relative_to(ROOT)).replace("\\", "/")
            card.setdefault("backImageSource", "existing-local-art")
            card.setdefault("backImageQuality", "card-specific-local-art")
            card.setdefault("backImageTheme", theme_for(card))
    preserved_back_ids = {
        str(card.get("id") or "")
        for card in cards
        if card.get("backImage") and not Path(str(card.get("backImage"))).name.startswith("theme-")
    }
    grouped: dict[str, list[dict[str, Any]]] = {key: [] for key in THEMES}
    for card in cards:
        grouped[theme_for(card)].append(card)
    selected_themes = [key for key in THEMES if grouped[key]]
    if args.limit_themes:
        selected_themes = selected_themes[:args.limit_themes]
    if not args.apply:
        print(json.dumps({"apply": False, "cards": len(cards), "themes": {key: len(grouped[key]) for key in selected_themes}}, ensure_ascii=False, indent=2))
        return 0

    api_key = read_key(KEY_PATH)
    generated_assets: list[dict[str, Any]] = []
    for theme_key in selected_themes:
        theme = THEMES[theme_key]
        theme_slug = slug(theme_key)
        prompt = make_prompt(theme_key, grouped[theme_key])
        PROMPT_ROOT.mkdir(parents=True, exist_ok=True)
        (PROMPT_ROOT / f"{theme_slug}.txt").write_text(prompt + "\n", encoding="utf-8")
        sheet_path = RAW_ROOT / f"{theme_slug}-sheet.png"
        output_paths = [OUTPUT_ROOT / f"theme-{theme_slug}-{index + 1}.png" for index in range(4)]
        if args.force or not all(valid_png(path) for path in output_paths):
            raw = request_sheet(prompt, api_key)
            RAW_ROOT.mkdir(parents=True, exist_ok=True)
            sheet_path.write_bytes(raw)
            crop_sheet(raw, output_paths)
        for index, output in enumerate(output_paths):
            generated_assets.append({
                "id": f"theme-{theme_slug}-{index + 1}",
                "theme": theme_key,
                "panel": index + 1,
                "source": THEME_SOURCE.get(theme_key, MODEL),
                "sourceSheet": str(sheet_path.relative_to(ROOT)).replace("\\", "/"),
                "path": str(output.relative_to(ROOT)).replace("\\", "/"),
                "dimensions": [512, 512],
                "presentation": "square-raster",
            })

    asset_by_theme = {}
    for asset in generated_assets:
        asset_by_theme.setdefault(asset["theme"], []).append(asset)
    existing_back = next((card for card in cards if card.get("id") in preserved_back_ids), None)
    # Keep pre-existing card-specific art in the manifest as well. This lets
    # the completeness gate audit every referenced back image, not only the
    # newly generated theme sheets.
    manifest_paths = {asset["path"] for asset in generated_assets}
    for card in cards:
        back_path = str(card.get("backImage") or "").replace("\\", "/")
        if not back_path or back_path in manifest_paths:
            continue
        back_file = ROOT / back_path
        if not valid_png(back_file):
            raise RuntimeError(f"existing card back is not a valid 512px PNG: {back_path}")
        generated_assets.append({
            "id": f"card-back-{slug(card.get('id') or card.get('word') or 'card')}",
            "theme": theme_for(card),
            "panel": None,
            "source": str(card.get("backImageSource") or "existing-local-art"),
            "sourceSheet": "",
            "path": back_path,
            "dimensions": [512, 512],
            "presentation": "square-raster",
            "cardId": str(card.get("id") or ""),
        })
        manifest_paths.add(back_path)
    asset_by_theme = {}
    for asset in generated_assets:
        if asset.get("panel") is not None:
            asset_by_theme.setdefault(asset["theme"], []).append(asset)
    for card in cards:
        theme_key = theme_for(card)
        choices = asset_by_theme.get(theme_key) or asset_by_theme.get("actions-modes")
        if not choices:
            raise RuntimeError(f"no generated theme image for {theme_key}")
        index = sum(ord(char) for char in str(card.get("id") or card.get("word") or "")) % len(choices)
        if str(card.get("id") or "") in preserved_back_ids:
            continue
        chosen = choices[index]
        card["backImage"] = chosen["path"]
        card["backImageSource"] = chosen["source"]
        card["backImageQuality"] = "agnes-batched-theme-scene-v1"
        card["backImageTheme"] = theme_key

    document.setdefault("imagePromptPolicy", {})
    document["imagePromptPolicy"].update({
        "version": "minecraft-card-back-v2",
        "provider": "mixed-agnes-grok-batched-theme-scenes",
        "purpose": "sentence-scene-memory",
        "promptField": "backImagePrompt",
        "assetField": "backImage",
        "assetRoot": PREFIX,
        "status": "generated-batched-theme-scenes",
        "generatedCount": sum(1 for card in cards if card.get("backImage")),
        "uniqueGeneratedCount": len(generated_assets),
        "batchLayout": "2x2 sheet cropped locally",
    })
    write_json(VOCAB_PATH, document)
    if PROMPT_EXPORT_PATH.exists():
        prompt_document = read_json(PROMPT_EXPORT_PATH)
        prompt_document["promptPolicy"] = document["imagePromptPolicy"]
        prompt_by_id = {str(card.get("id")): card for card in cards}
        for prompt_card in prompt_document.get("cards", []):
            source_card = prompt_by_id.get(str(prompt_card.get("cardId")))
            if source_card:
                prompt_card["image"] = source_card.get("backImage") or ""
        write_json(PROMPT_EXPORT_PATH, prompt_document)
    write_json(OUTPUT_ROOT / "manifest.json", {
        "schemaVersion": 1,
        "status": "generated-mixed-provider-batched-theme-scenes",
        "generator": "mixed-agnes-grok",
        "batchLayout": "2x2 sheet cropped locally",
        "assets": generated_assets,
        "themeCardCounts": {key: len(grouped[key]) for key in selected_themes},
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "textOverlayPolicy": "All English and Chinese labels remain in HTML/CSS.",
    })
    print(json.dumps({"status": "complete", "cards": len(cards), "themes": len(selected_themes), "uniqueGeneratedCount": len(generated_assets), "preservedExistingBack": bool(existing_back)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
