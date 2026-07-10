from pathlib import Path


def test_cloud_bootstrap_script_is_loaded():
    html = Path("index.html").read_text(encoding="utf-8")
    loader = Path("js/runtime-loader.js").read_text(encoding="utf-8")
    assert "js/runtime-loader.js" in html
    assert "js/cloud-client.js" in loader
    assert "js/cloud-config-loader.js" in loader
    assert '<script src="cloud-config.local.js"></script>' not in html
