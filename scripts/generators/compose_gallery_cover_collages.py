#!/usr/bin/env python3
"""Bake representative pet cards into Agnes hall covers.

Usage:
    python scripts/generators/compose_gallery_cover_collages.py
"""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


try:
    RESAMPLING = Image.Resampling.LANCZOS
    ROTATE_RESAMPLING = Image.Resampling.BICUBIC
except AttributeError:  # pragma: no cover
    RESAMPLING = Image.LANCZOS
    ROTATE_RESAMPLING = Image.BICUBIC


HALLS = {
    "sunshine": {
        "accent": "#E8B94C",
        "pet_ids": ["pvz_peashooter", "pvz_sunflower", "pvz_cherrybomb"],
    },
    "adventure": {
        "accent": "#D58BA7",
        "pet_ids": ["4413441b-af1", "2cd112b5-025", "35a035d7-972"],
    },
    "classroom": {
        "accent": "#7FB6E8",
        "pet_ids": ["cp_cat_01", "cp_unicorn_01", "cp_robot_01"],
    },
    "blocky": {
        "accent": "#86C06F",
        "pet_ids": ["mc_wolf", "mc_allay", "mc_enderman"],
    },
}

RIGHT_ROW_LAYOUT = [
    {"x": 462, "y": 178, "angle": -10, "scale": 0.72},
    {"x": 630, "y": 178, "angle": 0, "scale": 0.72},
    {"x": 798, "y": 178, "angle": 10, "scale": 0.72},
]


def load_pets(repo_root: Path) -> dict[str, dict]:
    raw = json.loads((repo_root / "data" / "pets.json").read_text(encoding="utf-8"))
    return {pet["id"]: pet for pet in raw["flat"]}


def pick_pet_image(pet: dict) -> Path:
    image_stages = pet.get("imageStages") or {}
    for key in ("2", "3", "1", "0", 2, 3, 1, 0):
        if key in image_stages:
            return Path(image_stages[key])
    if pet.get("imageUrl"):
        return Path(pet["imageUrl"])
    raise FileNotFoundError(f"no image for pet {pet.get('id')}")


def fit_pet_art(image: Image.Image, width: int, height: int) -> Image.Image:
    art = image.convert("RGBA")
    ratio = min(width / art.width, height / art.height)
    new_size = (max(1, int(art.width * ratio)), max(1, int(art.height * ratio)))
    return art.resize(new_size, RESAMPLING)


def draw_card(pet_image: Image.Image, accent_hex: str, scale: float) -> Image.Image:
    base_w = int(228 * scale)
    base_h = int(286 * scale)
    radius = int(20 * scale)
    canvas = Image.new("RGBA", (base_w + 30, base_h + 36), (0, 0, 0, 0))

    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle(
        (16, 16, 16 + base_w, 16 + base_h),
        radius=radius,
        fill=(61, 44, 18, 110),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(max(5, 8 * scale))))
    canvas.alpha_composite(shadow)

    card = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(card)
    outer = (12, 8, 12 + base_w, 8 + base_h)
    inner = (24, 22, 24 + int(base_w - 24), 22 + int(base_h * 0.58))

    draw.rounded_rectangle(outer, radius=radius, fill=(255, 250, 244, 248), outline=(255, 255, 255, 235), width=max(2, int(2 * scale)))
    draw.rounded_rectangle(inner, radius=int(16 * scale), fill=(252, 247, 230, 255), outline=(222, 201, 160, 150), width=max(1, int(2 * scale)))

    accent = ImageColorHelper.from_hex(accent_hex)
    draw.rounded_rectangle(
        (28, int(base_h * 0.72), 28 + int(base_w * 0.34), int(base_h * 0.72) + int(28 * scale)),
        radius=int(14 * scale),
        fill=accent + (235,),
    )
    draw.rounded_rectangle(
        (base_w - int(base_w * 0.28), int(base_h * 0.72), base_w - 12, int(base_h * 0.72) + int(28 * scale)),
        radius=int(14 * scale),
        fill=accent + (210,),
    )
    draw.rounded_rectangle(
        (30, base_h - int(42 * scale), base_w - 18, base_h - int(18 * scale)),
        radius=int(12 * scale),
        fill=(255, 244, 224, 235),
    )

    art = fit_pet_art(pet_image, int(base_w * 0.58), int(base_h * 0.44))
    art_x = inner[0] + (inner[2] - inner[0] - art.width) // 2
    art_y = inner[1] + (inner[3] - inner[1] - art.height) // 2 + int(6 * scale)
    card.alpha_composite(art, (art_x, art_y))

    highlight = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    highlight_draw = ImageDraw.Draw(highlight)
    highlight_draw.ellipse((28, 18, 28 + int(68 * scale), 18 + int(28 * scale)), fill=(255, 255, 255, 80))
    highlight = highlight.filter(ImageFilter.GaussianBlur(int(max(3, 5 * scale))))
    card.alpha_composite(highlight)

    canvas.alpha_composite(card)
    return canvas


def draw_existing_card(card_image: Image.Image, scale: float) -> Image.Image:
    target_w = int(244 * scale)
    ratio = target_w / card_image.width
    target_h = max(1, int(card_image.height * ratio))
    resized = card_image.convert("RGBA").resize((target_w, target_h), RESAMPLING)

    canvas = Image.new("RGBA", (target_w + 34, target_h + 42), (0, 0, 0, 0))
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((18, 18, 18 + target_w, 18 + target_h), radius=24, fill=(48, 34, 17, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    canvas.alpha_composite(shadow)
    canvas.alpha_composite(resized, (10, 8))
    return canvas


class ImageColorHelper:
    @staticmethod
    def from_hex(value: str) -> tuple[int, int, int]:
        value = value.lstrip("#")
        return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))


def rotate_card(card: Image.Image, angle: float) -> Image.Image:
    return card.rotate(angle, resample=ROTATE_RESAMPLING, expand=True)


def ensure_base_copy(src: Path, base_dir: Path) -> Path:
    base_dir.mkdir(parents=True, exist_ok=True)
    base_path = base_dir / src.name
    if not base_path.exists():
        shutil.copy2(src, base_path)
    return base_path


def resolve_card_asset(repo_root: Path, pet_id: str, card_dir: str) -> Path | None:
    card_path = repo_root / card_dir / f"{pet_id}.webp"
    return card_path if card_path.exists() else None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--card-dir",
        default="assets/cards/composed-v2",
        help="directory containing baked pet cards relative to repo root",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parents[2]
    hall_dir = repo_root / "assets" / "pokedex-halls"
    base_dir = hall_dir / "base"
    pets = load_pets(repo_root)
    manifest: list[dict] = []

    for slug, config in HALLS.items():
        out_path = hall_dir / f"{slug}.png"
        base_path = ensure_base_copy(out_path, base_dir)
        background = Image.open(base_path).convert("RGBA")
        cards_layout = config.get("cards") or RIGHT_ROW_LAYOUT

        for pet_id, placement in zip(config["pet_ids"], cards_layout):
            pet = pets[pet_id]
            card_asset = resolve_card_asset(repo_root, pet_id, args.card_dir)
            if card_asset:
                card_image = Image.open(card_asset).convert("RGBA")
                card = draw_existing_card(card_image, placement["scale"])
            else:
                pet_image_path = repo_root / pick_pet_image(pet)
                pet_image = Image.open(pet_image_path).convert("RGBA")
                card = draw_card(pet_image, config["accent"], placement["scale"])
            rotated = rotate_card(card, placement["angle"])
            background.alpha_composite(rotated, (placement["x"], placement["y"]))

        background.save(out_path)
        manifest.append(
            {
                "slug": slug,
                "output": str(out_path),
                "base": str(base_path),
                "pet_ids": config["pet_ids"],
                "card_dir": args.card_dir,
            }
        )
        print(f"[ok] {slug} -> {out_path}")

    (hall_dir / "_composite.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
