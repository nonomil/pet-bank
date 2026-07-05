from pathlib import Path


def test_household_migration_contains_membership_table():
    sql = Path("supabase/migrations/20260705_002_households.sql").read_text(encoding="utf-8")
    assert "create table if not exists household_members" in sql.lower()
