from pathlib import Path


def test_friend_graph_migration_contains_child_friendships():
    sql = Path("supabase/migrations/20260705_004_friend_graph.sql").read_text(encoding="utf-8")
    assert "child_friendships" in sql


def test_frontend_loads_social_service_and_friend_redeem_hook():
    loader = Path("js/runtime-loader.js").read_text(encoding="utf-8")
    js = Path("js/social.js").read_text(encoding="utf-8")
    assert "js/social.js" in loader
    assert "redeem-friend-code" in js
