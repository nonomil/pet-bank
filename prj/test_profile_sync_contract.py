from pathlib import Path


def test_profile_sync_reads_profilemanager_snapshot_keys():
    js = Path("js/profile-sync.js").read_text(encoding="utf-8")
    assert "petbank_profile_data_" in js
