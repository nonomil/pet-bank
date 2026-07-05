from pathlib import Path


def test_admin_role_migration_contains_role_and_audit_tables():
    sql = Path("supabase/migrations/20260705_012_admin_roles.sql").read_text(encoding="utf-8")
    lowered = sql.lower()
    assert "create table if not exists public.user_roles" in lowered
    assert "create table if not exists public.admin_audit_logs" in lowered
    assert "create or replace function public.is_admin" in lowered
