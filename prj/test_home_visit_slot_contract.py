from pathlib import Path


def test_home_ui_contains_visit_slot_mount():
    js = Path("js/home.js").read_text(encoding="utf-8")
    assert "home-visit-slot" in js


def test_social_service_exposes_compact_home_visit_renderer():
    js = Path("js/social.js").read_text(encoding="utf-8")
    assert "renderHomeVisitSlot" in js
    assert "最近来访" in js
