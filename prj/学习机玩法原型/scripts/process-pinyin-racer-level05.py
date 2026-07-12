from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "拼音赛车" / "拼音赛车参考图-05--赛道终点--爆炸图.png"
OUT_DIR = ROOT / "assets" / "generated" / "pinyin-racer-semantic-assets" / "level-05"


CROPS = {
    "initial_sound_gate": (0, 130, 430, 620),
    "fork_gate_pair": (340, 130, 890, 620),
    "tone_hanging_sign": (820, 125, 1254, 625),
    "picture_supply_kiosk": (0, 650, 445, 1180),
    "listening_tunnel_gate": (355, 645, 890, 1180),
    "finish_sprint_arch": (785, 645, 1254, 1180),
}


def remove_green(image: Image.Image, hard_distance: float = 72.0, feather_distance: float = 132.0) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            r, g, b, _ = pixels[x, y]
            distance = math.sqrt(r * r + (255 - g) * (255 - g) + b * b)
            if distance <= hard_distance:
                pixels[x, y] = (r, g, b, 0)
            elif distance < feather_distance:
                alpha = int(255 * (distance - hard_distance) / (feather_distance - hard_distance))
                pixels[x, y] = (r, g, b, max(0, min(255, alpha)))
    return rgba


def trim_alpha(image: Image.Image, pad: int = 4) -> Image.Image:
    bbox = image.getchannel("A").getbbox()
    if not bbox:
        return image
    left, top, right, bottom = bbox
    cropped = image.crop((max(0, left - pad), max(0, top - pad), min(image.width, right + pad), min(image.height, bottom + pad)))
    pixels = cropped.load()
    for x in range(cropped.width):
        pixels[x, 0] = (*pixels[x, 0][:3], 0)
        pixels[x, cropped.height - 1] = (*pixels[x, cropped.height - 1][:3], 0)
    for y in range(cropped.height):
        pixels[0, y] = (*pixels[0, y][:3], 0)
        pixels[cropped.width - 1, y] = (*pixels[cropped.width - 1, y][:3], 0)
    return cropped


def edge_alpha_max(image: Image.Image) -> int:
    alpha = image.getchannel("A")
    edge = []
    edge.extend(alpha.crop((0, 0, image.width, 1)).getdata())
    edge.extend(alpha.crop((0, image.height - 1, image.width, image.height)).getdata())
    edge.extend(alpha.crop((0, 0, 1, image.height)).getdata())
    edge.extend(alpha.crop((image.width - 1, 0, image.width, image.height)).getdata())
    return max(edge, default=0)


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    source = remove_green(Image.open(SOURCE))
    manifest = {
        "source": "assets/拼音赛车/拼音赛车参考图-05--赛道终点--爆炸图.png",
        "sourceMode": "RGB green chroma-key source",
        "backgroundRemoval": "green distance key with feathered edge",
        "assets": [],
    }
    for name, box in CROPS.items():
        cleaned = trim_alpha(source.crop(box))
        output = OUT_DIR / f"{name}.png"
        cleaned.save(output)
        manifest["assets"].append({
            "name": name,
            "file": str(output.relative_to(ROOT)).replace("\\", "/"),
            "sourceBox": list(box),
            "size": [cleaned.width, cleaned.height],
            "mode": "RGBA",
            "edgeAlphaMax": edge_alpha_max(cleaned),
        })
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {len(manifest['assets'])} level-05 semantic assets")


if __name__ == "__main__":
    main()
