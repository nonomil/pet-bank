from pathlib import Path


def test_cloud_loader_uses_pages_safe_public_config_bundle():
    loader = Path("js/cloud-config-loader.js").read_text(encoding="utf-8")
    assert "js/cloud-config.public.js" in loader
    assert Path("js/cloud-config.public.js").exists()
