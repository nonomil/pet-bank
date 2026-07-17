"""Normalize every Minecraft vocabulary image to a stable 512px square canvas."""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
VOCAB_PATH = ROOT / "data" / "learn" / "packs" / "english-mc-hybrid-2026" / "modules" / "minecraft-vocab.json"
OUT_ROOT = ROOT / "assets" / "learn" / "english-vocab" / "minecraft-cards" / "normalized"
MANIFEST_PATH = ROOT / "assets" / "learn" / "english-vocab" / "minecraft-cards" / "manifest.json"
CANVAS = 512
CONTENT = 460


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", str(value).lower()).strip("-")[:48] or "word"


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write_json(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def normalize(source_path: Path, output_path: Path) -> tuple[int, int]:
    with Image.open(source_path) as source:
        image = source.convert("RGBA")
        alpha = image.getchannel("A")
        bbox = alpha.getbbox()
        if bbox and alpha.getextrema() != (255, 255):
            image = image.crop(bbox)
        scale = min(CONTENT / image.width, CONTENT / image.height)
        size = (max(1, round(image.width * scale)), max(1, round(image.height * scale)))
        resized = image.resize(size, Image.Resampling.NEAREST)
        canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
        canvas.alpha_composite(resized, ((CANVAS - resized.width) // 2, (CANVAS - resized.height) // 2))
        output_path.parent.mkdir(parents=True, exist_ok=True)
        canvas.save(output_path, "PNG", optimize=True)
        return source.size


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    vocab = read_json(VOCAB_PATH)
    assets = []
    missing = []
    changed = 0
    for index, card in enumerate(vocab.get("cards", [])):
        source = ROOT / Path(str(card.get("image") or "").replace("/", "/"))
        if not source.exists():
            missing.append({"word": card.get("word", ""), "image": card.get("image", "")})
            continue
        filename = f"card-{index + 1:04d}-{slug(card.get('word', 'word'))}.png"
        output = OUT_ROOT / filename
        source_size = normalize(source, output) if args.apply or not output.exists() else Image.open(output).size
        relative = str(output.relative_to(ROOT)).replace("\\", "/")
        if card.get("image") != relative:
            changed += 1
        if args.apply:
            card["imageSourceFile"] = card.get("image", "")
            card["image"] = relative
            card["imagePresentation"] = "normalized-512-square"
        assets.append({
            "id": card.get("id") or f"card-{index + 1:04d}",
            "word": card.get("word", ""),
            "source": card.get("imageSource", "local-media"),
            "sourceQuality": card.get("imageSourceQuality", "normalized-local-media"),
            "sourcePath": card.get("imageSourceFile", ""),
            "path": relative,
            "dimensions": [CANVAS, CANVAS],
            "presentation": "normalized-512-square",
            "sourceDimensions": list(source_size),
        })
    if args.apply and not missing:
        write_json(VOCAB_PATH, vocab)
        manifest = {
            "id": "minecraft-vocab-card-media",
            "schemaVersion": 2,
            "source": "data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json",
            "runtimeRoot": "assets/learn/english-vocab/minecraft-cards/normalized/",
            "assets": assets,
            "presentationVersion": 2,
            "presentation": "All Minecraft vocabulary images are placed on a 512px square transparent canvas with nearest-neighbor scaling.",
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }
        write_json(MANIFEST_PATH, manifest)
    print(json.dumps({"mode": "apply" if args.apply else "dry-run", "cards": len(vocab.get("cards", [])), "assets": len(assets), "changed": changed, "missing": missing[:20], "missingCount": len(missing)}, ensure_ascii=False, indent=2))
    return 0 if not missing else 2


if __name__ == "__main__":
    raise SystemExit(main())
