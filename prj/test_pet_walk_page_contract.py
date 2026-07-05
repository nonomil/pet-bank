from pathlib import Path


def test_index_contains_dedicated_walk_page_mount():
    html = Path("index.html").read_text(encoding="utf-8")
    assert 'id="page-walk"' in html
    assert 'id="walk-page-root"' in html


def test_pet_top_navigation_treats_walk_as_a_real_page():
    app_js = Path("js/app.js").read_text(encoding="utf-8")
    assert "page: 'walk', label: '遛弯'" in app_js
    assert "action: 'walk', label: '遛弯'" not in app_js
    assert "page === 'walk'" in app_js


def test_open_pet_walk_switches_to_walk_page():
    app_js = Path("js/app.js").read_text(encoding="utf-8")
    assert "switchPage('walk')" in app_js
    assert "switchPage('pet')" not in app_js.split("function openPetWalk", 1)[1].split("document.addEventListener", 1)[0]


def test_pet_page_is_now_growth_archive_instead_of_action_panel():
    html = Path("index.html").read_text(encoding="utf-8")
    assert "成长档案" in html
    assert "下一阶段预览" in html
    assert 'onclick="feedPet()"' not in html
    assert 'onclick="playWithPet()"' not in html
    assert 'onclick="restPet()"' not in html
    assert 'id="walkArea"' not in html
