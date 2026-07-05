from pathlib import Path


def test_admin_html_loads_admin_auth_shell():
    html = Path("admin.html").read_text(encoding="utf-8")
    assert 'id="admin-root"' in html
    assert "js/admin-auth.js" in html
