from pathlib import Path


def test_walk_page_promotes_scene_stage_and_home_like_controls():
    app_js = Path("js/app.js").read_text(encoding="utf-8")
    assert "walk-scene-stage" in app_js
    assert "WalkSystem.renderAdventureStage('walk-scene-stage')" in app_js
    assert "喂点零食" in app_js
    assert "立即出发" in app_js


def test_walk_page_uses_home_aligned_shell_instead_of_dashboard_layers():
    app_js = Path("js/app.js").read_text(encoding="utf-8")
    assert "walk-home-shell" in app_js
    assert "walk-home-side" in app_js
    assert "walk-page-hero" not in app_js


def test_walk_page_status_card_reuses_pet_home_like_vitals():
    app_js = Path("js/app.js").read_text(encoding="utf-8")
    walk_css = Path("css/walk.css").read_text(encoding="utf-8")
    assert "walk-home-vitals" in app_js
    assert "walk-home-vit-fill hp" in app_js
    assert "walk-home-vit-fill hunger" in app_js
    assert ".walk-home-vitals" in walk_css


def test_walk_page_side_panels_use_compact_scrollers_and_route_tools():
    app_js = Path("js/app.js").read_text(encoding="utf-8")
    walk_js = Path("js/walk.js").read_text(encoding="utf-8")
    walk_css = Path("css/walk.css").read_text(encoding="utf-8")
    assert "walk-home-invites is-compact" in app_js
    assert "walk-home-peer-list is-compact" in app_js
    assert "walk-route-panel-shell is-compact" in walk_js
    assert ".walk-home-peer-list.is-compact" in walk_css
    assert ".walk-route-panel-shell.is-compact" in walk_css


def test_walk_system_defines_outdoor_scene_metadata_and_bubble_interactions():
    walk_js = Path("js/walk.js").read_text(encoding="utf-8")
    assert "sceneTitle" in walk_js
    assert "sceneImage" in walk_js
    assert "bubbleLines" in walk_js
    assert "renderAdventureStage" in walk_js
    assert "handleAdventureAction" in walk_js


def test_repo_already_contains_reusable_outdoor_scene_assets():
    expected_assets = [
        Path("assets/background/dawn.webp"),
        Path("assets/background/garden_balcony.webp"),
        Path("assets/scenes/forest.webp"),
        Path("assets/scenes/waterfall.webp"),
    ]
    for asset in expected_assets:
        assert asset.exists(), f"missing outdoor walk asset: {asset}"
