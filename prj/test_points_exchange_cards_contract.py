from pathlib import Path


ASSET_DIR = Path("assets/ui/points-exchange")


def test_points_pages_have_agnes_card_sections():
    html = Path("index.html").read_text(encoding="utf-8")
    assert "points-agnes-dashboard" in html
    assert "growth-sticker-report" in html
    assert "reward-exchange-deck" in html
    assert "assets/ui/points-exchange/kidstar-guide.webp" in html
    assert "assets/ui/points-exchange/kidstar-gift-box.webp" in html
    assert "agnes-child-avatar.webp" not in html
    assert "icon-guide-star.webp" not in html


def test_task_and_growth_renderers_use_card_style_assets():
    app_js = Path("js/app.js").read_text(encoding="utf-8")
    assert "POINT_TASK_ART" in app_js
    assert "agnes-task-card" in app_js
    assert "renderGrowthStickerReport" in app_js
    assert "growth-habit-row" in app_js
    for asset_name in [
        "kidstar-reading.webp",
        "kidstar-writing.webp",
        "kidstar-sports.webp",
        "kidstar-clock.webp",
        "kidstar-tidy.webp",
        "kidstar-explore.webp",
        "kidstar-petcare.webp",
    ]:
        assert asset_name in app_js
    assert "agnes-good-eat.webp" not in app_js
    assert "icon-reading.webp" not in app_js


def test_shop_uses_preschool_exchange_cards():
    shop_js = Path("js/shop.js").read_text(encoding="utf-8")
    assert "shop-agnes-shell" in shop_js
    assert "shop-agnes-hero" in shop_js
    assert "assets/ui/points-exchange/kidstar-gift-box.webp" in shop_js
    assert "shop-agnes-card" in shop_js


def test_agnes_points_assets_exist():
    expected = [
        "kidstar-guide.webp",
        "kidstar-reading.webp",
        "kidstar-writing.webp",
        "kidstar-math.webp",
        "kidstar-sports.webp",
        "kidstar-clock.webp",
        "kidstar-tidy.webp",
        "kidstar-explore.webp",
        "kidstar-petcare.webp",
        "kidstar-cooking.webp",
        "kidstar-gift-box.webp",
    ]
    for filename in expected:
        assert (ASSET_DIR / filename).is_file(), filename
