from __future__ import annotations

import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "data" / "learn" / "external" / "mayihaoke" / "media-manifest.json"
RAW_DIR = ROOT / "tmp" / "mayihaoke-minecraft-media" / "raw"
OUTPUT_DIR = ROOT / "assets" / "learn" / "english-vocab" / "minecraft-reference"


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    cards = []
    for item in manifest["cards"]:
        index = item["index"]
        source = ROOT / item.get("rawPath", (Path("tmp") / "mayihaoke-minecraft-media" / "raw" / f"{index}.webp"))
        output = OUTPUT_DIR / f"card-{index}.webp"
        with Image.open(source) as source_image:
            image = source_image.convert("RGBA")
            image.thumbnail((512, 512), Image.Resampling.LANCZOS)
            image.save(output, format="WEBP", quality=88, method=6)
        cards.append({
            "index": index,
            "sourceUrl": item["sourceUrl"],
            "path": output.relative_to(ROOT).as_posix(),
            "bytes": output.stat().st_size,
            "width": image.width,
            "height": image.height,
        })
    output_manifest = {
        "provider": "mayihaoke",
        "route": "/minewords",
        "sourceTemplate": manifest["sourceTemplate"],
        "convertedAt": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
        "count": len(cards),
        "cards": cards,
    }
    (MANIFEST_PATH.parent / "media-manifest.json").write_text(
        json.dumps(output_manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"output": str(OUTPUT_DIR.relative_to(ROOT)), "count": len(cards)}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
