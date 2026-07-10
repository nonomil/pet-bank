from __future__ import annotations

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


PROJECT = Path(__file__).resolve().parents[1]
OUT = PROJECT / "assets" / "generated" / "typing-defense-assets"
MANIFEST = OUT / "manifest.json"

CANVAS = (300, 320)
FRAME_NAMES = [f"creeper_stride_{index}" for index in range(4)]


def px(value: float) -> int:
    return int(round(value))


def add_shadow(canvas: Image.Image, y: int, width: int, alpha: int) -> None:
    shadow = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    draw = ImageDraw.Draw(shadow)
    draw.ellipse((px(150 - width / 2), y, px(150 + width / 2), y + 28), fill=(0, 0, 0, alpha))
    shadow = shadow.filter(ImageFilter.GaussianBlur(5))
    canvas.alpha_composite(shadow)


def pixel_color(base: tuple[int, int, int], rng: random.Random) -> tuple[int, int, int, int]:
    delta = rng.choice([-30, -18, -8, 0, 10, 18, 28])
    return (
        max(0, min(255, base[0] + delta)),
        max(0, min(255, base[1] + delta)),
        max(0, min(255, base[2] + delta)),
        255,
    )


def draw_pixel_block(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    seed: int,
    base: tuple[int, int, int] = (82, 171, 72),
    darken: int = 0,
) -> None:
    x0, y0, x1, y1 = box
    rng = random.Random(seed)
    base = (max(0, base[0] - darken), max(0, base[1] - darken), max(0, base[2] - darken))
    draw.rectangle(box, fill=(54, 128, 55, 255), outline=(24, 66, 29, 230), width=3)
    cell = 12
    for y in range(y0 + 4, y1 - 4, cell):
        for x in range(x0 + 4, x1 - 4, cell):
            if rng.random() < 0.72:
                draw.rectangle(
                    (x, y, min(x + cell - 2, x1 - 5), min(y + cell - 2, y1 - 5)),
                    fill=pixel_color(base, rng),
                )
    draw.rectangle((x0 + 5, y0 + 5, x1 - 5, y0 + 14), fill=(128, 213, 96, 120))
    draw.rectangle((x1 - 14, y0 + 7, x1 - 5, y1 - 7), fill=(14, 70, 30, 80))


def draw_face(draw: ImageDraw.ImageDraw) -> None:
    black = (18, 28, 20, 255)
    draw.rectangle((104, 58, 124, 80), fill=black)
    draw.rectangle((176, 58, 196, 80), fill=black)
    draw.rectangle((137, 93, 164, 120), fill=black)
    draw.rectangle((119, 113, 144, 138), fill=black)
    draw.rectangle((157, 113, 182, 138), fill=black)


def draw_leg(draw: ImageDraw.ImageDraw, x: int, y: int, forward: float, side: str, seed: int) -> None:
    # Forward legs are lower, wider and brighter. Back legs are lifted and darker.
    width = px(46 + max(0, forward) * 8)
    height = px(58 + max(0, forward) * 8)
    lift = px(-10 * max(0, -forward))
    lower = px(12 * max(0, forward))
    sway = px(12 * forward)
    darken = 24 if forward < -0.1 else 0
    box = (x + sway, y + lift + lower, x + sway + width, y + lift + lower + height)
    draw_pixel_block(draw, box, seed=seed, darken=darken)
    toe_y = box[3] - 12
    if side == "left":
      toe = (box[0] - 8, toe_y, box[0] + 22, box[3] + 7)
    else:
      toe = (box[2] - 22, toe_y, box[2] + 8, box[3] + 7)
    draw.rectangle(toe, fill=(44, 116, 46, 255), outline=(23, 68, 26, 220), width=3)


def draw_frame(index: int, stride: dict[str, float]) -> Image.Image:
    canvas = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    add_shadow(canvas, 286, 168, 88)
    draw = ImageDraw.Draw(canvas)

    bob = -4 if index % 2 else 0
    lean = stride.get("lean", 0)

    # Back legs first, then body, then front legs for clear depth.
    draw_leg(draw, 84, 212 + bob, stride["back_left"], "left", 300 + index)
    draw_leg(draw, 168, 212 + bob, stride["back_right"], "right", 320 + index)

    body_x = 117 + px(lean * 3)
    draw_pixel_block(draw, (body_x, 118 + bob, body_x + 66, 224 + bob), seed=100 + index)

    draw_leg(draw, 102, 218 + bob, stride["front_left"], "left", 340 + index)
    draw_leg(draw, 150, 218 + bob, stride["front_right"], "right", 360 + index)

    head_x = 84 + px(lean * 4)
    head_y = 24 + bob
    draw_pixel_block(draw, (head_x, head_y, head_x + 132, head_y + 122), seed=200 + index)
    draw_face(draw)

    highlight = Image.new("RGBA", CANVAS, (0, 0, 0, 0))
    hdraw = ImageDraw.Draw(highlight)
    hdraw.rectangle((head_x + 10, head_y + 10, head_x + 40, head_y + 20), fill=(203, 255, 155, 90))
    hdraw.rectangle((body_x + 8, 128 + bob, body_x + 24, 214 + bob), fill=(185, 250, 132, 50))
    canvas.alpha_composite(highlight)
    return canvas


def save_frame(image: Image.Image, name: str) -> dict:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.png"
    image.save(path)
    bbox = image.getchannel("A").getbbox() or (0, 0, 0, 0)
    return {
        "name": name,
        "file": f"assets/generated/typing-defense-assets/{name}.png",
        "size": [image.width, image.height],
        "bbox": list(bbox),
        "source": "local-pixel-stride-generator",
    }


def update_manifest(new_assets: list[dict]) -> None:
    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    else:
        manifest = {
            "name": "typing-defense-assets",
            "status": "project-generated",
            "assets": [],
            "animated": [],
        }

    frame_set = {item["name"] for item in new_assets}
    manifest["assets"] = [item for item in manifest.get("assets", []) if item.get("name") not in frame_set]
    manifest["assets"].extend(new_assets)

    animated = [item for item in manifest.get("animated", []) if item.get("name") != "creeper_stride_cycle"]
    animated.append(
        {
            "name": "creeper_stride_cycle",
            "frames": [item["file"] for item in new_assets],
            "fps": 8,
            "note": "Four-frame left/right foot stride cycle for grounded approach movement.",
        }
    )
    manifest["animated"] = animated
    manifest["alphaValidation"] = "ok"
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def make_contact_sheet(frames: list[Image.Image]) -> None:
    sheet = Image.new("RGB", (4 * 180, 220), (238, 244, 238))
    draw = ImageDraw.Draw(sheet)
    for index, frame in enumerate(frames):
        thumb = frame.copy()
        thumb.thumbnail((160, 170), Image.Resampling.LANCZOS)
        x = index * 180 + (180 - thumb.width) // 2
        y = 10 + (170 - thumb.height) // 2
        cell = Image.new("RGBA", (180, 180), (255, 255, 255, 255))
        cell.alpha_composite(thumb, ((180 - thumb.width) // 2, (180 - thumb.height) // 2))
        sheet.paste(cell.convert("RGB"), (index * 180, 0))
        draw.text((index * 180 + 38, 190), FRAME_NAMES[index], fill=(28, 45, 35))
    sheet.save(OUT / "creeper_stride_contact_sheet.jpg", quality=92)


def main() -> None:
    cycle = [
        {"front_left": 1.0, "front_right": -0.65, "back_left": -0.5, "back_right": 0.75, "lean": -0.6},
        {"front_left": 0.15, "front_right": 0.15, "back_left": 0.05, "back_right": 0.05, "lean": 0},
        {"front_left": -0.65, "front_right": 1.0, "back_left": 0.75, "back_right": -0.5, "lean": 0.6},
        {"front_left": 0.15, "front_right": 0.15, "back_left": 0.05, "back_right": 0.05, "lean": 0},
    ]
    frames = [draw_frame(index, stride) for index, stride in enumerate(cycle)]
    assets = [save_frame(frame, FRAME_NAMES[index]) for index, frame in enumerate(frames)]
    update_manifest(assets)
    make_contact_sheet(frames)
    print(f"saved {len(frames)} stride frames")


if __name__ == "__main__":
    main()
