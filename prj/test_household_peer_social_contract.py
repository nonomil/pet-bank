from pathlib import Path


def test_house_visits_policy_allows_household_peers():
    sql = Path("supabase/migrations/20260705_005_house_visits.sql").read_text(encoding="utf-8")
    assert "create or replace function public.can_children_interact" in sql
    assert "public.can_children_interact(from_child_id, to_child_id)" in sql


def test_async_pk_policy_allows_household_peers():
    sql = Path("supabase/migrations/20260705_006_async_pk.sql").read_text(encoding="utf-8")
    fn = Path("supabase/functions/issue-pk-match/index.ts").read_text(encoding="utf-8")
    assert "public.can_children_interact(challenger_child_id, opponent_child_id)" in sql
    assert "requesterChildProfile.household_id === opponentChild.household_id" in fn


def test_social_and_pk_frontend_expose_household_peers():
    social_js = Path("js/social.js").read_text(encoding="utf-8")
    pk_js = Path("js/pk-service.js").read_text(encoding="utf-8")

    assert "householdPeers" in social_js
    assert "家庭里的其他孩子" in social_js
    assert "getAvailablePeers" in pk_js
    assert "socialState.householdPeers" in pk_js
