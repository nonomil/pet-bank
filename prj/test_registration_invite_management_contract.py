from pathlib import Path


def test_registration_invite_management_edge_functions_exist():
    issue_ts = Path("supabase/functions/issue-registration-invite/index.ts").read_text(encoding="utf-8")
    list_ts = Path("supabase/functions/list-registration-invites/index.ts").read_text(encoding="utf-8")
    revoke_ts = Path("supabase/functions/revoke-registration-invite/index.ts").read_text(encoding="utf-8")

    assert "registration_invites" in issue_ts
    assert "created_by_account_id" in issue_ts
    assert "registration_invites" in list_ts
    assert "created_by_account_id" in list_ts
    assert "registration_invites" in revoke_ts
    assert "created_by_account_id" in revoke_ts
    assert "status: 'revoked'" in revoke_ts


def test_auth_shell_exposes_registration_invite_management():
    js = Path("js/auth.js").read_text(encoding="utf-8")

    assert "issue-registration-invite" in js
    assert "list-registration-invites" in js
    assert "revoke-registration-invite" in js
    assert "签发注册邀请码" in js
    assert "registrationInvites" in js
    assert "撤销邀请码" in js
