from pathlib import Path


def test_index_loads_family_social_scope_script():
    loader = Path("js/runtime-loader.js").read_text(encoding="utf-8")
    assert "js/family-social-scope.js" in loader


def test_family_social_scope_defaults_to_minimal_v1():
    js = Path("js/family-social-scope.js").read_text(encoding="utf-8")
    assert "minimal-v1" in js
    assert "shouldShowDiagnostics" in js
    assert "shouldShowPKControls" in js


def test_settings_and_social_panels_respect_minimal_scope():
    app_js = Path("js/app.js").read_text(encoding="utf-8")
    auth_js = Path("js/auth.js").read_text(encoding="utf-8")
    social_js = Path("js/social.js").read_text(encoding="utf-8")
    diagnostics_js = Path("js/cloud-diagnostics.js").read_text(encoding="utf-8")

    assert "FamilySocialScope" in app_js
    assert "shouldShowDiagnostics" in app_js
    assert "FamilySocialScope" in auth_js
    assert "一期先聚焦" in auth_js
    assert "shouldShowPKControls" in social_js
    assert "一期先做好友码、串门和轻互动" in social_js
    assert "shouldShowDiagnostics" in diagnostics_js
