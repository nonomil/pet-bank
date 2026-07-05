from pathlib import Path


def test_index_contains_friend_home_visit_page_mount():
    html = Path("index.html").read_text(encoding="utf-8")
    assert 'id="page-home-visit"' in html
    assert 'id="friend-home-visit-root"' in html


def test_app_routes_friend_home_visit_under_pet_tab():
    app_js = Path("js/app.js").read_text(encoding="utf-8")
    assert "'home-visit': 'pet'" in app_js
    assert "page === 'home-visit'" in app_js


def test_social_service_exposes_open_peer_home_flow():
    social_js = Path("js/social.js").read_text(encoding="utf-8")
    assert "openPeerHome" in social_js
    assert "renderFriendHomeVisit" in social_js
    assert "switchPage('home-visit')" in social_js
    assert "actionType === 'visit'" in social_js
