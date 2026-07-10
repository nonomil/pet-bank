from pathlib import Path


def test_homepage_uses_focus_hero_instead_of_legacy_showcase():
    html = Path("index.html").read_text(encoding="utf-8")
    assert 'class="map-home-hero"' in html
    assert 'class="map-focus-card"' in html
    assert 'id="mapCompanionStory"' in html
    assert 'id="showcase"' not in html


def test_homepage_companion_copy_hooks_exist():
    js = Path("js/app.js").read_text(encoding="utf-8")
    assert "mapCompanionStory" in js
    assert "mapCompanionMood" in js
    assert "mapCompanionRoute" in js


def test_homepage_focus_layout_styles_exist():
    css = Path("css/style.css").read_text(encoding="utf-8")
    assert ".map-home-hero" in css
    assert ".map-focus-card" in css
    assert ".map-home-companion" in css
