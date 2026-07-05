from pathlib import Path


def test_child_social_profile_migration_contains_visibility_helper_and_rpc():
    sql = Path("supabase/migrations/20260705_009_child_social_profiles.sql").read_text(encoding="utf-8")
    lowered = sql.lower()
    assert "create or replace function public.can_view_child_social_profile" in lowered
    assert "create or replace function public.get_child_social_profiles" in lowered


def test_cloud_client_social_profile_helper_is_available():
    js = Path("js/cloud-client.js").read_text(encoding="utf-8")
    assert "getChildSocialProfiles" in js
    assert "get_child_social_profiles" in js


def test_social_and_pk_use_child_social_profile_helper():
    social_js = Path("js/social.js").read_text(encoding="utf-8")
    pk_js = Path("js/pk-service.js").read_text(encoding="utf-8")
    assert "getChildSocialProfiles" in social_js
    assert "getChildSocialProfiles" in pk_js


def test_family_review_and_leaderboard_include_household_peers_in_summary():
    family_review_js = Path("js/family-review.js").read_text(encoding="utf-8")
    leaderboard_js = Path("js/leaderboard.js").read_text(encoding="utf-8")
    assert "householdPeers" in family_review_js
    assert "互动同伴" in family_review_js
    assert "householdPeers" in leaderboard_js
    assert "互动同伴" in leaderboard_js
