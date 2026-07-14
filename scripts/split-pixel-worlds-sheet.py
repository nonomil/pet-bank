"""Split a regular raster asset sheet into named WebP cells."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--cols", type=int, required=True)
    parser.add_argument("--rows", type=int, required=True)
    parser.add_argument("--names", type=Path)
    parser.add_argument("--prefix")
    args = parser.parse_args()

    expected = args.cols * args.rows
    if args.names:
        names = [line.strip() for line in args.names.read_text(encoding="utf-8").splitlines() if line.strip()]
    elif args.prefix:
        names = [f"{args.prefix}-{index + 1:02d}" for index in range(expected)]
    else:
        raise SystemExit("provide --names or --prefix")
    if len(names) != expected:
        raise SystemExit(f"expected {expected} names, got {len(names)}")
    with Image.open(args.input) as image:
        image = image.convert("RGBA")
        cell_w = image.width // args.cols
        cell_h = image.height // args.rows
        if cell_w < 32 or cell_h < 32:
            raise SystemExit(f"sheet cells are too small: {cell_w}x{cell_h}")
        args.out.mkdir(parents=True, exist_ok=True)
        for index, name in enumerate(names):
            row, col = divmod(index, args.cols)
            crop = image.crop((col * cell_w, row * cell_h, (col + 1) * cell_w, (row + 1) * cell_h))
            crop.save(args.out / f"{name}.webp", "WEBP", quality=88, method=6)
    print(f"SPLIT={args.out} count={expected} cell={cell_w}x{cell_h}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
