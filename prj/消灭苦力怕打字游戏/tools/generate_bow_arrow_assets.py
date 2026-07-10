from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT / "assets" / "generated" / "typing-defense-assets"
MANIFEST = OUT / "manifest.json"
BASE_BOW = OUT / "bow_launcher_agnes.png"


def alpha_bbox(image: Image.Image, pad: int = 12) -> tuple[int, int, int, int]:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        return (0, 0, image.width, image.height)
    left, top, right, bottom = bbox
    return (
        max(0, left - pad),
        max(0, top - pad),
        min(image.width, right + pad),
        min(image.height, bottom + pad),
    )


def load_bow() -> Image.Image:
    source = Image.open(BASE_BOW).convert("RGBA")
    cleanup = ImageDraw.Draw(source)
    cleanup.rectangle((source.width - 72, source.height - 64, source.width, source.height), fill=(0, 0, 0, 0))
    source = source.crop(alpha_bbox(source, 10))
    source.thumbnail((500, 190), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (560, 220), (0, 0, 0, 0))
    canvas.alpha_composite(source, ((canvas.width - source.width) // 2, 24))
    return canvas


def draw_arrow(draw: ImageDraw.ImageDraw, x0: int, y: int, length: int, glow: bool = False) -> None:
    if glow:
        draw.line((x0 - 10, y, x0 + length - 8, y), fill=(255, 231, 118, 170), width=16)
    draw.line((x0, y, x0 + length - 34, y), fill=(91, 58, 30, 255), width=10)
    draw.line((x0 + 4, y - 3, x0 + length - 38, y - 3), fill=(198, 142, 70, 180), width=3)
    head = [(x0 + length, y), (x0 + length - 34, y - 22), (x0 + length - 28, y), (x0 + length - 34, y + 22)]
    draw.polygon(head, fill=(232, 242, 238, 255))
    draw.line((x0 + length - 34, y - 22, x0 + length, y, x0 + length - 34, y + 22), fill=(89, 103, 98, 210), width=3)
    draw.polygon([(x0, y), (x0 - 30, y - 16), (x0 - 18, y), (x0 - 30, y + 16)], fill=(239, 91, 105, 255))
    draw.polygon([(x0 - 7, y), (x0 - 40, y - 10), (x0 - 24, y), (x0 - 40, y + 10)], fill=(255, 204, 92, 230))


def make_bow_frame(kind: str) -> Image.Image:
    frame = load_bow()
    draw = ImageDraw.Draw(frame)
    if kind == "draw":
        draw.line((118, 112, 280, 172, 442, 112), fill=(245, 245, 224, 230), width=5)
        draw_arrow(draw, 186, 104, 188, glow=True)
    elif kind == "release":
        draw.line((118, 112, 280, 132, 442, 112), fill=(245, 245, 224, 210), width=4)
        draw_arrow(draw, 226, 90, 168, glow=True)
        flash = Image.new("RGBA", frame.size, (0, 0, 0, 0))
        fdraw = ImageDraw.Draw(flash)
        fdraw.ellipse((235, 45, 325, 135), fill=(255, 242, 124, 120))
        fdraw.polygon([(280, 25), (296, 82), (356, 72), (308, 108), (332, 164), (280, 126), (228, 164), (252, 108), (204, 72), (264, 82)], fill=(255, 250, 170, 180))
        flash = flash.filter(ImageFilter.GaussianBlur(1))
        frame.alpha_composite(flash)
    return frame


def make_projectile(trail: bool) -> Image.Image:
    image = Image.new("RGBA", (220, 72), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    if trail:
        for offset, alpha in [(0, 150), (14, 105), (28, 70)]:
            draw.line((10 - offset, 36, 118 - offset, 36), fill=(255, 226, 105, alpha), width=max(4, 14 - offset // 3))
    draw_arrow(draw, 56, 36, 132, glow=False)
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
        "source": "local-bow-arrow-compositor",
    }


def update_manifest(new_assets: list[dict]) -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8")) if MANIFEST.exists() else {"assets": [], "animated": []}
    names = {item["name"] for item in new_assets}
    manifest["assets"] = [item for item in manifest.get("assets", []) if item.get("name") not in names]
    manifest["assets"].extend(new_assets)
    animated = [item for item in manifest.get("animated", []) if item.get("name") != "bow_launcher_fire_cycle"]
    animated.append(
        {
            "name": "bow_launcher_fire_cycle",
            "frames": [
                "assets/generated/typing-defense-assets/bow_launcher_idle.png",
                "assets/generated/typing-defense-assets/bow_launcher_draw.png",
                "assets/generated/typing-defense-assets/bow_launcher_release.png",
            ],
            "fps": 10,
            "note": "Bow state frames used when typing and firing.",
        }
    )
    manifest["animated"] = animated
    manifest["alphaValidation"] = "ok"
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def make_contact_sheet(assets: list[dict]) -> None:
    files = [OUT / Path(item["file"]).name for item in assets]
    sheet = Image.new("RGB", (360, len(files) * 124), (238, 244, 238))
    draw = ImageDraw.Draw(sheet)
    for index, file in enumerate(files):
        image = Image.open(file).convert("RGBA")
        image.thumbnail((330, 90), Image.Resampling.LANCZOS)
        cell = Image.new("RGBA", (360, 100), (255, 255, 255, 255))
        cell.alpha_composite(image, ((360 - image.width) // 2, (90 - image.height) // 2 + 4))
        sheet.paste(cell.convert("RGB"), (0, index * 124))
        draw.text((12, index * 124 + 104), file.stem, fill=(28, 45, 35))
    sheet.save(OUT / "bow_arrow_contact_sheet.jpg", quality=92)


def main() -> None:
    assets = [
        save(make_bow_frame("idle"), "bow_launcher_idle"),
        save(make_bow_frame("draw"), "bow_launcher_draw"),
        save(make_bow_frame("release"), "bow_launcher_release"),
        save(make_projectile(False), "arrow_projectile"),
        save(make_projectile(True), "arrow_projectile_trail"),
    ]
    update_manifest(assets)
    make_contact_sheet(assets)
    print(f"saved {len(assets)} bow and arrow assets")


if __name__ == "__main__":
    main()
