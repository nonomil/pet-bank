"""Publish the reviewed Agnes sprite sheet into semantic story assets."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "tmp" / "space-growth-art"
PUBLISHED_DIR = ROOT / "assets" / "story" / "space-growth-detective"
PART_DIR = SOURCE_DIR / "sheet" / "split"

NODE_NAMES = ["energy-stardust", "cloud-code", "star-dust-footprints", "companion-link", "home-star-map"]
CARD_NAMES = ["energy-stardust", "cloud-code", "star-dust-footprints", "companion-link", "home-star-map"]
BADGE_NAMES = ["energy-scout", "cloud-companion", "star-dust-tracker", "link-builder", "home-star-keeper"]


def part(number: int) -> Path:
    matches = sorted(PART_DIR.glob(f"part{number:02d}_*.png"))
    if len(matches) != 1:
        raise RuntimeError(f"expected one part for {number:02d}, found {matches}")
    return matches[0]


def publish_webp(source: Path, target: Path, quality: int = 92) -> dict:
    image = Image.open(source).convert("RGBA")
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target, "WEBP", quality=quality, method=6)
    alpha = image.getchannel("A")
    return {
        "file": target.relative_to(ROOT).as_posix(),
        "source": source.relative_to(ROOT).as_posix(),
        "size": list(image.size),
        "opaquePixels": sum(1 for value in alpha.getdata() if value > 24),
    }


def main() -> int:
    map_source = SOURCE_DIR / "background" / "map-background-v2.png"
    if not map_source.exists():
        raise RuntimeError(f"missing reviewed map background: {map_source}")
    PUBLISHED_DIR.mkdir(parents=True, exist_ok=True)
    map_image = Image.open(map_source).convert("RGB")
    map_target = PUBLISHED_DIR / "map.webp"
    map_image.save(map_target, "WEBP", quality=92, method=6)

    entries = []
    for index, name in enumerate(NODE_NAMES, start=1):
        entries.append({"kind": "node", "id": name, **publish_webp(part(index), PUBLISHED_DIR / "nodes" / f"{name}.webp")})
    for index, name in enumerate(CARD_NAMES, start=6):
        entries.append({"kind": "card", "id": name, **publish_webp(part(index), PUBLISHED_DIR / "cards" / f"{name}.webp")})
    for index, name in enumerate(BADGE_NAMES, start=11):
        entries.append({"kind": "badge", "id": name, **publish_webp(part(index), PUBLISHED_DIR / "badges" / f"{name}.webp")})

    manifest = {
        "generator": "agnes-image-2.1-flash",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "map": {"file": map_target.relative_to(ROOT).as_posix(), "size": list(map_image.size)},
        "assets": entries,
    }
    (PUBLISHED_DIR / "asset-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"map": str(map_target), "assets": len(entries), "manifest": str(PUBLISHED_DIR / "asset-manifest.json")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
