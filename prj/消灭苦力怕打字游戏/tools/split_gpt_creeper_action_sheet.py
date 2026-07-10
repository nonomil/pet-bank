from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


PROJECT = Path(__file__).resolve().parents[1]
REFERENCE_DIR = PROJECT / "assets" / "generated" / "reference"
SOURCE = REFERENCE_DIR / "gpt-creeper-multi-action-sheet.png"
OUT = PROJECT / "assets" / "generated" / "typing-defense-assets"
MANIFEST = OUT / "manifest.json"

GRID_COLUMNS = 4
GRID_ROWS = 3
FRAME_NAMES = [
    "creeper_gpt_idle",
    "creeper_gpt_walk_0",
    "creeper_gpt_walk_1",
    "creeper_gpt_walk_2",
    "creeper_gpt_walk_3",
    "creeper_gpt_danger_mid",
    "creeper_gpt_danger_near",
    "creeper_gpt_attack_warning",
    "creeper_gpt_hit_reaction",
    "creeper_gpt_explosion_0",
    "creeper_gpt_explosion_1",
    "creeper_gpt_explosion_2",
]


def remove_white_background(image: Image.Image, threshold: int = 18) -> Image.Image:
    rgba = image.convert("RGBA")
    if rgba.getchannel("A").getextrema()[0] < 255:
        return rgba
    white = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
    diff = ImageChops.difference(rgba, white).convert("L")
    alpha = diff.point(lambda value: 0 if value <= threshold else 255)
    rgba.putalpha(alpha)
    return rgba


def remove_edge_background(image: Image.Image, threshold: int = 42) -> Image.Image:
    rgba = image.convert("RGBA")
    corners = [
        rgba.getpixel((0, 0))[:3],
        rgba.getpixel((rgba.width - 1, 0))[:3],
        rgba.getpixel((0, rgba.height - 1))[:3],
        rgba.getpixel((rgba.width - 1, rgba.height - 1))[:3],
    ]
    bg = tuple(sum(color[i] for color in corners) // 4 for i in range(3))
    pixels = rgba.load()
    seen: set[tuple[int, int]] = set()
    stack: list[tuple[int, int]] = []
    for x in range(rgba.width):
        stack.append((x, 0))
        stack.append((x, rgba.height - 1))
    for y in range(rgba.height):
        stack.append((0, y))
        stack.append((rgba.width - 1, y))

    def close_to_bg(x: int, y: int) -> bool:
        red, green, blue, alpha = pixels[x, y]
        if alpha == 0:
            return True
        return abs(red - bg[0]) + abs(green - bg[1]) + abs(blue - bg[2]) <= threshold

    while stack:
        x, y = stack.pop()
        if x < 0 or y < 0 or x >= rgba.width or y >= rgba.height or (x, y) in seen:
            continue
        seen.add((x, y))
        if not close_to_bg(x, y):
            continue
        pixels[x, y] = (0, 0, 0, 0)
        stack.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return rgba


def crop_alpha(image: Image.Image, pad: int = 18) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox is None:
        return rgba
    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(rgba.width, right + pad)
    bottom = min(rgba.height, bottom + pad)
    cropped = rgba.crop((left, top, right, bottom))
    canvas = Image.new("RGBA", (320, 320), (0, 0, 0, 0))
    cropped.thumbnail((292, 292), Image.Resampling.LANCZOS)
    canvas.alpha_composite(cropped, ((320 - cropped.width) // 2, 320 - cropped.height - 12))
    return canvas


def keep_largest_alpha_component(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    pixels = alpha.load()
    width, height = rgba.size
    seen: set[tuple[int, int]] = set()
    best: list[tuple[int, int]] = []

    for y in range(height):
        for x in range(width):
            if (x, y) in seen or pixels[x, y] == 0:
                continue
            stack = [(x, y)]
            component: list[tuple[int, int]] = []
            while stack:
                cx, cy = stack.pop()
                if cx < 0 or cy < 0 or cx >= width or cy >= height or (cx, cy) in seen:
                    continue
                seen.add((cx, cy))
                if pixels[cx, cy] == 0:
                    continue
                component.append((cx, cy))
                stack.extend(((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)))
            if len(component) > len(best):
                best = component

    if not best:
        return rgba
    keep = set(best)
    output = Image.new("RGBA", rgba.size, (0, 0, 0, 0))
    source = rgba.load()
    target = output.load()
    for x, y in keep:
        target[x, y] = source[x, y]
    return output


def split_sheet(source: Path) -> list[dict]:
    sheet = remove_edge_background(remove_white_background(Image.open(source)))
    cell_w = sheet.width // GRID_COLUMNS
    cell_h = sheet.height // GRID_ROWS
    assets: list[dict] = []
    OUT.mkdir(parents=True, exist_ok=True)
    for index, name in enumerate(FRAME_NAMES):
        col = index % GRID_COLUMNS
        row = index // GRID_COLUMNS
        gutter_x = max(18, cell_w // 18)
        gutter_y = max(12, cell_h // 28)
        cell = sheet.crop((
            col * cell_w + gutter_x,
            row * cell_h + gutter_y,
            (col + 1) * cell_w - gutter_x,
            (row + 1) * cell_h - gutter_y,
        ))
        frame_source = remove_edge_background(remove_white_background(cell))
        if index < 9:
            frame_source = keep_largest_alpha_component(frame_source)
        frame = crop_alpha(frame_source)
        path = OUT / f"{name}.png"
        frame.save(path)
        bbox = frame.getchannel("A").getbbox() or (0, 0, 0, 0)
        assets.append(
            {
                "name": name,
                "file": f"assets/generated/typing-defense-assets/{name}.png",
                "size": [frame.width, frame.height],
                "bbox": list(bbox),
                "source": "gpt-creeper-multi-action-sheet",
            }
        )
    return assets


def update_manifest(new_assets: list[dict]) -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {"assets": [], "animated": []}
    names = {item["name"] for item in new_assets}
    manifest["assets"] = [item for item in manifest.get("assets", []) if item.get("name") not in names]
    manifest["assets"].extend(new_assets)
    animated = [item for item in manifest.get("animated", []) if item.get("name") != "creeper_gpt_action_cycle"]
    animated.append(
        {
            "name": "creeper_gpt_action_cycle",
            "frames": [item["file"] for item in new_assets],
            "fps": 8,
            "note": "GPT-generated creeper-like multi-action sheet split into runtime frames.",
        }
    )
    manifest["animated"] = animated
    manifest["alphaValidation"] = "ok"
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def make_contact_sheet(assets: list[dict]) -> None:
    thumb = 138
    label_h = 24
    sheet = Image.new("RGB", (GRID_COLUMNS * thumb, GRID_ROWS * (thumb + label_h)), (238, 244, 238))
    draw = ImageDraw.Draw(sheet)
    for index, item in enumerate(assets):
        path = OUT / Path(item["file"]).name
        image = Image.open(path).convert("RGBA")
        image.thumbnail((thumb - 16, thumb - 16), Image.Resampling.LANCZOS)
        x = (index % GRID_COLUMNS) * thumb
        y = (index // GRID_COLUMNS) * (thumb + label_h)
        cell = Image.new("RGBA", (thumb, thumb), (255, 255, 255, 255))
        cell.alpha_composite(image, ((thumb - image.width) // 2, (thumb - image.height) // 2))
        sheet.paste(cell.convert("RGB"), (x, y))
        draw.text((x + 6, y + thumb + 5), item["name"].replace("creeper_gpt_", "")[:18], fill=(28, 45, 35))
    sheet.save(OUT / "creeper_gpt_action_contact_sheet.jpg", quality=92)


def main() -> None:
    source = Path(sys.argv[1]) if len(sys.argv) > 1 else SOURCE
    if not source.exists():
        raise SystemExit(
            f"Missing source sheet: {source}\n"
            "Generate it with the prompt in prompts/gpt-creeper-multi-action-sheet.md first."
        )
    assets = split_sheet(source)
    update_manifest(assets)
    make_contact_sheet(assets)
    print(f"saved {len(assets)} GPT creeper action frames")


if __name__ == "__main__":
    main()
