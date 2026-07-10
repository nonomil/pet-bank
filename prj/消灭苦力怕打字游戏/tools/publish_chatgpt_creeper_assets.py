from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops


ROOT = Path(r"G:\StudyCode\宠物积分系统\prj\消灭苦力怕打字游戏")
REFERENCE_DIR = ROOT / "assets" / "generated" / "reference"
PUBLISHED_DIR = ROOT / "assets" / "generated" / "typing-defense-assets"
MANIFEST_PATH = PUBLISHED_DIR / "chatgpt-creeper-manifest.json"

TARGET_SIZE = 1024
ASSET_NAMES = [
    "creeper_generated_far",
    "creeper_generated_mid",
    "creeper_generated_near",
    "creeper_generated_danger",
    "creeper_explosion_0",
    "creeper_explosion_1",
    "creeper_explosion_2",
]


def trim_alpha(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return image
    return image.crop(bbox)


def white_to_alpha(image: Image.Image, threshold: int = 22) -> Image.Image:
    rgba = image.convert("RGBA")
    rgb = rgba.convert("RGB")
    white = Image.new("RGB", rgba.size, (255, 255, 255))
    diff = ImageChops.difference(rgb, white)
    mask = diff.convert("L").point(lambda x: 0 if x < threshold else 255)
    rgba.putalpha(mask)
    return trim_alpha(rgba)


def fit_canvas(image: Image.Image, target: int = TARGET_SIZE) -> Image.Image:
    image = image.convert("RGBA")
    width, height = image.size
    scale = target / max(width, height)
    if abs(scale - 1) > 1e-6:
      image = image.resize(
          (max(1, int(round(width * scale))), max(1, int(round(height * scale)))),
          Image.LANCZOS,
      )
    canvas = Image.new("RGBA", (target, target), (0, 0, 0, 0))
    x = (target - image.width) // 2
    y = (target - image.height) // 2
    canvas.paste(image, (x, y), image)
    return canvas


def publish_file(source: Path, dest: Path) -> dict:
    image = Image.open(source)
    processed = fit_canvas(white_to_alpha(image))
    processed.save(dest, "PNG")
    alpha_bbox = processed.getchannel("A").getbbox()
    return {
        "name": dest.stem,
        "source": str(source),
        "file": str(dest),
        "size": list(processed.size),
        "alpha_bbox": list(alpha_bbox) if alpha_bbox else None,
        "bytes": dest.stat().st_size,
    }


def resolve_inputs(input_dir: Path) -> list[Path]:
    files = []
    for name in ASSET_NAMES:
        candidate = input_dir / f"{name}.png"
        if not candidate.exists():
            raise FileNotFoundError(f"Missing input asset: {candidate}")
        files.append(candidate)
    return files


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish ChatGPT creeper assets into the prototype asset folder.")
    parser.add_argument(
        "--input-dir",
        default=str(REFERENCE_DIR),
        help="Directory containing semantic PNG files exported from ChatGPT.",
    )
    args = parser.parse_args()

    input_dir = Path(args.input_dir)
    PUBLISHED_DIR.mkdir(parents=True, exist_ok=True)

    manifest = {
        "source_dir": str(input_dir),
        "assets": [],
    }

    for source in resolve_inputs(input_dir):
        dest = PUBLISHED_DIR / source.name
        manifest["assets"].append(publish_file(source, dest))

    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(MANIFEST_PATH)


if __name__ == "__main__":
    main()
