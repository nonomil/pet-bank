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

    required_hooks = [
        "card-detail-hero",
        "card-detail-story",
        "card-detail-traits",
        "card-detail-skills",
        "card-detail-stages",
        "card-detail-stage-strip",
        "card-grid-intro",
        "card-item-book",
        "card-card-spec",
    ]

    for hook in required_hooks:
        require(js, hook, f"js must render {hook}")
        require(css, hook, f"css must style {hook}")

    require(js, "向日葵", "sample detail must include 向日葵")
    require(js, "'向日葵': {", "向日葵样板必须能按宠物名字命中详情映射")
    require(js, "植物镇", "向日葵样板故事必须落到植物镇世界观")
    require(js, "晨光学堂", "向日葵样板故事必须包含学习背景")
    require(js, "见习培育师", "向日葵样板故事必须包含当前角色设定")


if __name__ == "__main__":
    main()
