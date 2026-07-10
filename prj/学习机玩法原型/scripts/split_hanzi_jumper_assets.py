from __future__ import annotations

import json
from collections import deque
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "generated" / "reference" / "hanzi-jumper-redesign-assets-sheet-browser.png"
OUT_DIR = ROOT / "assets" / "generated" / "hanzi-jumper-assets"


BOXES = {
    "stage_background": (706, 190, 806, 476),
    "target_capsule": (1062, 259, 1120, 286),
    "jumper_idle": (827, 272, 885, 342),
    "jumper_jump": (812, 366, 910, 446),
    "platform_leaf": (828, 207, 897, 231),
    "platform_cloud": (915, 202, 1022, 251),
    "platform_coral": (1026, 203, 1139, 260),
    "platform_wood": (912, 285, 1048, 330),
    "platform_green": (1058, 282, 1161, 328),
    "platform_glow": (935, 350, 1055, 398),
    "reward_star": (1115, 356, 1155, 397),
    "cloud_large": (934, 402, 1016, 438),
    "cloud_small": (901, 446, 957, 473),
    "score_badge": (1038, 414, 1148, 460),
}


def is_edge_background(pixel: tuple[int, int, int, int]) -> bool:
    r, g, b, a = pixel
    if a < 8:
        return True
    return r > 205 and g > 205 and b > 205 and max(r, g, b) - min(r, g, b) < 28


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


def make_contact_sheet(files: list[Path]) -> None:
    thumbs = []
    for file in files:
        image = Image.open(file).convert("RGBA")
        image.thumbnail((150, 110), Image.Resampling.LANCZOS)
        thumbs.append((file.stem, image.copy()))
    cell_w, cell_h = 190, 145
    cols = 4
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), "#f6f1e8")
    draw = ImageDraw.Draw(sheet)
    for index, (name, image) in enumerate(thumbs):
        x = (index % cols) * cell_w
        y = (index // cols) * cell_h
        checker = Image.new("RGB", (cell_w, cell_h), "#ffffff")
        cd = ImageDraw.Draw(checker)
        for cy in range(0, cell_h, 14):
            for cx in range(0, cell_w, 14):
                if (cx // 14 + cy // 14) % 2:
                    cd.rectangle((cx, cy, cx + 13, cy + 13), fill="#e9eef5")
        ox = x + (cell_w - image.width) // 2
        oy = y + 8
        sheet.paste(checker, (x, y))
        sheet.paste(image, (ox, oy), image)
        draw.text((x + 8, y + cell_h - 24), name, fill="#172033")
    sheet.save(OUT_DIR / "_preview_contact_sheet.jpg", quality=92)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGBA")
    manifest = []
    outputs = []
    for name, box in BOXES.items():
        crop = source.crop(box)
        cleaned = crop if name == "stage_background" else remove_edge_background(crop)
        out = OUT_DIR / f"{name}.png"
        cleaned.save(out)
        outputs.append(out)
        corners = [
            cleaned.getpixel((0, 0))[3],
            cleaned.getpixel((cleaned.width - 1, 0))[3],
            cleaned.getpixel((0, cleaned.height - 1))[3],
            cleaned.getpixel((cleaned.width - 1, cleaned.height - 1))[3],
        ]
        manifest.append(
            {
                "name": name,
                "file": out.name,
                "box": box,
                "size": cleaned.size,
                "cornerAlpha": corners,
            }
        )
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    make_contact_sheet(outputs)
    print(f"wrote {len(outputs)} assets to {OUT_DIR}")


if __name__ == "__main__":
    main()
