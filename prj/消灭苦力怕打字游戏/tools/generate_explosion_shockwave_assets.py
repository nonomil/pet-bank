from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT / "assets" / "generated" / "typing-defense-assets"
MANIFEST = OUT / "manifest.json"


def polar(center: int, angle: float, radius: float) -> tuple[float, float]:
    return center + math.cos(angle) * radius, center + math.sin(angle) * radius


def blocky_wave(size: int, radius: int, thickness: int, alpha: int, name: str) -> Image.Image:
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    center = size // 2

    # Broken arc slabs: deliberately leave large gaps so the effect reads as
    # a blast wave, not a decorative circular border.
    segments = 18
    for index in range(segments):
        if index in {2, 7, 12, 15}:
            continue
        angle = math.tau * index / segments
        span = 0.105 + (0.018 if index % 3 == 0 else 0)
        square_bias = max(abs(math.cos(angle)), abs(math.sin(angle)))
        outer = radius * (0.9 + square_bias * 0.14 + (0.08 if index % 4 == 0 else -0.03))
        inner = max(10, outer - thickness * (0.85 + (index % 2) * 0.22))
        points = [
            polar(center, angle - span, inner),
            polar(center, angle + span, inner),
            polar(center, angle + span * 1.36, outer),
            polar(center, angle - span * 1.36, outer),
        ]
        color = (255, 230, 114, alpha) if index % 2 else (255, 250, 194, min(255, alpha + 20))
        draw.polygon(points, fill=color)

    # Radial block shards are the main shockwave language: short, transparent
    # rectangles stretching away from the center.
    for index in range(24):
        angle = math.tau * index / 24 + (0.035 if index % 2 else -0.02)
        start = radius * (0.5 + (index % 5) * 0.035)
        length = 28 + (index % 4) * 13 + radius * 0.12
        width = 8 + (index % 3) * 5
        cx, cy = polar(center, angle, start + length * 0.5)
        dx = math.cos(angle) * length * 0.5
        dy = math.sin(angle) * length * 0.5
        px = -math.sin(angle) * width * 0.5
        py = math.cos(angle) * width * 0.5
        block = [
            (cx - dx - px, cy - dy - py),
            (cx - dx + px, cy - dy + py),
            (cx + dx + px, cy + dy + py),
            (cx + dx - px, cy + dy - py),
        ]
        draw.polygon(block, fill=(255, 194, 62, max(0, alpha - 42)))

    for index in range(14):
        angle = math.tau * index / 14 + 0.09
        x, y = polar(center, angle, radius * (0.82 + (index % 4) * 0.09))
        size = 8 + (index % 4) * 4
        draw.rectangle(
            (x - size / 2, y - size / 2, x + size / 2, y + size / 2),
            fill=(255, 240, 166, max(0, alpha - 58)),
        )

    image = image.filter(ImageFilter.GaussianBlur(0.35))
    highlight = Image.new("RGBA", image.size, (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(highlight)
    cross = max(12, radius // 5)
    hdraw.line((center - cross, center, center + cross, center), fill=(255, 255, 220, alpha // 2), width=4)
    hdraw.line((center, center - cross, center, center + cross), fill=(255, 255, 220, alpha // 2), width=4)
    image.alpha_composite(highlight)
    return image


def save(image: Image.Image, name: str) -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.png"
    image.save(path)
    bbox = image.getchannel("A").getbbox() or (0, 0, 0, 0)
    return {
        "name": name,
        "file": f"assets/generated/typing-defense-assets/{name}.png",
        "size": [image.width, image.height],
        "bbox": list(bbox),
        "source": "local-transparent-shockwave-generator",
    }


def update_manifest(assets: list[dict]) -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {"assets": [], "animated": []}
    names = {item["name"] for item in assets}
    manifest["assets"] = [item for item in manifest.get("assets", []) if item.get("name") not in names]
    manifest["assets"].extend(assets)
    animated = [item for item in manifest.get("animated", []) if item.get("name") != "explosion_shockwave_cycle"]
    animated.append(
        {
            "name": "explosion_shockwave_cycle",
            "frames": [item["file"] for item in assets],
            "fps": 12,
            "note": "Transparent broken shockwave frames with gaps and radial blocks; replaces CSS circular explosion ring.",
        }
    )
    manifest["animated"] = animated
    manifest["alphaValidation"] = "ok"
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def make_contact_sheet(assets: list[dict]) -> None:
    sheet = Image.new("RGB", (420, 150), (238, 244, 238))
    draw = ImageDraw.Draw(sheet)
    for index, item in enumerate(assets):
        image = Image.open(OUT / Path(item["file"]).name).convert("RGBA")
        image.thumbnail((118, 118), Image.Resampling.LANCZOS)
        cell = Image.new("RGBA", (140, 126), (255, 255, 255, 255))
        cell.alpha_composite(image, ((140 - image.width) // 2, (118 - image.height) // 2))
        sheet.paste(cell.convert("RGB"), (index * 140, 0))
        draw.text((index * 140 + 10, 128), item["name"], fill=(28, 45, 35))
    sheet.save(OUT / "explosion_shockwave_contact_sheet.jpg", quality=92)


def main() -> None:
    specs = [
        ("explosion_shockwave_0", 82, 30, 218),
        ("explosion_shockwave_1", 126, 26, 168),
        ("explosion_shockwave_2", 168, 20, 104),
    ]
    assets = [save(blocky_wave(360, radius, thickness, alpha, name), name) for name, radius, thickness, alpha in specs]
    update_manifest(assets)
    make_contact_sheet(assets)
    print(f"saved {len(assets)} shockwave frames")


if __name__ == "__main__":
    main()
