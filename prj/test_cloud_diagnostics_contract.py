from pathlib import Path


def test_settings_page_contains_cloud_diagnostics_mount_and_script():
    html = Path("index.html").read_text(encoding="utf-8")
    loader = Path("js/runtime-loader.js").read_text(encoding="utf-8")
    assert 'id="diagnostics-root"' in html
    assert "js/cloud-diagnostics.js" in loader


def test_cloud_diagnostics_service_aggregates_family_social_debug_state():
    js = Path("js/cloud-diagnostics.js").read_text(encoding="utf-8")
    assert "CloudDiagnostics" in js
    assert "CloudClient" in js
    assert "AuthSystem" in js
    assert "HouseholdSystem" in js
    assert "CloudSync" in js
    assert "SocialSystem" in js
    assert "CloudRestore" in js
    assert "ActivityFeedSystem" in js
    assert "最近同步结果" in js
    assert "configSource" in js
    assert "配置来源" in js
    assert "导出诊断 JSON" in js
    assert "exportSnapshot" in js
    assert "URL.createObjectURL" in js
    assert "petbank_diagnostics_device_label" in js
    assert "设置设备标签" in js
    assert "deviceLabel" in js


def test_settings_page_refreshes_cloud_diagnostics_panel():
    js = Path("js/app.js").read_text(encoding="utf-8")
    assert "CloudDiagnostics.render" in js
