from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "大炮打单词" / "大炮打单词参考设计-多元素爆炸图.png"
OUT_DIR = ROOT / "assets" / "generated" / "word-cannon-assets"


BOXES = {
    "target_frame_blue": (20, 20, 314, 170),
    "target_frame_red": (328, 10, 628, 170),
    "target_frame_square_red": (632, 20, 798, 186),
    "explosion_cluster": (812, 18, 1070, 240),
    "explosion_flash": (1082, 18, 1402, 240),
    "target_frame_purple": (20, 184, 304, 330),
    "target_frame_yellow": (328, 184, 616, 330),
    "target_frame_green": (20, 332, 304, 494),
    "beam_double": (684, 214, 718, 446),
    "cannon_front_large": (720, 272, 944, 540),
    "cannon_angle_large": (960, 268, 1146, 486),
    "hud_panel_tall": (1176, 256, 1396, 652),
    "cannon_base_blue": (20, 496, 128, 546),
    "cannon_base_red": (136, 492, 260, 546),
    "cannon_base_purple": (268, 492, 382, 546),
    "cannon_base_yellow": (396, 496, 508, 546),
    "cannon_base_green": (524, 496, 636, 546),
    "shield_icon_blue": (24, 568, 104, 650),
    "gem_icon_red": (124, 568, 202, 646),
    "coin_icon_yellow": (222, 568, 300, 652),
    "heal_icon_green": (316, 568, 398, 650),
    "star_icon_gold": (438, 568, 516, 646),
    "cannon_pedestal_top": (536, 576, 668, 640),
    "crosshair_blue": (700, 544, 814, 658),
    "crosshair_orange": (824, 544, 940, 658),
    "cannon_front_small": (972, 510, 1152, 652),
    "arena_background": (0, 673, 1402, 1122),
}

OPAQUE_CROP_NAMES = {"arena_background"}


def is_edge_background(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    if a < 8:
        return True
    avg = (r + g + b) / 3
    spread = max(r, g, b) - min(r, g, b)
    return avg > 222 and spread < 30


def whiteness_alpha(pixel: tuple[int, int, int, int]) -> int:
    r, g, b, a = pixel
    if a == 0:
        return 0
    avg = (r + g + b) / 3
    spread = max(r, g, b) - min(r, g, b)
    if avg >= 248 and spread <= 16:
        return 0
    if avg >= 238 and spread <= 22:
        return max(0, min(255, int((248 - avg) * 22)))
    return a


def clear_edge_halo(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            has_transparent_neighbor = False
            for ny in range(max(0, y - 1), min(rgba.height, y + 2)):
                for nx in range(max(0, x - 1), min(rgba.width, x + 2)):
                    if nx == x and ny == y:
                        continue
                    if pixels[nx, ny][3] == 0:
                        has_transparent_neighbor = True
                        break
                if has_transparent_neighbor:
                    break
            if not has_transparent_neighbor:
                continue
            pixels[x, y] = (r, g, b, whiteness_alpha((r, g, b, a)))
    return trim_alpha(rgba)


def trim_alpha(image: Image.Image, pad: int = 6) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
      return image
    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(image.width, right + pad)
    bottom = min(image.height, bottom + pad)
    return image.crop((left, top, right, bottom))


def remove_edge_background(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    queue: deque[tuple[int, int]] = deque()
    seen: set[tuple[int, int]] = set()

    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or x < 0 or y < 0 or x >= width or y >= height:
            continue
        seen.add((x, y))
        if not is_edge_background(pixels[x, y]):
            continue
        r, g, b, _ = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)
        queue.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))

    return trim_alpha(rgba)


def make_contact_sheet(files: list[Path]) -> None:
    thumbs = []
    for file in files:
        image = Image.open(file).convert("RGBA")
        image.thumbnail((170, 120), Image.Resampling.LANCZOS)
        thumbs.append((file.stem, image.copy()))

    cell_w, cell_h = 210, 156
    cols = 4
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), "#f4f6fb")
    draw = ImageDraw.Draw(sheet)
    for index, (name, image) in enumerate(thumbs):
        x = (index % cols) * cell_w
        y = (index // cols) * cell_h
        checker = Image.new("RGB", (cell_w, cell_h), "#ffffff")
        cd = ImageDraw.Draw(checker)
        for cy in range(0, cell_h, 16):
            for cx in range(0, cell_w, 16):
                if (cx // 16 + cy // 16) % 2:
                    cd.rectangle((cx, cy, cx + 15, cy + 15), fill="#e7edf5")
        ox = x + (cell_w - image.width) // 2
        oy = y + 8
        sheet.paste(checker, (x, y))
        sheet.paste(image, (ox, oy), image)
        draw.text((x + 10, y + cell_h - 24), name, fill="#132235")
    sheet.save(OUT_DIR / "_preview_contact_sheet.jpg", quality=92)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    outputs: list[Path] = []
    manifest = {
        "source": str(SOURCE.relative_to(ROOT)).replace("\\", "/"),
        "assets": [],
    }

    for name, box in BOXES.items():
        crop = source.crop(box)
        if name in OPAQUE_CROP_NAMES:
            cleaned = crop
        else:
            cleaned = clear_edge_halo(remove_edge_background(crop))
        out = OUT_DIR / f"{name}.png"
        cleaned.save(out)
        outputs.append(out)
        manifest["assets"].append(
            {
                "name": name,
                "file": str(out.relative_to(ROOT)).replace("\\", "/"),
                "box": list(box),
                "size": list(cleaned.size),
            }
        )

    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    make_contact_sheet(outputs)
    print(f"wrote {len(outputs)} assets to {OUT_DIR}")


if __name__ == "__main__":
    main()
