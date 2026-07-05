from pathlib import Path


def test_index_contains_auth_mount():
    html = Path("index.html").read_text(encoding="utf-8")
    assert 'id="auth-root"' in html
