from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
CARD_JS = REPO_ROOT / "js" / "card-collection.js"
CARD_CSS = REPO_ROOT / "css" / "card-collection.css"


def require(text: str, needle: str, message: str) -> None:
    if needle not in text:
        raise SystemExit(message)


def main() -> None:
    js = CARD_JS.read_text(encoding="utf-8")
    css = CARD_CSS.read_text(encoding="utf-8")

    for label in ["阳光花园馆", "奇趣冒险馆", "创想课堂馆", "方块生态馆"]:
        require(js, label, f"js must render new gallery label: {label}")

    require(js, "sourceKeys: ['original', 'pvz', 'banchong2_plant']", "js must group original, pvz, and banchong2 plants into the sunshine gallery")
    require(js, "甜芽花园册", "js must expose the banchong2 plant booklet in the sunshine gallery")
    require(js, "cardIntro:", "js must include hall intro copy for gallery home cards")

    for hook in ["card-overview-hero", "card-gallery-card", "card-gallery-icon", "card-gallery-blurb"]:
        require(js, hook, f"js must render {hook}")
        require(css, hook, f"css must style {hook}")


if __name__ == "__main__":
    main()
