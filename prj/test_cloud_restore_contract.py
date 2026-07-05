from pathlib import Path


def test_frontend_loads_cloud_restore_service():
    html = Path("index.html").read_text(encoding="utf-8")
    assert "js/cloud-restore.js" in html


def test_cloud_restore_service_handles_cloud_snapshots_and_safe_restore():
    js = Path("js/cloud-restore.js").read_text(encoding="utf-8")
    assert "hydrateFromCloud" in js
    assert "pet_state_snapshots" in js
    assert "profileSnapshot" in js
    assert "overwriteExisting" in js


def test_app_boot_hydrates_from_cloud_before_loading_local_state():
    js = Path("js/app.js").read_text(encoding="utf-8")
    assert "CloudRestore.hydrateFromCloud" in js


def test_auth_flow_triggers_cloud_restore_after_successful_login():
    js = Path("js/auth.js").read_text(encoding="utf-8")
    assert "CloudRestore.hydrateFromCloud" in js


def test_profile_manager_supports_imported_cloud_profiles_and_snapshot_apply():
    js = Path("js/profiles.js").read_text(encoding="utf-8")
    assert "upsertImportedProfile" in js
    assert "applySnapshotForProfile" in js


def test_settings_ui_exposes_manual_cloud_restore_controls():
    js = Path("js/household.js").read_text(encoding="utf-8")
    assert "从云端导入孩子档案" in js
    assert "用云端覆盖本地数据" in js
    assert "HouseholdSystem.restoreFromCloud" in js


def test_manual_cloud_restore_supports_safe_and_force_modes():
    js = Path("js/household.js").read_text(encoding="utf-8")
    assert "overwriteExisting: false" in js
    assert "overwriteExisting: true" in js
