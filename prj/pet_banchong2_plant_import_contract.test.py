from __future__ import annotations

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PETS_JSON = REPO_ROOT / "data" / "pets.json"
LORE_JSON = REPO_ROOT / "data" / "pokedex-lore-draft.json"
CARD_JS = REPO_ROOT / "js" / "card-collection.js"
APP_JS = REPO_ROOT / "js" / "app.js"
PET_JS = REPO_ROOT / "js" / "pet.js"
SNAPSHOT_JSON = REPO_ROOT / "data" / "source-snapshots" / "banchong2-plants.json"
MANIFEST_JSON = REPO_ROOT / "data" / "source-snapshots" / "banchong2-plants-import-manifest.json"
ASSET_DIR = REPO_ROOT / "assets" / "banchong2" / "甜芽花园族"

SOURCE_ID = "banchong2_plant"
SERIES_NAME = "甜芽花园族"
BOOKLET_NAME = "甜芽花园册"
EXPECTED_PLANT_COUNT = 23
EXPECTED_STAGE_COUNT = 6


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def read_json(path: Path) -> object:
    require(path.exists(), f"missing required file: {path.relative_to(REPO_ROOT)}")
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    snapshot = read_json(SNAPSHOT_JSON)
    manifest = read_json(MANIFEST_JSON)
    pets_db = read_json(PETS_JSON)
    lore_db = read_json(LORE_JSON)

    require(isinstance(snapshot, list), "banchong2 plants snapshot must be a list")
    require(len(snapshot) == EXPECTED_PLANT_COUNT, f"expected {EXPECTED_PLANT_COUNT} plant snapshot rows, got {len(snapshot)}")
    require(all(row.get("category") == "PLANT" for row in snapshot), "plant snapshot must only contain PLANT rows")

    require(isinstance(manifest, list), "banchong2 plants manifest must be a list")
    require(len(manifest) == EXPECTED_PLANT_COUNT, f"expected {EXPECTED_PLANT_COUNT} manifest rows, got {len(manifest)}")

    flat = pets_db.get("flat") or []
    imported = [pet for pet in flat if pet.get("source") == SOURCE_ID]
    require(len(imported) == EXPECTED_PLANT_COUNT, f"expected {EXPECTED_PLANT_COUNT} imported plant pets, got {len(imported)}")
    require(pets_db.get("sources", {}).get(SOURCE_ID), "pets.json sources must include banchong2_plant")
    require((pets_db.get("series") or {}).get(SERIES_NAME), "pets.json series must include 甜芽花园族")

    ids = [pet.get("id") for pet in imported]
    require(len(ids) == len(set(ids)), "imported plant pet ids must be unique")
    require(all(str(pet.get("id") or "").startswith(("bc2p_", "bc2_plant_")) for pet in imported), "plant pet ids must use a bc2p_ or bc2_plant_ prefix")

    for pet in imported:
        require(pet.get("series") == SERIES_NAME, f"{pet.get('name')} must belong to 甜芽花园族")
        require(pet.get("imageStyle") == "banchong", f"{pet.get('name')} must use banchong image style")
        stages = pet.get("stages") or []
        require(len(stages) == EXPECTED_STAGE_COUNT, f"{pet.get('name')} must keep {EXPECTED_STAGE_COUNT} stage images")
        image_stages = pet.get("imageStages") or {}
        require(len(image_stages) == EXPECTED_STAGE_COUNT, f"{pet.get('name')} must keep {EXPECTED_STAGE_COUNT} imageStages")
        for stage in stages:
            image_url = stage.get("imageUrl") or ""
            require(image_url.startswith("assets/banchong2/甜芽花园族/"), f"{pet.get('name')} stage path must stay in 甜芽花园族: {image_url}")
            require(image_url.endswith(".webp"), f"{pet.get('name')} stage path must use webp: {image_url}")
            require((REPO_ROOT / image_url).exists(), f"{pet.get('name')} stage asset is missing: {image_url}")

    lore_pets = lore_db.get("pets") or []
    lore = [pet for pet in lore_pets if pet.get("source") == SOURCE_ID]
    require(len(lore) == EXPECTED_PLANT_COUNT, f"expected {EXPECTED_PLANT_COUNT} plant lore entries, got {len(lore)}")
    for entry in lore:
        require(entry.get("galleryId") == "sunshine", f"{entry.get('name')} lore must route to sunshine gallery")
        for field in ["codexTitle", "subtitle", "intro", "story", "origin", "school", "work", "specialty", "ability"]:
            require(bool(entry.get(field)), f"{entry.get('name')} lore must include {field}")

    card_js = CARD_JS.read_text(encoding="utf-8")
    app_js = APP_JS.read_text(encoding="utf-8")
    pet_js = PET_JS.read_text(encoding="utf-8")
    require(SOURCE_ID in card_js, "card collection must register banchong2_plant")
    require(BOOKLET_NAME in card_js, "sunshine gallery must expose the 甜芽花园册 booklet")
    require(SERIES_NAME in card_js, "甜芽花园册 must point at 甜芽花园族")
    require(SOURCE_ID in app_js and "甜芽花园" in app_js, "adopt source tabs must label banchong2_plant")
    require(SOURCE_ID in pet_js or "MULTI_STAGE_IMAGE_SOURCES" in pet_js, "pet media normalization must support banchong2_plant")
    require(ASSET_DIR.exists(), "甜芽花园族 asset directory must exist")


if __name__ == "__main__":
    main()
