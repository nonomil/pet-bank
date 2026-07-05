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
        data = json.loads(path.read_text(encoding="utf-8"))
        math_events = [event for event in data.get("events", []) if event.get("type") == "math"]

        require(math_events, f"{scene_id}.json must include at least one math event")

        for idx, event in enumerate(math_events):
            prefix = f"{scene_id}.json math event #{idx}"
            require(str(event.get("question", "")).strip(), f"{prefix} missing question")
            require(event.get("answer") is not None, f"{prefix} missing answer")
            require(len(event.get("options", [])) == 4, f"{prefix} must offer exactly 4 options")
            require(str(event.get("skill", "")).strip(), f"{prefix} missing skill label")
            require(str(event.get("hint", "")).strip(), f"{prefix} missing hint")
            require(str(event.get("explanation", "")).strip(), f"{prefix} missing explanation")


if __name__ == "__main__":
    main()
