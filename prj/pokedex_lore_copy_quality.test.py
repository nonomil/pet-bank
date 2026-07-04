from __future__ import annotations

import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
LORE_JSON = REPO_ROOT / "data" / "pokedex-lore-draft.json"
DOCS_DIR = REPO_ROOT / "docs" / "图鉴探索联动"

BANNED_PHRASES = [
    "从小从小",
    "从小小时候",
    "小时候小时候",
    "小时候：小时候",
]


def require(condition: bool, message: str) -> None:
    if not condition:
        raise SystemExit(message)


def main() -> None:
    lore = json.loads(LORE_JSON.read_text(encoding="utf-8"))
    lore_text = json.dumps(lore, ensure_ascii=False)

    for phrase in BANNED_PHRASES:
        require(phrase not in lore_text, f"lore draft must not contain repeated phrase: {phrase}")

    docs_text = "\n".join(
        path.read_text(encoding="utf-8")
        for path in sorted(DOCS_DIR.glob("*.md"))
    )
    for phrase in BANNED_PHRASES:
        require(phrase not in docs_text, f"generated docs must not contain repeated phrase: {phrase}")


if __name__ == "__main__":
    main()
