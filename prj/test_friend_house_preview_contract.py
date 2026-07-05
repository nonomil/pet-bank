from pathlib import Path


def test_child_profile_state_migration_contains_home_visibility():
    sql = Path("supabase/migrations/20260705_007_child_live_state.sql").read_text(encoding="utf-8")
    lowered = sql.lower()
    assert "home_visibility" in lowered
    assert "pet_summary_json" in lowered
    assert "home_summary_json" in lowered


def test_social_service_renders_friend_house_preview():
    js = Path("js/social.js").read_text(encoding="utf-8")
    assert "friend house" in js.lower() or "好友小屋" in js
    assert "home_summary_json" in js
