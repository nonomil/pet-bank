from __future__ import annotations

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
STORIES_DIR = REPO_ROOT / "data" / "stories"
SCENE_IDS = [
    "forest",
    "beach",
    "candy",
    "waterfall",
    "desert",
    "underwater",
    "mountain",
    "cave",
    "castle",
    "volcano",
    "space",
    "stargarden",
]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def main() -> None:
    for scene_id in SCENE_IDS:
        path = STORIES_DIR / f"{scene_id}.json"
        require(path.exists(), f"missing story file: {scene_id}.json")

        data = json.loads(path.read_text(encoding="utf-8"))
        texts = [str(event.get("text", "")) for event in data.get("events", [])]
        combined = "\n".join(texts)
        ending = str(data.get("ending_text", ""))

        require(
            any(keyword in combined for keyword in ["图鉴馆", "调查", "登记"]),
            f"{scene_id}.json must frame the scene as a pokedex investigation",
        )
        require(
            any(keyword in ending for keyword in ["图鉴", "卡", "登记", "档案"]),
            f"{scene_id}.json ending must mention the card or dossier outcome",
        )


if __name__ == "__main__":
    main()
