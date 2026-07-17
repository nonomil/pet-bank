"""Generate and validate WebP publish variants while keeping source images intact."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError as error:  # pragma: no cover - environment guard
    raise SystemExit("Pillow is required: python -m pip install Pillow") from error


ROOT = Path(__file__).resolve().parents[1]
CONFIG_PATH = ROOT / "scripts" / "runtime-image-variants.json"


def load_config() -> dict:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    if config.get("version") != 1 or not config.get("sets"):
        raise ValueError("runtime-image-variants.json must contain version 1 sets")
    return config


def iter_entries(config: dict):
    seen: set[Path] = set()
    for image_set in config["sets"]:
        source_dir = ROOT / image_set["sourceDir"]
        if not source_dir.is_dir():
            raise FileNotFoundError(f"missing source directory: {image_set['sourceDir']}")
        for pattern in image_set["include"]:
            for source in sorted(source_dir.glob(pattern)):
                if not source.is_file() or source in seen:
                    continue
                seen.add(source)
                relative = source.relative_to(source_dir).as_posix()
                runtime_path = f"{image_set['runtimePrefix'].rstrip('/')}/{relative}"
                variant = source.with_suffix(".webp")
                yield image_set, source, variant, runtime_path


def is_webp(path: Path) -> bool:
    try:
        with Image.open(path) as image:
            return image.format == "WEBP"
    except (OSError, ValueError):
        return False


def convert(source: Path, variant: Path, image_set: dict, force: bool) -> bool:
    if (
        not force
        and variant.exists()
        and variant.stat().st_mtime_ns >= source.stat().st_mtime_ns
        and is_webp(variant)
    ):
        return False

    with Image.open(source) as image:
        has_alpha = "A" in image.getbands() or "transparency" in image.info
        prepared = image.convert("RGBA" if has_alpha else "RGB")
        try:
            save_options = {
                "format": "WEBP",
                "method": 6,
                "quality": int(image_set.get("quality", 82)),
            }
            if image_set.get("lossless"):
                save_options["lossless"] = True
            prepared.save(variant, **save_options)
        finally:
            prepared.close()
    return True


def validate(config: dict) -> tuple[int, int, int]:
    checked = 0
    missing = 0
    larger = 0
    for _image_set, source, variant, _runtime_path in iter_entries(config):
        checked += 1
        if not variant.is_file() or not is_webp(variant):
            print(f"MISSING_WEBP {variant.relative_to(ROOT).as_posix()}")
            missing += 1
            continue
        with Image.open(source) as source_image, Image.open(variant) as variant_image:
            if source_image.size != variant_image.size:
                print(f"DIMENSION_MISMATCH {source.relative_to(ROOT)} {variant.relative_to(ROOT)}")
                missing += 1
        if variant.stat().st_size > source.stat().st_size:
            print(
                f"LARGER_THAN_SOURCE {variant.relative_to(ROOT).as_posix()} "
                f"{variant.stat().st_size} > {source.stat().st_size}"
            )
            larger += 1
    return checked, missing, larger


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="generate missing or stale variants")
    parser.add_argument("--force", action="store_true", help="regenerate all variants with --write")
    parser.add_argument("--check", action="store_true", help="validate all configured variants")
    args = parser.parse_args()
    if not args.write and not args.check:
        parser.error("choose --write or --check")

    config = load_config()
    generated = 0
    if args.write:
        for image_set, source, variant, _runtime_path in iter_entries(config):
            variant.parent.mkdir(parents=True, exist_ok=True)
            if convert(source, variant, image_set, args.force):
                generated += 1
        print(f"[runtime-image-variants] generated={generated}")

    if args.check:
        checked, missing, larger = validate(config)
        print(f"[runtime-image-variants] checked={checked} missing={missing} larger={larger}")
        if missing or larger:
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
