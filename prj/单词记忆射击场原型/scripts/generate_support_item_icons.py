from __future__ import annotations

from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "assets" / "generated" / "topdown-farm-assets"
SIZE = 96


def rounded_panel(draw: ImageDraw.ImageDraw, fill: str, stroke: str) -> None:
    draw.rounded_rectangle((6, 6, SIZE - 6, SIZE - 6), radius=24, fill=fill, outline=stroke, width=4)


def save_shield_leaf() -> str:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    rounded_panel(draw, "#b8ef91", "#4b9d3e")
    draw.rounded_rectangle((25, 18, 71, 78), radius=18, fill="#f7fff2", outline="#3f8d3c", width=4)
    draw.line((48, 28, 48, 62), fill="#79ca63", width=6)
    draw.line((34, 46, 62, 46), fill="#79ca63", width=6)
    draw.arc((18, 22, 78, 82), start=210, end=328, fill="#4b9d3e", width=4)
    path = OUT_DIR / "support_shield_leaf.png"
    img.save(path)
    return str(path.relative_to(ROOT)).replace("\\", "/")


def save_slow_clock() -> str:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    rounded_panel(draw, "#b8e7ff", "#458fbd")
    draw.ellipse((22, 24, 74, 76), fill="#f6fdff", outline="#38759d", width=4)
    draw.line((38, 13, 58, 13), fill="#38759d", width=6)
    draw.line((28, 21, 22, 27), fill="#5ba5d1", width=5)
    draw.line((68, 21, 74, 27), fill="#5ba5d1", width=5)
    draw.line((48, 50, 48, 35), fill="#38759d", width=5)
    draw.line((48, 50, 61, 58), fill="#38759d", width=5)
    draw.arc((20, 42, 48, 70), start=70, end=170, fill="#5ba5d1", width=4)
    path = OUT_DIR / "support_slow_clock.png"
    img.save(path)
    return str(path.relative_to(ROOT)).replace("\\", "/")


def save_auto_star() -> str:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    rounded_panel(draw, "#ffd991", "#d38b22")
    star = [
        (48, 18), (56, 36), (76, 38), (61, 52), (65, 73),
        (48, 62), (31, 73), (35, 52), (20, 38), (40, 36)
    ]
    draw.polygon(star, fill="#fff9ef", outline="#d38b22")
    draw.ellipse((61, 14, 79, 32), fill="#8fd7ff", outline="#3a88b3", width=3)
    draw.line((28, 70, 43, 59), fill="#d38b22", width=4)
    path = OUT_DIR / "support_auto_star.png"
    img.save(path)
    return str(path.relative_to(ROOT)).replace("\\", "/")


def save_speed_boots() -> str:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    rounded_panel(draw, "#ffd8b0", "#c47428")
    draw.rounded_rectangle((22, 44, 70, 68), radius=10, fill="#fff5ea", outline="#b45f1d", width=4)
    draw.polygon([(34, 44), (48, 26), (66, 26), (58, 44)], fill="#ffef9c", outline="#c18d1b")
    draw.line((18, 30, 30, 24), fill="#c47428", width=4)
    draw.line((16, 42, 31, 36), fill="#c47428", width=4)
    path = OUT_DIR / "support_speed_boots.png"
    img.save(path)
    return str(path.relative_to(ROOT)).replace("\\", "/")


def save_hint_card() -> str:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    rounded_panel(draw, "#d9c8ff", "#7a54c7")
    draw.rounded_rectangle((22, 18, 74, 78), radius=14, fill="#fbf7ff", outline="#7a54c7", width=4)
    draw.line((32, 34, 60, 34), fill="#a18be2", width=4)
    draw.line((32, 46, 54, 46), fill="#a18be2", width=4)
    draw.text((40, 50), "?", fill="#5f42af")
    path = OUT_DIR / "support_hint_card.png"
    img.save(path)
    return str(path.relative_to(ROOT)).replace("\\", "/")


def save_combo_badge() -> str:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    rounded_panel(draw, "#ffb9c7", "#c04d69")
    draw.ellipse((22, 18, 74, 70), fill="#fff4f6", outline="#c04d69", width=4)
    draw.polygon([(48, 28), (54, 44), (70, 44), (58, 54), (62, 68), (48, 59), (34, 68), (38, 54), (26, 44), (42, 44)], fill="#ffcf5b", outline="#d08917")
    draw.line((30, 76, 40, 62), fill="#c04d69", width=5)
    draw.line((66, 76, 56, 62), fill="#c04d69", width=5)
    path = OUT_DIR / "support_combo_badge.png"
    img.save(path)
    return str(path.relative_to(ROOT)).replace("\\", "/")


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    created = [
        save_shield_leaf(),
        save_slow_clock(),
        save_auto_star(),
        save_speed_boots(),
        save_hint_card(),
        save_combo_badge()
    ]
    for item in created:
        print(item)


if __name__ == "__main__":
    main()
