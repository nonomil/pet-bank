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
    parser.add_argument("--inset", type=int, default=0, help="crop this many pixels inside each grid cell")
    parser.add_argument("--inset-x", type=int, help="horizontal inset; overrides --inset")
    parser.add_argument("--inset-y", type=int, help="vertical inset; overrides --inset")
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
    inset_x = args.inset if args.inset_x is None else args.inset_x
    inset_y = args.inset if args.inset_y is None else args.inset_y
    with Image.open(args.input) as image:
        image = image.convert("RGBA")
        cell_w = image.width // args.cols
        cell_h = image.height // args.rows
        if cell_w < 32 or cell_h < 32 or inset_x * 2 >= cell_w or inset_y * 2 >= cell_h:
            raise SystemExit(f"sheet cells are too small: {cell_w}x{cell_h}")
        args.out.mkdir(parents=True, exist_ok=True)
        for index, name in enumerate(names):
            row, col = divmod(index, args.cols)
            crop = image.crop((
                col * cell_w + inset_x,
                row * cell_h + inset_y,
                (col + 1) * cell_w - inset_x,
                (row + 1) * cell_h - inset_y,
            ))
            crop.save(args.out / f"{name}.webp", "WEBP", quality=88, method=6)
    print(f"SPLIT={args.out} count={expected} cell={cell_w}x{cell_h}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
