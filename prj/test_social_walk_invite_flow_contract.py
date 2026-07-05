from pathlib import Path


def test_social_service_exposes_walk_invite_and_accept_flow():
    js = Path("js/social.js").read_text(encoding="utf-8")
    assert "openWalkInvite" in js
    assert "acceptWalkInvite" in js
    assert "pendingWalkInvite" in js
    assert "按同路线遛弯" in js


def test_social_walk_invite_persists_route_metadata():
    js = Path("js/social.js").read_text(encoding="utf-8")
    assert "route_id" in js
    assert "route_name" in js
    assert "response_to_visit_id" in js
    assert "kind: 'walk_invite'" in js
    assert "kind: 'walk_reply'" in js


def test_walk_service_exposes_routes_for_social_invite_picker():
    js = Path("js/walk.js").read_text(encoding="utf-8")
    assert "getRoutes" in js
