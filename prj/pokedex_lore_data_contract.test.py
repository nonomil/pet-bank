from __future__ import annotations

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
CARD_JS = REPO_ROOT / "js" / "card-collection.js"
LORE_JSON = REPO_ROOT / "data" / "pokedex-lore-draft.json"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def main() -> None:
    require(LORE_JSON.exists(), "lore draft json must exist")

    data = json.loads(LORE_JSON.read_text(encoding="utf-8"))
    pets = data.get("pets") or []
    require(len(pets) == 198, "lore draft json must cover all 198 pets")

    sunflower = next((pet for pet in pets if pet.get("name") == "向日葵"), None)
    require(sunflower is not None, "lore draft json must include 向日葵")
    for field in ["intro", "story", "sceneName", "codexTitle", "subtitle"]:
        require(bool(sunflower.get(field)), f"向日葵 must include lore field: {field}")

    js = CARD_JS.read_text(encoding="utf-8")
    require("pokedex-lore-draft.json" in js, "card collection must reference the external pokedex lore data source")
    require("loadLoreData" in js, "card collection must define a lore data loader")


if __name__ == "__main__":
    main()
