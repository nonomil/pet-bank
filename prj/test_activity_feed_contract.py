from pathlib import Path


def test_activity_feed_migration_contains_table_and_triggers():
    sql = Path("supabase/migrations/20260705_010_activity_feed.sql").read_text(encoding="utf-8")
    lowered = sql.lower()
    assert "create table if not exists public.activity_feed" in lowered
    assert "create or replace function public.log_house_visit_activity" in lowered
    assert "create or replace function public.log_pk_match_activity" in lowered
    assert "create or replace function public.log_pk_attempt_activity" in lowered
    assert "create trigger house_visits_activity_feed_trigger" in lowered
    assert "create trigger pk_matches_activity_feed_trigger" in lowered


def test_frontend_loads_activity_feed_service():
    loader = Path("js/runtime-loader.js").read_text(encoding="utf-8")
    js = Path("js/activity-feed.js").read_text(encoding="utf-8")
    assert "js/activity-feed.js" in loader
    assert ".from('activity_feed')" in js
    assert "ActivityFeedSystem" in js


def test_family_review_reads_cloud_activity_feed():
    js = Path("js/family-review.js").read_text(encoding="utf-8")
    assert "ActivityFeedSystem" in js
    assert "activityEntries" in js
