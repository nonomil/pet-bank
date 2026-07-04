from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
CARD_JS = REPO_ROOT / "js" / "card-collection.js"
CARD_CSS = REPO_ROOT / "css" / "card-collection.css"
GEN_FRAME = REPO_ROOT / "scripts" / "generators" / "gen_card_frames_v2.py"
COMPOSE_V2 = REPO_ROOT / "scripts" / "generators" / "compose_cards_v2.py"


def require(text: str, needle: str, message: str) -> None:
    if needle not in text:
        raise SystemExit(message)


def require_file(path: Path, message: str) -> None:
    if not path.exists():
        raise SystemExit(message)


def main() -> None:
    js = CARD_JS.read_text(encoding="utf-8")
    css = CARD_CSS.read_text(encoding="utf-8")

    require_file(GEN_FRAME, "missing Agnes v2 frame generation script")
    require_file(COMPOSE_V2, "missing v2 card composition script")

    for needle in [
        "assets/cards/composed-v2/",
        "card-composed-v2",
        "生命",
        "攻击",
        "防御",
        "速度",
    ]:
        require(js + css, needle, f"missing new card redesign hook: {needle}")


if __name__ == "__main__":
    main()
