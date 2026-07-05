from pathlib import Path


def test_explore_page_uses_rescue_card_when_pet_is_downed():
    js = Path("js/app.js").read_text(encoding="utf-8")
    assert "explore-rescue-card" in js
    assert "explore-rescue-header" in js
    assert "explore-rescue-illustration" in js
    assert "explore-rescue-status" in js
    assert "任务中断" in js
    assert "去宠物小屋救援" in js


def test_explore_rescue_card_styles_exist():
    css = Path("css/style.css").read_text(encoding="utf-8")
    assert ".explore-rescue-card" in css
    assert ".explore-rescue-header" in css
    assert ".explore-rescue-illustration" in css
    assert ".explore-rescue-status" in css
