from pathlib import Path


def test_async_pk_schema_contains_question_sets():
    sql = Path("supabase/migrations/20260705_006_async_pk.sql").read_text(encoding="utf-8")
    assert "pk_question_sets" in sql


def test_frontend_loads_pk_service_and_issue_hook():
    loader = Path("js/runtime-loader.js").read_text(encoding="utf-8")
    js = Path("js/pk-service.js").read_text(encoding="utf-8")
    assert "js/pk-service.js" in loader
    assert "issue-pk-match" in js
