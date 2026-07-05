from pathlib import Path


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
