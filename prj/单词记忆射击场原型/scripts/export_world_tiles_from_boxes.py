#!/usr/bin/env python3
"""Crop a stitched world image into named 3x3 tile assets from a boxes JSON file."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Path to the stitched source image")
    parser.add_argument("--boxes", required=True, help="Path to the crop boxes json")
    parser.add_argument("--out", required=True, help="Directory for cropped tile pngs")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    source = Path(args.source)
    boxes_path = Path(args.boxes)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    with boxes_path.open("r", encoding="utf-8") as fh:
        boxes = json.load(fh)

    image = Image.open(source).convert("RGBA")
    for region in boxes.get("regions", []):
        name = region["name"]
        x = int(region["x"])
        y = int(region["y"])
        w = int(region["w"])
        h = int(region["h"])
        tile = image.crop((x, y, x + w, y + h))
        tile.save(out_dir / f"{name}.png")
        print(f"SAVED={(out_dir / f'{name}.png')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
