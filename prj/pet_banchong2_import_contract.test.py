from __future__ import annotations

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
CARD_JS = REPO_ROOT / "js" / "card-collection.js"
PETS_JSON = REPO_ROOT / "data" / "pets.json"
SNAPSHOT_JSON = REPO_ROOT / "data" / "source-snapshots" / "banchong2-animals.json"


def require(text: str, needle: str, message: str) -> None:
    if needle not in text:
        raise SystemExit(message)


def main() -> None:
    js = CARD_JS.read_text(encoding="utf-8")
    pets_db = json.loads(PETS_JSON.read_text(encoding="utf-8"))
    flat = pets_db.get("flat") or []

    require(js, "banchong2", "card collection must register the new banchong2 source")
    require(js, "萌爪伙伴册", "adventure gallery must expose the 萌爪伙伴册 booklet")

    imported = [pet for pet in flat if pet.get("source") == "banchong2"]
    snapshot = json.loads(SNAPSHOT_JSON.read_text(encoding="utf-8"))
    expected = len(snapshot)
    if len(imported) != expected:
        raise SystemExit(f"expected {expected} imported banchong2 pets, got {len(imported)}")


if __name__ == "__main__":
    main()
