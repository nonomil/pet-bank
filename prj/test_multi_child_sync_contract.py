from pathlib import Path


def test_profile_sync_exposes_cloud_summary_builder():
    js = Path("js/profile-sync.js").read_text(encoding="utf-8")
    assert "buildCloudChildSummary" in js
    assert "petbank_pet" in js
    assert "petbank_home_state" in js


def test_household_ui_supports_syncing_all_children():
    js = Path("js/household.js").read_text(encoding="utf-8")
    assert "syncAllChildren" in js
    assert "syncProfile(" in js
    assert "同步全部孩子到云端" in js


def test_household_ui_shows_latest_cloud_sync_status():
    js = Path("js/household.js").read_text(encoding="utf-8")
    assert "最近一次云端同步" in js
    assert "CloudSync" in js
    assert "立即重试当前孩子" in js
