from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[3]
PROJECT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "pets" / "poses"
OUT = PROJECT / "assets" / "generated" / "typing-defense-assets"


def alpha_bbox(image: Image.Image, pad: int = 24) -> tuple[int, int, int, int]:
    rgba = image.convert("RGBA")
    bbox = rgba.getchannel("A").getbbox()
    if bbox is None:
        return (0, 0, rgba.width, rgba.height)
    left, top, right, bottom = bbox
    return (
        max(0, left - pad),
        max(0, top - pad),
        min(rgba.width, right + pad),
        min(rgba.height, bottom + pad),
    )


def fit_asset(path: Path, size: tuple[int, int], pad: int = 24) -> Image.Image:
    image = Image.open(path).convert("RGBA")
    cropped = image.crop(alpha_bbox(image, pad))
    cropped.thumbnail((size[0] - 24, size[1] - 24), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    x = (size[0] - cropped.width) // 2
    y = size[1] - cropped.height - 10
    canvas.alpha_composite(cropped, (x, y))
    return canvas


def save(image: Image.Image, name: str, assets: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f"{name}.png"
    image.save(path)
    bbox = image.getchannel("A").getbbox() or (0, 0, 0, 0)
    assets.append(
        {
            "name": name,
            "file": f"assets/generated/typing-defense-assets/{name}.png",
            "size": [image.width, image.height],
            "bbox": list(bbox),
        }
    )


def shadowed_subject(subject: Image.Image, strength: int = 80) -> Image.Image:
    alpha = subject.getchannel("A")
    shadow = Image.new("RGBA", subject.size, (0, 0, 0, 0))
    shadow_alpha = alpha.filter(ImageFilter.GaussianBlur(10)).point(lambda v: min(strength, v))
    shadow.putalpha(shadow_alpha)
    canvas = Image.new("RGBA", (subject.width, subject.height + 18), (0, 0, 0, 0))
    canvas.alpha_composite(shadow, (0, 18))
    canvas.alpha_composite(subject, (0, 0))
    return canvas


def make_walk_frame(base: Image.Image, shift_x: int, shift_y: int, tilt: float, squash: float) -> Image.Image:
    w, h = base.size
    scaled = base.resize((w, max(1, int(h * squash))), Image.Resampling.BICUBIC)
    rotated = scaled.rotate(tilt, resample=Image.Resampling.BICUBIC, expand=True)
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    x = (w - rotated.width) // 2 + shift_x
    y = h - rotated.height + shift_y
    canvas.alpha_composite(rotated, (x, y))
    return canvas


def make_approach_frames(base: Image.Image, name: str, assets: list[dict]) -> list[Image.Image]:
    frames: list[Image.Image] = []
    for i, scale in enumerate([0.42, 0.5, 0.6, 0.72, 0.84, 0.95, 1.06, 1.14]):
        canvas = Image.new("RGBA", (420, 420), (0, 0, 0, 0))
        bob = -5 if i % 2 else 0
        tilt = -1.4 if i % 4 == 1 else 1.4 if i % 4 == 3 else 0
        frame = make_walk_frame(base, 0, bob, tilt, 1.0)
        scaled = frame.resize((int(frame.width * scale), int(frame.height * scale)), Image.Resampling.LANCZOS)
        x = (canvas.width - scaled.width) // 2
        y = canvas.height - scaled.height
        canvas.alpha_composite(scaled, (x, y))
        frames.append(canvas)
        save(canvas, f"{name}_approach_{i}", assets)
    return frames


def make_heart(fill: tuple[int, int, int, int], outline: tuple[int, int, int, int], cracked: bool) -> Image.Image:
    unit = 8
    grid = [
        "0011001100",
        "0111111110",
        "1111111111",
        "1111111111",
        "0111111110",
        "0011111100",
        "0001111000",
        "0000110000",
    ]
    image = Image.new("RGBA", (96, 84), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    for y, row in enumerate(grid):
        for x, cell in enumerate(row):
            if cell == "1":
                rect = [x * unit + 8, y * unit + 8, x * unit + 15, y * unit + 15]
                draw.rectangle(rect, fill=fill)
    alpha = image.getchannel("A")
    edge = alpha.filter(ImageFilter.MaxFilter(5))
    outline_layer = Image.new("RGBA", image.size, outline)
    outline_layer.putalpha(edge)
    outline_layer.alpha_composite(image)
    if cracked:
        draw = ImageDraw.Draw(outline_layer)
        for rect in [(48, 20, 55, 35), (40, 36, 47, 51), (52, 52, 59, 60)]:
            draw.rectangle(rect, fill=(80, 37, 47, 230))
    return outline_layer


def make_star(fill: tuple[int, int, int, int], outline: tuple[int, int, int, int], empty: bool) -> Image.Image:
    image = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
    points = [(48, 8), (58, 34), (86, 34), (64, 52), (72, 82), (48, 64), (24, 82), (32, 52), (10, 34), (38, 34)]
    draw = ImageDraw.Draw(image)
    draw.polygon(points, fill=outline)
    inset = [(48, 18), (55, 40), (78, 40), (59, 54), (65, 76), (48, 61), (31, 76), (37, 54), (18, 40), (41, 40)]
    draw.polygon(inset, fill=(255, 255, 255, 60) if empty else fill)
    if not empty:
        draw.rectangle((43, 25, 52, 34), fill=(255, 255, 255, 130))
    return image


def make_particle(color: tuple[int, int, int, int]) -> Image.Image:
    image = Image.new("RGBA", (56, 56), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rectangle((14, 10, 41, 37), fill=color)
    draw.rectangle((27, 20, 50, 47), fill=(min(255, color[0] + 24), min(255, color[1] + 24), color[2], 220))
    draw.rectangle((22, 16, 32, 25), fill=(255, 255, 255, 96))
    return image


def make_impact_flash() -> Image.Image:
    image = Image.new("RGBA", (180, 180), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    points = [(90, 8), (108, 62), (166, 48), (122, 88), (170, 130), (110, 118), (90, 172), (72, 116), (12, 132), (58, 88), (16, 48), (72, 62)]
    draw.polygon(points, fill=(255, 230, 80, 210))
    draw.polygon([(90, 34), (103, 72), (138, 65), (112, 91), (140, 118), (102, 110), (90, 146), (78, 109), (40, 119), (68, 91), (42, 65), (77, 72)], fill=(255, 255, 255, 220))
    return image


def make_bubble() -> Image.Image:
    image = Image.new("RGBA", (256, 118), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((8, 8, 248, 96), radius=18, fill=(22, 38, 51, 242), outline=(199, 230, 242, 255), width=6)
    draw.polygon([(112, 96), (144, 96), (128, 116)], fill=(22, 38, 51, 242))
    draw.line([(112, 96), (128, 116), (144, 96)], fill=(199, 230, 242, 255), width=6)
    return image


def write_contact_sheet(assets: list[dict]) -> None:
    files = [OUT / Path(item["file"]).name for item in assets]
    thumb_w, thumb_h = 150, 150
    cols = 5
    rows = (len(files) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * thumb_w, rows * (thumb_h + 28)), (238, 244, 238))
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(files):
        image = Image.open(path).convert("RGBA")
        image.thumbnail((thumb_w - 16, thumb_h - 16), Image.Resampling.LANCZOS)
        cell_x = (index % cols) * thumb_w
        cell_y = (index // cols) * (thumb_h + 28)
        cell = Image.new("RGBA", (thumb_w, thumb_h), (255, 255, 255, 255))
        cell.alpha_composite(image, ((thumb_w - image.width) // 2, (thumb_h - image.height) // 2))
        sheet.paste(cell.convert("RGB"), (cell_x, cell_y))
        draw.text((cell_x + 6, cell_y + thumb_h + 4), path.stem[:22], fill=(28, 45, 35))
    sheet.save(OUT / "_preview_contact_sheet.jpg", quality=92)


def validate_alpha(assets: list[dict]) -> list[str]:
    errors: list[str] = []
    for item in assets:
        path = OUT / Path(item["file"]).name
        image = Image.open(path)
        if image.mode != "RGBA":
            errors.append(f"{path.name}: mode {image.mode}")
            continue
        corners = [
            image.getpixel((0, 0))[3],
            image.getpixel((image.width - 1, 0))[3],
            image.getpixel((0, image.height - 1))[3],
            image.getpixel((image.width - 1, image.height - 1))[3],
        ]
        if any(alpha != 0 for alpha in corners):
            errors.append(f"{path.name}: nontransparent corner {corners}")
    return errors


def main() -> None:
    assets: list[dict] = []
    OUT.mkdir(parents=True, exist_ok=True)

    creeper_idle = fit_asset(SOURCE / "mc_creeper_idle.webp", (300, 320))
    creeper_attack = fit_asset(SOURCE / "mc_creeper_attack.webp", (300, 320))
    creeper_happy = fit_asset(SOURCE / "mc_creeper_happy.webp", (300, 320))
    for name, image in [
        ("creeper_idle", creeper_idle),
        ("creeper_attack", creeper_attack),
        ("creeper_happy", creeper_happy),
    ]:
        save(shadowed_subject(image, 64), name, assets)

    walk_bases = [creeper_idle, make_walk_frame(creeper_idle, -8, 4, -2.5, 0.98), creeper_attack, make_walk_frame(creeper_idle, 8, 4, 2.5, 0.98)]
    for idx, image in enumerate(walk_bases):
        save(shadowed_subject(image, 64), f"creeper_walk_{idx}", assets)

    for name, image in [
        ("heart_full", make_heart((244, 65, 76, 255), (99, 35, 45, 255), False)),
        ("heart_empty", make_heart((255, 255, 255, 58), (96, 105, 112, 210), False)),
        ("heart_cracked", make_heart((244, 65, 76, 255), (99, 35, 45, 255), True)),
        ("star_full", make_star((255, 210, 54, 255), (125, 81, 20, 255), False)),
        ("star_empty", make_star((255, 255, 255, 40), (126, 130, 112, 180), True)),
        ("particle_green", make_particle((80, 202, 86, 235))),
        ("particle_gold", make_particle((255, 210, 54, 235))),
        ("impact_flash", make_impact_flash()),
        ("target_bubble_blank", make_bubble()),
    ]:
        save(image, name, assets)

    bow_asset = OUT / "bow_launcher_agnes.png"
    if bow_asset.exists():
        image = Image.open(bow_asset).convert("RGBA")
        bbox = image.getchannel("A").getbbox() or (0, 0, 0, 0)
        assets.append(
            {
                "name": "bow_launcher_agnes",
                "file": "assets/generated/typing-defense-assets/bow_launcher_agnes.png",
                "size": [image.width, image.height],
                "bbox": list(bbox),
                "source": "agnes-image-2.1-flash",
            }
        )

    alpha_errors = validate_alpha(assets)
    manifest = {
        "name": "typing-defense-assets",
        "status": "project-derived-v1",
        "note": "Derived from existing project MC pose assets plus local pixel UI art. Replace same filenames after GPT/Agnes asset generation.",
        "alphaValidation": "ok" if not alpha_errors else alpha_errors,
        "preview": "assets/generated/typing-defense-assets/_preview_contact_sheet.jpg",
        "animated": [],
        "assets": assets,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    write_contact_sheet(assets)
    if alpha_errors:
        raise SystemExit("; ".join(alpha_errors))


if __name__ == "__main__":
    main()
