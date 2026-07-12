from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
PREPARED = ROOT / "assets" / "generated" / "pinyin-racer-prepared-assets"


def checkerboard(size: tuple[int, int]) -> Image.Image:
    width, height = size
    sheet = Image.new("RGB", size, "#ffffff")
    draw = ImageDraw.Draw(sheet)
    for y in range(0, height, 16):
        for x in range(0, width, 16):
            if (x // 16 + y // 16) % 2:
                draw.rectangle((x, y, x + 15, y + 15), fill="#e4ebf3")
    return sheet


def part_number(path: Path) -> int:
    try:
        return int(path.stem.split("-")[1].split("_")[0])
    except (IndexError, ValueError):
        return 9999


def classify(width: int, height: int, alpha_coverage: float) -> str:
    area = width * height
    ratio = width / max(1, height)
    if alpha_coverage < 0.08:
        return "tiny-fragment"
    if area >= 180_000:
        return "hero-component"
    if ratio >= 1.55:
        return "wide-component"
    if ratio <= 0.68:
        return "tall-component"
    return "compact-component"


def main() -> None:
    catalog: dict[str, object] = {
        "source": "assets/拼音赛车",
        "preparedDir": "assets/generated/pinyin-racer-prepared-assets",
        "processing": {
            "backgroundRemoval": "edge-connected checkerboard removal",
            "alphaValidation": "RGBA, all four outer edges alpha=0",
            "semanticStatus": "machine-split; review candidates before runtime wiring",
        },
        "levels": [],
    }

    for level_dir in sorted(PREPARED.glob("level-*")):
        split_dir = level_dir / "split"
        files = sorted(split_dir.glob("*.png"), key=part_number)
        entries: list[dict[str, object]] = []
        thumbs: list[tuple[str, Image.Image]] = []
        for file in files:
            with Image.open(file) as source:
                image = source.convert("RGBA")
                alpha = image.getchannel("A")
                alpha_box = alpha.getbbox()
                alpha_pixels = list(alpha.getdata())
                edge = []
                edge.extend(alpha.crop((0, 0, image.width, 1)).getdata())
                edge.extend(alpha.crop((0, image.height - 1, image.width, image.height)).getdata())
                edge.extend(alpha.crop((0, 0, 1, image.height)).getdata())
                edge.extend(alpha.crop((image.width - 1, 0, image.width, image.height)).getdata())
                coverage = sum(1 for value in alpha_pixels if value > 0) / max(1, len(alpha_pixels))
                entry = {
                    "file": str(file.relative_to(ROOT)).replace("\\", "/"),
                    "name": file.stem,
                    "size": [image.width, image.height],
                    "mode": "RGBA",
                    "alphaCoverage": round(coverage, 4),
                    "edgeAlphaMax": max(edge, default=0),
                    "alphaBounds": list(alpha_box) if alpha_box else None,
                    "candidateClass": classify(image.width, image.height, coverage),
                    "semanticStatus": "unreviewed",
                }
                entries.append(entry)
                preview = image.copy()
                preview.thumbnail((170, 118), Image.Resampling.LANCZOS)
                thumbs.append((file.stem, preview))

        cols = 4
        cell_w, cell_h = 220, 156
        rows = (len(thumbs) + cols - 1) // cols
        sheet = Image.new("RGB", (cols * cell_w, max(1, rows) * cell_h), "#f4f6fb")
        draw = ImageDraw.Draw(sheet)
        for index, (name, preview) in enumerate(thumbs):
            x = (index % cols) * cell_w
            y = (index // cols) * cell_h
            cell = checkerboard((cell_w, cell_h))
            ox = (cell_w - preview.width) // 2
            oy = 8
            cell.paste(preview, (ox, oy), preview)
            sheet.paste(cell, (x, y))
            draw.text((x + 8, y + cell_h - 24), name, fill="#132235")
        contact_sheet = split_dir / "_preview_contact_sheet.jpg"
        sheet.save(contact_sheet, quality=92)

        catalog["levels"].append({
            "level": level_dir.name,
            "splitCount": len(entries),
            "contactSheet": str(contact_sheet.relative_to(ROOT)).replace("\\", "/"),
            "assets": entries,
        })

    (PREPARED / "catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"catalogued {sum(item['splitCount'] for item in catalog['levels'])} split assets")


if __name__ == "__main__":
    main()
