#!/usr/bin/env python3
"""Import selected GPT widescreen farm row-3 images into runtime backgrounds.

Usage:
    python prj/单词记忆射击场原型/scripts/import_farm_row3_widescreen.py

Expected input files:
    prj/单词记忆射击场原型/assets/generated/reference/farm-widescreen-gpt-row3/
      07.png
      08.png
      09.png
"""

from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1]
SOURCE_DIR = PROJECT / "assets" / "generated" / "reference" / "farm-widescreen-gpt-row3"
TARGET_DIR = PROJECT / "assets" / "背景图片"
MANIFEST = SOURCE_DIR / "_import_manifest.json"
REQUIRED = ("07", "08", "09")


def resolve_source(slot: str) -> Path:
    matches = []
    for ext in (".png", ".jpg", ".jpeg", ".webp"):
      candidate = SOURCE_DIR / f"{slot}{ext}"
      if candidate.exists():
        matches.append(candidate)
    if not matches:
      raise FileNotFoundError(f"Missing source image for slot {slot} in {SOURCE_DIR}")
    return matches[0]


def main() -> int:
    SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    TARGET_DIR.mkdir(parents=True, exist_ok=True)

    records = []
    for slot in REQUIRED:
        source = resolve_source(slot)
        target = TARGET_DIR / f"{slot}.png"
        shutil.copy2(source, target)
        records.append({
            "slot": slot,
            "source": str(source.relative_to(PROJECT)),
            "target": str(target.relative_to(PROJECT)),
            "bytes": target.stat().st_size,
        })
        print(f"imported: {slot} <- {source.name}")

    MANIFEST.write_text(json.dumps({
        "importedAt": datetime.now(timezone.utc).isoformat(),
        "records": records,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"manifest: {MANIFEST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
