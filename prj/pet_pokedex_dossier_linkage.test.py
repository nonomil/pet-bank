from __future__ import annotations

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
CARD_JS = REPO_ROOT / "js" / "card-collection.js"
CARD_CSS = REPO_ROOT / "css" / "card-collection.css"
LORE_JSON = REPO_ROOT / "data" / "pokedex-lore-draft.json"
SCENES_JSON = REPO_ROOT / "data" / "scenes.json"


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def require_text(text: str, needle: str, message: str) -> None:
    if needle not in text:
        raise SystemExit(message)


def main() -> None:
    js = CARD_JS.read_text(encoding="utf-8")
    css = CARD_CSS.read_text(encoding="utf-8")
    lore = json.loads(LORE_JSON.read_text(encoding="utf-8"))
    scenes = json.loads(SCENES_JSON.read_text(encoding="utf-8")).get("scenes", [])

    sunflower = next((pet for pet in lore.get("pets", []) if pet.get("id") == "pvz_sunflower"), None)
    require(sunflower is not None, "pokedex lore must include pvz_sunflower")
    runtime_scene = next((scene for scene in scenes if scene.get("id") == sunflower.get("sceneId")), None)
    require(runtime_scene is not None, "sunflower linked scene must exist in runtime scenes")

    for field in ["origin", "childhood", "school", "work", "hobby", "specialty", "ability", "sceneId", "sceneName"]:
        require(sunflower.get(field), f"sunflower lore must provide {field}")
    require(runtime_scene.get("name"), "linked runtime scene must expose a name")
    require(
        sunflower.get("sceneName") == runtime_scene.get("name"),
        "sunflower lore sceneName must stay aligned with runtime scene names",
    )

    required_js_hooks = [
        "card-detail-dossier",
        "card-detail-dossier-grid",
        "card-detail-dossier-item",
        "card-detail-scene-cta",
        "getSceneDisplayName",
        "getSeriesDisplayLabel",
        "childhood",
        "school",
        "work",
        "hobby",
        "specialty",
        "ability",
        "ExplorationDetail.show",
        "switchPage('explore')",
    ]
    for hook in required_js_hooks:
        require_text(js, hook, f"js must include {hook} for structured dossier linkage")

    require_text(js, "pvz真实", "js must know how to remap internal series labels such as pvz真实")
    require("系列：${getSeriesDisplayLabel" in js, "detail meta must render friendly series labels instead of raw pet.series")

    required_css_hooks = [
        "card-detail-dossier",
        "card-detail-dossier-grid",
        "card-detail-dossier-item",
        "card-detail-dossier-label",
        "card-detail-scene-cta",
    ]
    for hook in required_css_hooks:
        require_text(css, hook, f"css must style {hook}")


if __name__ == "__main__":
    main()
