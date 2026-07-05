from pathlib import Path


def test_registration_invite_schema_exists():
    sql = Path("supabase/migrations/20260705_008_registration_invites.sql").read_text(encoding="utf-8")
    lowered = sql.lower()
    assert "create table if not exists public.registration_invites" in lowered
    assert "invite_code" in lowered


def test_auth_signup_validates_and_claims_registration_invite():
    js = Path("js/auth.js").read_text(encoding="utf-8")
    assert "validate-registration-invite" in js
    assert "claim-registration-invite" in js
    assert "注册邀请码（预留）" not in js


def test_registration_invite_edge_functions_use_registration_invites_table():
    validate_ts = Path("supabase/functions/validate-registration-invite/index.ts").read_text(encoding="utf-8")
    claim_ts = Path("supabase/functions/claim-registration-invite/index.ts").read_text(encoding="utf-8")
    assert "registration_invites" in validate_ts
    assert "registration_invites" in claim_ts
