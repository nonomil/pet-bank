from __future__ import annotations

import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PLAYGROUND_CSS = REPO_ROOT / "css" / "playground.css"
HANZI_CSS = REPO_ROOT / "css" / "hanzi-game.css"
LEADERBOARD_CSS = REPO_ROOT / "css" / "leaderboard.css"


def extract_rule(selector: str, css: str) -> str:
    pattern = re.compile(rf"{re.escape(selector)}\s*\{{(?P<body>.*?)\}}", re.S)
    match = pattern.search(css)
    if not match:
        raise SystemExit(f"missing rule: {selector}")
    return match.group("body")


def require(pattern: str, text: str, message: str) -> None:
    if not re.search(pattern, text, re.I | re.S):
        raise SystemExit(message)


def forbid(pattern: str, text: str, message: str) -> None:
    if re.search(pattern, text, re.I | re.S):
        raise SystemExit(message)


def main() -> None:
    playground_css = PLAYGROUND_CSS.read_text(encoding="utf-8")
    hanzi_css = HANZI_CSS.read_text(encoding="utf-8")
    leaderboard_css = LEADERBOARD_CSS.read_text(encoding="utf-8")

    playground_page = extract_rule("#page-playground", playground_css)
    playground_before = extract_rule("#page-playground::before", playground_css)
    hanzi_page = extract_rule("#page-hanzi", hanzi_css)
    hanzi_before = extract_rule("#page-hanzi::before", hanzi_css)
    hanzi_overlay = extract_rule(".hz-overlay", hanzi_css)
    leaderboard_page = extract_rule("#page-leaderboard", leaderboard_css)
    leaderboard_before = extract_rule("#page-leaderboard::before", leaderboard_css)

    require(r"background\s*:\s*transparent\s*!important\s*;", playground_page, "playground page must stay transparent")
    require(r"isolation\s*:\s*isolate\s*;", playground_page, "playground page must isolate background layers")
    require(r"home-bg\.webp", playground_before, "playground background must reuse the home background")
    forbid(r"pg-bg\.webp", playground_before, "playground page must not use pg-bg.webp as full-page background")

    require(r"background\s*:\s*transparent\s*!important\s*;", hanzi_page, "hanzi page must stay transparent")
    require(r"isolation\s*:\s*isolate\s*;", hanzi_page, "hanzi page must isolate background layers")
    require(r"home-bg\.webp", hanzi_before, "hanzi background must reuse the home background")
    forbid(r"hanzi-new-bg\.webp", hanzi_before, "hanzi page must not use hanzi-new-bg.webp as full-page background")
    require(r"home-bg\.webp", hanzi_overlay, "hanzi overlay must reuse the home background")
    forbid(r"hanzi-new-bg\.webp", hanzi_overlay, "hanzi overlay must not use hanzi-new-bg.webp")

    require(r"background\s*:\s*transparent\s*!important\s*;", leaderboard_page, "leaderboard page must stay transparent")
    require(r"isolation\s*:\s*isolate\s*;", leaderboard_page, "leaderboard page must isolate background layers")
    require(r"home-bg\.webp", leaderboard_before, "leaderboard background must reuse the home background")
    forbid(r"leaderboard-bg\.(?:png|webp)", leaderboard_before, "leaderboard page must not use leaderboard-bg as full-page background")


if __name__ == "__main__":
    main()
