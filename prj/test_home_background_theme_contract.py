from pathlib import Path


def test_home_themes_include_generated_dawn_and_garden_backgrounds():
    js = Path("js/home.js").read_text(encoding="utf-8")
    assert "assets/background/dawn.webp" in js
    assert "assets/background/garden_balcony.webp" in js
