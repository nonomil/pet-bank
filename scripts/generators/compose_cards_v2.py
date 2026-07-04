#!/usr/bin/env python3
"""Compose V2 pet cards from Agnes backgrounds plus local data.

Usage:
    python scripts/generators/compose_cards_v2.py --ids pvz_sunflower
    python scripts/generators/compose_cards_v2.py --all
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


try:
    RESAMPLING = Image.Resampling.LANCZOS
except AttributeError:  # pragma: no cover
    RESAMPLING = Image.LANCZOS


CANVAS = (480, 640)
PORTRAIT_BOX = (54, 92, 426, 378)
NAME_PLATE = (34, 404, 446, 486)
INFO_PLATE = (34, 490, 446, 614)

SOURCE_LABELS = {
    "original": "阳光花园馆",
    "pvz": "阳光花园馆",
    "banchong": "奇趣冒险馆",
    "classpet": "创想课堂馆",
    "minecraft": "方块生态馆",
}
SERIES_DISPLAY_LABELS = {
    "pvz真实": "PVZ",
    "PVZ": "PVZ经典",
    "我的世界": "方块生态",
}

RARITY_META = {
    "common": {"label": "普通", "frame": "frame-common-v2.png", "accent": "#B39B78"},
    "rare": {"label": "稀有", "frame": "frame-rare-v2.png", "accent": "#4C92E8"},
    "epic": {"label": "史诗", "frame": "frame-epic-v2.png", "accent": "#8A5BE7"},
    "legendary": {"label": "传说", "frame": "frame-legendary-v2.png", "accent": "#E39A2E"},
}

STAT_META = [
    ("生命", "base_hp", "#E86D62"),
    ("攻击", "base_atk", "#F2A33B"),
    ("防御", "base_def", "#5B93EA"),
    ("速度", "base_spd", "#70C56B"),
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "C:/Windows/Fonts/msyhbd.ttc" if bold else "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/msyh.ttc",
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


def load_pets(repo_root: Path) -> list[dict]:
    raw = json.loads((repo_root / "data" / "pets.json").read_text(encoding="utf-8"))
    return raw["flat"]


def pick_portrait_path(repo_root: Path, pet: dict) -> Path | None:
    image_stages = pet.get("imageStages") or {}
    for key in ("2", "3", "1", "0", 2, 3, 1, 0):
        if key in image_stages:
            candidate = repo_root / image_stages[key]
            if candidate.exists():
                return candidate
    image_url = pet.get("imageUrl")
    if image_url:
        candidate = repo_root / image_url
        if candidate.exists():
            return candidate
    return None


def fit_background(image: Image.Image) -> Image.Image:
    bg = image.convert("RGBA")
    src_ratio = bg.width / bg.height
    dst_ratio = CANVAS[0] / CANVAS[1]
    if src_ratio > dst_ratio:
        target_h = bg.height
        target_w = int(target_h * dst_ratio)
        left = (bg.width - target_w) // 2
        bg = bg.crop((left, 0, left + target_w, target_h))
    else:
        target_w = bg.width
        target_h = int(target_w / dst_ratio)
        top = max(0, (bg.height - target_h) // 2)
        bg = bg.crop((0, top, target_w, top + target_h))
    return bg.resize(CANVAS, RESAMPLING)


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def draw_centered_text(draw: ImageDraw.ImageDraw, xy: tuple[float, float], text: str, text_font, fill, stroke_fill=None, stroke_width=0) -> None:
    try:
        draw.text(xy, text, font=text_font, fill=fill, anchor="mm", stroke_fill=stroke_fill, stroke_width=stroke_width)
    except TypeError:
        bbox = draw.textbbox((0, 0), text, font=text_font)
        draw.text((xy[0] - (bbox[2] - bbox[0]) / 2, xy[1] - (bbox[3] - bbox[1]) / 2), text, font=text_font, fill=fill)


def draw_pill(draw: ImageDraw.ImageDraw, box, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=18, fill=fill, outline=outline, width=width)


def compose_card(repo_root: Path, pet: dict, out_dir: Path) -> Path:
    rarity = pet.get("rarity") or "common"
    meta = RARITY_META.get(rarity, RARITY_META["common"])
    frame_path = repo_root / "assets" / "cards" / "v2" / meta["frame"]
    if not frame_path.exists():
        raise FileNotFoundError(f"missing frame: {frame_path}")

    base = fit_background(Image.open(frame_path))
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    canvas.alpha_composite(base)

    shadow = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((10, 10, 470, 630), radius=26, fill=(64, 42, 18, 56))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    composed = Image.alpha_composite(shadow, canvas)

    overlay = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    draw.rounded_rectangle((18, 18, 462, 622), radius=26, outline=(255, 255, 255, 165), width=2)
    draw.rounded_rectangle((24, 24, 456, 616), radius=24, outline=(255, 247, 231, 112), width=1)

    draw.rounded_rectangle(PORTRAIT_BOX, radius=28, fill=(255, 250, 240, 246), outline=(255, 255, 255, 222), width=2)
    draw.rounded_rectangle(NAME_PLATE, radius=22, fill=(255, 249, 241, 220), outline=(241, 228, 202, 220), width=2)
    draw.rounded_rectangle(INFO_PLATE, radius=24, fill=(255, 252, 246, 228), outline=(234, 219, 191, 228), width=2)

    accent = tuple(int(meta["accent"].lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    draw_pill(draw, (34, 34, 164, 66), fill=accent + (220,), outline=(255, 255, 255, 160), width=1)
    draw_pill(draw, (334, 34, 446, 66), fill=(255, 249, 240, 214), outline=accent + (190,), width=2)
    draw_pill(draw, (34, 72, 214, 102), fill=(255, 252, 246, 192), outline=(255, 255, 255, 138), width=1)

    portrait_path = pick_portrait_path(repo_root, pet)
    if portrait_path:
        art = Image.open(portrait_path).convert("RGBA")
        max_w = PORTRAIT_BOX[2] - PORTRAIT_BOX[0] - 36
        max_h = PORTRAIT_BOX[3] - PORTRAIT_BOX[1] - 34
        ratio = min(max_w / art.width, max_h / art.height)
        new_size = (max(1, int(art.width * ratio)), max(1, int(art.height * ratio)))
        art = art.resize(new_size, RESAMPLING)
        art_x = PORTRAIT_BOX[0] + (PORTRAIT_BOX[2] - PORTRAIT_BOX[0] - art.width) // 2
        art_y = PORTRAIT_BOX[1] + (PORTRAIT_BOX[3] - PORTRAIT_BOX[1] - art.height) // 2 + 8
        glow = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        glow_draw.ellipse((art_x - 18, art_y - 4, art_x + art.width + 18, art_y + art.height + 24), fill=accent + (45,))
        glow = glow.filter(ImageFilter.GaussianBlur(18))
        overlay.alpha_composite(glow)
        overlay.alpha_composite(art, (art_x, art_y))
    else:
        draw_centered_text(draw, ((PORTRAIT_BOX[0] + PORTRAIT_BOX[2]) / 2, (PORTRAIT_BOX[1] + PORTRAIT_BOX[3]) / 2), pet.get("emoji", "🐾"), font(110), (90, 73, 46))

    series_label = SERIES_DISPLAY_LABELS.get(pet.get("series"), pet.get("series") or "图鉴")
    draw.text((46, 42), series_label, font=font(16, bold=True), fill=(255, 255, 255))
    draw.text((362, 42), meta["label"], font=font(16, bold=True), fill=(92, 70, 36))
    draw.text((46, 79), SOURCE_LABELS.get(pet.get("source"), "宠物图鉴馆"), font=font(14, bold=False), fill=(115, 90, 58))

    draw_centered_text(draw, (240, 431), pet.get("name", "未知宠物"), font(30, bold=True), (56, 42, 28), stroke_fill=(255, 255, 255), stroke_width=2)
    subtitle = f"{series_label} · {SOURCE_LABELS.get(pet.get('source'), '宠物图鉴馆')}"
    draw_centered_text(draw, (240, 466), subtitle, font(15), (128, 102, 70))

    stat_boxes = [
        (50, 508, 226, 552),
        (254, 508, 430, 552),
        (50, 560, 226, 604),
        (254, 560, 430, 604),
    ]
    for (label, key, color), box in zip(STAT_META, stat_boxes):
        color_rgb = tuple(int(color.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
        draw.rounded_rectangle(box, radius=18, fill=(255, 250, 242, 210), outline=color_rgb + (215,), width=2)
        icon_box = (box[0] + 8, box[1] + 7, box[0] + 62, box[3] - 7)
        draw.rounded_rectangle(icon_box, radius=14, fill=color_rgb + (225,))
        draw_centered_text(draw, ((icon_box[0] + icon_box[2]) / 2, (icon_box[1] + icon_box[3]) / 2), label, font(14, bold=True), (255, 255, 255))
        value = str(pet.get(key, "-"))
        draw.text((icon_box[2] + 16, box[1] + 7), value, font=font(24, bold=True), fill=(60, 46, 30))

    final = Image.alpha_composite(composed, overlay)
    mask = rounded_mask(CANVAS, 26)
    clipped = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    clipped.paste(final, (0, 0), mask)

    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{pet['id']}.webp"
    clipped.save(out_path, format="WEBP", quality=92, method=6)
    return out_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="assets/cards/composed-v2", help="output directory relative to repo root")
    parser.add_argument("--ids", nargs="*", help="specific pet ids to compose")
    parser.add_argument("--limit", type=int, default=0, help="limit total outputs")
    parser.add_argument("--all", action="store_true", help="compose the full flat list")
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    out_dir = (repo_root / args.out).resolve() if not Path(args.out).is_absolute() else Path(args.out)
    pets = load_pets(repo_root)

    if args.ids:
        pet_map = {pet["id"]: pet for pet in pets}
        selected = [pet_map[pet_id] for pet_id in args.ids if pet_id in pet_map]
    elif args.all:
        selected = pets
    else:
        selected = [pet for pet in pets if pet["id"] == "pvz_sunflower"] or pets[:1]

    if args.limit > 0:
        selected = selected[:args.limit]

    for pet in selected:
        out_path = compose_card(repo_root, pet, out_dir)
        print(f"[ok] {pet['id']} -> {out_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
