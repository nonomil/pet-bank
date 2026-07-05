from pathlib import Path


def test_house_visit_schema_allows_walk_action():
    sql = Path("supabase/migrations/20260705_005_house_visits.sql").read_text(encoding="utf-8")
    assert "'walk'" in sql


def test_social_service_exposes_walk_action_button_and_meta():
    js = Path("js/social.js").read_text(encoding="utf-8")
    assert "walk:" in js
    assert "一起遛弯" in js


def test_activity_feed_labels_walk_action():
    sql = Path("supabase/migrations/20260705_010_activity_feed.sql").read_text(encoding="utf-8")
    assert "一起去遛弯" in sql
