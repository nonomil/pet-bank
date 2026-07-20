"""Generate deterministic low-resolution WebP thumbnails for the home cards."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "scripts" / "home-image-thumbnails.json"


def load_config() -> dict:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    if config.get("version") != 1 or len(config.get("entries", [])) != 5:
        raise ValueError("home-image-thumbnails.json must contain five version 1 entries")
    return config


def is_webp(path: Path) -> bool:
    try:
        with Image.open(path) as image:
            return image.format == "WEBP"
    except (OSError, ValueError):
        return False


def generate(config: dict) -> int:
    generated = 0
    target_size = (int(config["width"]), int(config["height"]))
    for entry in config["entries"]:
        source = ROOT / entry["source"]
        output = ROOT / entry["output"]
        output.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as image:
            prepared = ImageOps.fit(
                image.convert("RGB"),
                target_size,
                method=Image.Resampling.LANCZOS,
                centering=(0.5, 0.5),
            )
            prepared.save(
                output,
                format="WEBP",
                quality=int(config.get("quality", 72)),
                method=int(config.get("method", 6)),
            )
            prepared.close()
        generated += 1
    return generated


def validate(config: dict) -> tuple[int, int, int]:
    checked = 0
    missing = 0
    oversized = 0
    expected_size = (int(config["width"]), int(config["height"]))
    for entry in config["entries"]:
        source = ROOT / entry["source"]
        output = ROOT / entry["output"]
        checked += 1
        if not output.is_file() or not is_webp(output):
            print(f"MISSING_WEBP {entry['output']}")
            missing += 1
            continue
        with Image.open(output) as image:
            if image.size != expected_size:
                print(f"DIMENSION_MISMATCH {entry['output']} {image.size} != {expected_size}")
                missing += 1
        if output.stat().st_size >= source.stat().st_size:
            print(f"NOT_SMALLER {entry['output']} {output.stat().st_size} >= {source.stat().st_size}")
            oversized += 1
    return checked, missing, oversized


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.write == args.check:
        parser.error("choose exactly one of --write or --check")

    config = load_config()
    if args.write:
        print(f"[home-image-thumbnails] generated={generate(config)}")
        return 0

    checked, missing, oversized = validate(config)
    print(f"[home-image-thumbnails] checked={checked} missing={missing} oversized={oversized}")
    return 1 if missing or oversized else 0


if __name__ == "__main__":
    sys.exit(main())
