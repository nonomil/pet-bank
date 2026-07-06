from __future__ import annotations

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
STORIES_DIR = REPO_ROOT / "data" / "stories"
SCENES_PATH = REPO_ROOT / "data" / "scenes.json"
VOICE_MAP_PATH = REPO_ROOT / "assets" / "voice" / "map.json"


def clean_text(text: str) -> str:
    return "".join(str(text).split()).strip()


def unique_texts() -> list[str]:
    texts: list[str] = []

    for story_path in sorted(STORIES_DIR.glob("*.json")):
        data = json.loads(story_path.read_text(encoding="utf-8"))
        ending_text = data.get("ending_text")
        if ending_text:
            texts.append(ending_text)

        for event in data.get("events", []):
            event_type = event.get("type")
            if event_type in {"narrate", "discover", "encounter", "choice", "math"}:
                if event.get("text"):
                    texts.append(event["text"])
            if event_type == "math":
                if event.get("question"):
                    texts.append(event["question"])
                reward_msg = event.get("reward", {}).get("msg")
                if reward_msg:
                    texts.append(reward_msg)
            if event_type == "choice":
                for option in event.get("options", []):
                    if option.get("text"):
                        texts.append(option["text"])
                    if option.get("reward"):
                        texts.append(option["reward"])

    scenes = json.loads(SCENES_PATH.read_text(encoding="utf-8")).get("scenes", [])
    for scene in scenes:
        for field in ("name", "description", "story"):
            if scene.get(field):
                texts.append(scene[field])

    seen: set[str] = set()
    deduped: list[str] = []
    for text in texts:
        key = clean_text(text)
        if key and key not in seen:
            seen.add(key)
            deduped.append(key)
    return deduped


def main() -> None:
    voice_map = json.loads(VOICE_MAP_PATH.read_text(encoding="utf-8"))
    missing = [text for text in unique_texts() if text not in voice_map]
    if missing:
        preview = "\n".join(missing[:20])
        raise SystemExit(
            f"explore voice map missing {len(missing)} active texts, first entries:\n{preview}"
        )

    source_mtime = max(
        [SCENES_PATH.stat().st_mtime]
        + [path.stat().st_mtime for path in STORIES_DIR.glob("*.json")]
    )
    stale = []
    for text in unique_texts():
        audio_path = VOICE_MAP_PATH.parent / f"{voice_map[text]}.mp3"
        if not audio_path.exists() or audio_path.stat().st_mtime < source_mtime:
            stale.append(text)
    if stale:
        preview = "\n".join(stale[:20])
        raise SystemExit(
            f"explore voice audio stale for {len(stale)} active texts, first entries:\n{preview}"
        )


if __name__ == "__main__":
    main()
