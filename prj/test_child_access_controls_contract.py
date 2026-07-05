from pathlib import Path


def test_child_access_migration_contains_visit_and_pk_controls():
    sql = Path("supabase/migrations/20260705_011_child_access_controls.sql").read_text(encoding="utf-8")
    lowered = sql.lower()
    assert "visit_access" in lowered
    assert "pk_access" in lowered
    assert "create or replace function public.can_child_receive_visit" in lowered
    assert "create or replace function public.can_challenge_child" in lowered


def test_visit_and_pk_policies_use_child_access_controls():
    visit_sql = Path("supabase/migrations/20260705_005_house_visits.sql").read_text(encoding="utf-8")
    pk_sql = Path("supabase/migrations/20260705_006_async_pk.sql").read_text(encoding="utf-8")
    assert "public.can_child_receive_visit(from_child_id, to_child_id)" in visit_sql
    assert "public.can_challenge_child(challenger_child_id, opponent_child_id)" in pk_sql


def test_issue_pk_match_function_checks_pk_access():
    fn = Path("supabase/functions/issue-pk-match/index.ts").read_text(encoding="utf-8")
    assert "pk_access" in fn
    assert "does not accept PK challenges right now" in fn


def test_social_and_cloud_sync_expose_visit_and_pk_access_controls():
    social_js = Path("js/social.js").read_text(encoding="utf-8")
    cloud_sync_js = Path("js/cloud-sync.js").read_text(encoding="utf-8")
    assert "setVisitAccess" in social_js
    assert "setPKAccess" in social_js
    assert "visit_access" in social_js
    assert "pk_access" in social_js
    assert "setVisitAccess" in cloud_sync_js
    assert "setPKAccess" in cloud_sync_js


def test_pk_service_filters_peers_by_pk_access():
    js = Path("js/pk-service.js").read_text(encoding="utf-8")
    assert "pk_access" in js
    assert "only household peers can challenge right now" in js
