from __future__ import annotations

from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
CARD_JS = REPO_ROOT / "js" / "card-collection.js"
CARD_CSS = REPO_ROOT / "css" / "card-collection.css"
COMPOSE_SCRIPT = REPO_ROOT / "scripts" / "generators" / "compose_gallery_cover_collages.py"


def require(text: str, needle: str, message: str) -> None:
    if needle not in text:
        raise SystemExit(message)


def forbid(text: str, needle: str, message: str) -> None:
    if needle in text:
        raise SystemExit(message)


def main() -> None:
    js = CARD_JS.read_text(encoding="utf-8")
    css = CARD_CSS.read_text(encoding="utf-8")
    compose_script = COMPOSE_SCRIPT.read_text(encoding="utf-8")

    for label in [
        "神话瑞兽册",
        "星梦奇旅册",
        "card-gallery-cover-image",
        "card-theme-empty",
        "heroPetIds",
        "card-gallery-preview-stack",
        "card-hall-hero",
        "返回图鉴馆首页",
    ]:
        require(js, label, f"js must include {label}")

    for hook in [
        "card-gallery-card-media",
        "card-collect-state-badge",
        "card-theme-booklets",
        "card-gallery-preview-stack",
        "card-hall-hero",
        "card-hall-back",
    ]:
        require(css, hook, f"css must style {hook}")

    forbid(
        css,
        ".card-item.card-item-book.uncollected .card-portrait img",
        "book cards should not grayscale uncollected portraits anymore",
    )
    forbid(
        js,
        "renderPreviewStackHtml(galleryId, '')",
        "home gallery covers should bake representative cards into the background image instead of overlaying them in HTML",
    )
    require(
        compose_script,
        "assets/cards/composed-v2",
        "gallery cover pipeline should use the refreshed composed-v2 pet cards by default",
    )


if __name__ == "__main__":
    main()
