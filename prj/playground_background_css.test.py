from __future__ import annotations

import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PLAYGROUND_CSS = REPO_ROOT / "css" / "playground.css"


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
    css = PLAYGROUND_CSS.read_text(encoding="utf-8")
    page_rule = extract_rule("#page-playground", css)
    before_rule = extract_rule("#page-playground::before", css)

    require(r"isolation\s*:\s*isolate\s*;", page_rule, "#page-playground must isolate its background layer")
    require(r"background\s*:\s*transparent\s*!important\s*;", page_rule, "#page-playground must not paint an opaque page tint")
    require(r"z-index\s*:\s*0\s*;", before_rule, "#page-playground::before should sit at the base content layer")
    forbid(r"#6fa8dc", before_rule, "#page-playground::before must not include the blue fallback tint")


if __name__ == "__main__":
    main()
