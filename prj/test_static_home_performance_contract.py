from pathlib import Path
import re


def test_index_defers_non_home_scripts_and_inline_pet_db_boot():
    html = Path("index.html").read_text(encoding="utf-8")
    assert "PetSystem.loadPetDB().then" not in html
    assert 'src="https://unpkg.com/lucide@latest"' not in html
    assert 'src="js/runtime-loader.js"' in html
    assert 'src="js/lucide-lite.js"' in html
    assert 'src="js/exploration.js"' not in html
    assert 'src="js/learn-center.js?v=2"' not in html
    assert 'src="js/social.js"' not in html
    assert 'src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"' not in html


def test_index_defers_non_home_css():
    html = Path("index.html").read_text(encoding="utf-8")
    assert 'href="css/walk.css"' not in html
    assert 'href="css/card-collection.css"' not in html
    assert 'href="css/arena.css"' not in html
    assert 'href="css/leaderboard.css?v=2"' not in html
    assert 'href="css/hanzi-game.css?v=4"' not in html
    assert 'href="css/learn-center.css?v=2"' not in html


def test_admin_uses_loader_instead_of_direct_local_cloud_config():
    html = Path("admin.html").read_text(encoding="utf-8")
    assert 'src="cloud-config.local.js"' not in html
    assert 'src="js/runtime-loader.js"' in html
    assert "ensureAdminPage" in html


def test_settings_runtime_prioritizes_cloud_without_learn_bundle():
    js = Path("js/runtime-loader.js").read_text(encoding="utf-8")
    match = re.search(r"case 'settings':(?P<body>.*?)case 'home-visit':", js, re.S)
    assert match
    body = match.group("body")
    assert "ensureCloudFeature" in body
    assert "ensureLearnFeature" not in body


def test_runtime_loader_vendors_supabase_browser_bundle():
    js = Path("js/runtime-loader.js").read_text(encoding="utf-8")
    assert "js/vendor/supabase-js.js" in js
    assert "cdn.jsdelivr.net/npm/@supabase/supabase-js@2" not in js
