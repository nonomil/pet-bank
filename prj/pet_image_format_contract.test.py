from __future__ import annotations

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PETS_JSON = REPO_ROOT / "data" / "pets.json"
BAD_SUFFIXES = (".bmp", ".jpg", ".jpeg")
IMPORTED_SOURCES = {"banchong2", "banchong2_plant"}


def main() -> None:
    pets_db = json.loads(PETS_JSON.read_text(encoding="utf-8"))
    flat = pets_db.get("flat") or []
    imported = [pet for pet in flat if pet.get("source") in IMPORTED_SOURCES]

    if not imported:
        raise SystemExit("expected at least one imported banchong2 pet to validate image formats")

    for pet in imported:
        stages = pet.get("stages") or []
        if not stages:
            raise SystemExit(f"{pet.get('name') or pet.get('id')} must keep stage images")
        for stage in stages:
            image_url = (stage or {}).get("imageUrl") or ""
            lower = image_url.lower()
            if not lower.endswith(".webp"):
                raise SystemExit(f"{pet.get('name') or pet.get('id')} stage image must use webp: {image_url}")
            if lower.endswith(BAD_SUFFIXES):
                raise SystemExit(f"{pet.get('name') or pet.get('id')} stage image must not use legacy format: {image_url}")


if __name__ == "__main__":
    main()
