from pathlib import Path


def test_household_ui_exposes_issue_household_invite_entrypoint():
    js = Path("js/household.js").read_text(encoding="utf-8")
    assert "issue-household-invite" in js
    assert "家庭邀请码" in js


def test_issue_household_invite_function_writes_household_invites():
    ts = Path("supabase/functions/issue-household-invite/index.ts").read_text(encoding="utf-8")
    assert "household_invites" in ts
    assert "invite_code" in ts


def test_household_invite_management_supports_history_and_revoke():
    js = Path("js/household.js").read_text(encoding="utf-8")
    ts = Path("supabase/functions/revoke-household-invite/index.ts").read_text(encoding="utf-8")

    assert "householdInvites" in js
    assert "撤销邀请码" in js
    assert "revoke-household-invite" in js
    assert "household_invites" in ts
    assert "status: 'revoked'" in ts
