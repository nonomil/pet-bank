from pathlib import Path


def test_cloud_bootstrap_script_is_loaded():
    html = Path("index.html").read_text(encoding="utf-8")
    assert "js/cloud-client.js" in html
    assert "js/cloud-config-loader.js" in html
    assert '<script src="cloud-config.local.js"></script>' not in html
