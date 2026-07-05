from pathlib import Path


def test_children_schema_contains_child_profiles_and_pet_state():
    sql = Path("supabase/migrations/20260705_003_children_and_pet_state.sql").read_text(encoding="utf-8")
    lowered = sql.lower()
    assert "create table if not exists child_profiles" in lowered
    assert "create table if not exists pet_state_snapshots" in lowered
