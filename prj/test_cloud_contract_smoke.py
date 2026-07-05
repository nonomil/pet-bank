from pathlib import Path


def test_cloud_bootstrap_script_is_loaded():
    html = Path("index.html").read_text(encoding="utf-8")
    assert "js/cloud-client.js" in html
    assert "cloud-config.local.js" in html
