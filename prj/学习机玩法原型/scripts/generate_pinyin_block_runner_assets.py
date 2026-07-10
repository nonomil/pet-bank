from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "generated" / "pinyin-block-runner-assets"


def rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    value = hex_color.lstrip("#")
    return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4)) + (alpha,)


def shadow(size: tuple[int, int], radius: int = 18, offset: tuple[int, int] = (0, 8), alpha: int = 70) -> Image.Image:
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    box = (16 + offset[0], 16 + offset[1], size[0] - 16 + offset[0], size[1] - 16 + offset[1])
    draw.rounded_rectangle(box, radius=radius, fill=(40, 80, 55, alpha))
    return layer.filter(ImageFilter.GaussianBlur(10))


def save_board() -> None:
    size = 720
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    img.alpha_composite(shadow((size, size), radius=36, offset=(0, 12), alpha=62))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((18, 18, size - 18, size - 18), radius=38, fill=rgba("#f5ffe3"), outline=rgba("#a8cb71"), width=3)
    inner = (48, 48, size - 48, size - 48)
    draw.rounded_rectangle(inner, radius=22, fill=rgba("#b9e873"), outline=rgba("#83b455"), width=3)
    cell = (inner[2] - inner[0]) / 12
    for index in range(1, 12):
        x = inner[0] + cell * index
        y = inner[1] + cell * index
        draw.line((x, inner[1] + 8, x, inner[3] - 8), fill=rgba("#6aa54c", 88), width=2)
        draw.line((inner[0] + 8, y, inner[2] - 8, y), fill=rgba("#6aa54c", 88), width=2)
    img.save(OUT / "board_12x12.png")


def save_tile(name: str, color: str, accent: str) -> None:
    size = (164, 140)
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    img.alpha_composite(shadow(size, radius=24, offset=(0, 8), alpha=54))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((18, 14, size[0] - 18, size[1] - 22), radius=24, fill=rgba(color), outline=rgba(accent), width=3)
    draw.rounded_rectangle((34, 28, size[0] - 34, size[1] - 42), radius=18, fill=rgba("#fff9db", 92))
    img.save(OUT / name)


def save_token() -> None:
    size = (156, 156)
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    img.alpha_composite(shadow(size, radius=40, offset=(0, 8), alpha=58))
    draw = ImageDraw.Draw(img)
    draw.ellipse((28, 28, 128, 128), fill=rgba("#7fe0df"), outline=rgba("#1d887f"), width=4)
    draw.ellipse((52, 48, 76, 72), fill=rgba("#ffffff", 170))
    star = [(78, 38), (88, 66), (118, 66), (94, 84), (104, 116), (78, 96), (52, 116), (62, 84), (38, 66), (68, 66)]
    draw.polygon(star, fill=rgba("#ffd866"), outline=rgba("#d99b29"))
    img.save(OUT / "cursor_token.png")


def save_badge() -> None:
    size = (170, 150)
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    img.alpha_composite(shadow(size, radius=30, offset=(0, 8), alpha=52))
    draw = ImageDraw.Draw(img)
    star = [(86, 20), (102, 58), (144, 58), (110, 82), (124, 124), (86, 98), (48, 124), (62, 82), (28, 58), (70, 58)]
    draw.polygon(star, fill=rgba("#ffd766"), outline=rgba("#d59320"))
    draw.polygon([(86, 34), (96, 62), (126, 62), (102, 80), (112, 108), (86, 90), (60, 108), (70, 80), (46, 62), (76, 62)], fill=rgba("#fff1a4", 200))
    img.save(OUT / "star_badge.png")


def save_plaque() -> None:
    size = (520, 150)
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    img.alpha_composite(shadow(size, radius=26, offset=(0, 8), alpha=45))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((18, 18, size[0] - 18, size[1] - 26), radius=26, fill=rgba("#fffdf2"), outline=rgba("#8fd6a7"), width=3)
    draw.rounded_rectangle((42, 38, 126, 118), radius=20, fill=rgba("#ffd766"))
    for index, color in enumerate(["#d9f2df", "#fff0a2", "#d9eef8"]):
        x = 148 + index * 94
        draw.rounded_rectangle((x, 52, x + 72, 100), radius=18, fill=rgba(color), outline=rgba("#7fc195"), width=2)
    img.save(OUT / "task_card_plaque.png")


def save_progress() -> None:
    size = (360, 80)
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    img.alpha_composite(shadow(size, radius=22, offset=(0, 6), alpha=40))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((18, 24, size[0] - 18, size[1] - 24), radius=18, fill=rgba("#dff4ea"), outline=rgba("#7fc195"), width=2)
    draw.rounded_rectangle((28, 32, size[0] * 0.58, size[1] - 32), radius=12, fill=rgba("#47bd83"))
    img.save(OUT / "progress_strip.png")


def save_sparkle() -> None:
    size = (180, 180)
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    center = (90, 90)
    for radius, alpha in [(62, 34), (40, 64)]:
        draw.ellipse((center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius), fill=rgba("#ffd766", alpha))
    for angle in range(0, 360, 45):
        if angle % 90 == 0:
            length = 66
            width = 7
        else:
            length = 44
            width = 5
        if angle in (0, 180):
            draw.rounded_rectangle((90 - length, 90 - width, 90 + length, 90 + width), radius=width, fill=rgba("#ffd766", 210))
        if angle in (90, 270):
            draw.rounded_rectangle((90 - width, 90 - length, 90 + width, 90 + length), radius=width, fill=rgba("#ffd766", 210))
    draw.ellipse((74, 74, 106, 106), fill=rgba("#ffffff", 230))
    img.save(OUT / "sparkle_burst.png")


def save_warning() -> None:
    size = (160, 130)
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    img.alpha_composite(shadow(size, radius=22, offset=(0, 6), alpha=36))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((18, 22, 142, 102), radius=28, fill=rgba("#ffe4da"), outline=rgba("#ef8b76"), width=3)
    draw.ellipse((40, 42, 58, 60), fill=rgba("#e56f55"))
    draw.ellipse((102, 42, 120, 60), fill=rgba("#e56f55"))
    draw.arc((56, 52, 104, 96), start=18, end=162, fill=rgba("#a55448"), width=4)
    img.save(OUT / "warning_puff.png")


def save_arrow_hint() -> None:
    size = (128, 128)
    img = Image.new("RGBA", size, (0, 0, 0, 0))
    img.alpha_composite(shadow(size, radius=26, offset=(0, 7), alpha=42))
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle((18, 18, 110, 110), radius=28, fill=rgba("#e8f4ff"), outline=rgba("#6eb5dd"), width=3)
    draw.polygon([(64, 34), (86, 58), (72, 58), (72, 92), (56, 92), (56, 58), (42, 58)], fill=rgba("#2d7fd5"))
    img.save(OUT / "arrow_hint_button.png")


def save_preview(files: list[str]) -> None:
    thumbs = []
    for name in files:
        img = Image.open(OUT / name).convert("RGBA")
        img.thumbnail((150, 150))
        thumb = Image.new("RGB", (170, 170), "#f7f3e8")
        thumb.alpha_composite(img, ((170 - img.width) // 2, (170 - img.height) // 2))
        thumbs.append(thumb)
    cols = 4
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * 170, rows * 170), "#efe9dc")
    for index, thumb in enumerate(thumbs):
        sheet.paste(thumb, ((index % cols) * 170, (index // cols) * 170))
    sheet.save(OUT / "_preview_contact_sheet.jpg", quality=92)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    files = [
        "board_12x12.png",
        "cursor_token.png",
        "pinyin_tile_mint.png",
        "pinyin_tile_yellow.png",
        "pinyin_tile_coral.png",
        "pinyin_tile_blue.png",
        "task_card_plaque.png",
        "star_badge.png",
        "progress_strip.png",
        "sparkle_burst.png",
        "warning_puff.png",
        "arrow_hint_button.png",
    ]
    save_board()
    save_token()
    save_tile("pinyin_tile_mint.png", "#bfeedd", "#66ba95")
    save_tile("pinyin_tile_yellow.png", "#ffe080", "#d69c28")
    save_tile("pinyin_tile_coral.png", "#ffb19c", "#e57058")
    save_tile("pinyin_tile_blue.png", "#bfe8ff", "#61abd6")
    save_plaque()
    save_badge()
    save_progress()
    save_sparkle()
    save_warning()
    save_arrow_hint()
    save_preview(files)
    manifest = {
        "source": "local placeholder assets; replace with GPT transparent explosion sheet using same semantic names",
        "style": "pinyin block runner, no snake",
        "assets": [{"name": Path(name).stem, "file": f"assets/generated/pinyin-block-runner-assets/{name}"} for name in files],
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
