from pathlib import Path


def test_house_visit_schema_contains_action_type():
    sql = Path("supabase/migrations/20260705_005_house_visits.sql").read_text(encoding="utf-8")
    assert "action_type" in sql


def test_social_service_contains_visit_logger():
    js = Path("js/social.js").read_text(encoding="utf-8")
    assert "recordVisit" in js
