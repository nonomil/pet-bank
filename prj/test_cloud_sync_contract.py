from pathlib import Path


def test_frontend_loads_cloud_sync_service():
    html = Path("index.html").read_text(encoding="utf-8")
    js = Path("js/cloud-sync.js").read_text(encoding="utf-8")
    assert "js/cloud-sync.js" in html
    assert "syncActiveChildState" in js


def test_cloud_sync_uses_pet_and_home_summaries():
    js = Path("js/cloud-sync.js").read_text(encoding="utf-8")
    assert "pet_summary_json" in js
    assert "home_summary_json" in js


def test_cloud_sync_tracks_last_outcome_and_sync_steps():
    js = Path("js/cloud-sync.js").read_text(encoding="utf-8")
    assert "lastOutcome" in js
    assert "lastAttemptedAt" in js
    assert "lastSucceededAt" in js
    assert "lastFailedAt" in js
    assert "pendingReason" in js
    assert "lastKnownChildId" in js
    assert "lastStep" in js
    assert "getOutcomeLabel" in js
    assert "getReasonLabel" in js
