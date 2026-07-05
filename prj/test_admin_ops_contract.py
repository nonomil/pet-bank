from pathlib import Path


def test_admin_search_function_requires_admin_check():
    fn = Path("supabase/functions/admin-search-entities/index.ts").read_text(encoding="utf-8")
    assert "is_admin" in fn
    assert "service_role" in fn.lower() or "serviceRoleKey" in fn
