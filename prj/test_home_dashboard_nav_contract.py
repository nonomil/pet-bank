from __future__ import annotations

import re
from pathlib import Path


HTML = Path("index.html").read_text(encoding="utf-8")
CSS = Path("css/style.css").read_text(encoding="utf-8")


def page_block(page_id: str, next_page_id: str) -> str:
    pattern = re.compile(
        rf'<div class="page(?: active)?" id="{re.escape(page_id)}">(.*?)<div class="page(?: active)?" id="{re.escape(next_page_id)}">',
        re.S,
    )
    match = pattern.search(HTML)
    assert match, f"could not find block for {page_id}"
    return match.group(1)


def test_home_dashboard_removes_route_map_and_keeps_full_width_warehouse():
    home = page_block("page-map", "page-settings")
    assert 'id="sceneGridMap"' not in home
    assert 'id="treasureWarehouseCard"' in home
    assert 'class="map-warehouse-panel"' in home


def test_today_and_pet_hubs_use_compact_section_menu():
    today = page_block("page-today", "page-review")
    pet = page_block("page-pet", "page-home")
    works = page_block("page-works", "page-pet")

    for block in (today, pet, works):
        assert 'class="hub-nav"' not in block
        assert 'class="section-shortcuts"' in block
        assert 'class="section-shortcut-btn' in block


def test_home_dashboard_menu_and_warehouse_styles_exist():
    assert 'class="nav-hub"' in HTML
    assert 'class="nav-tab-menu"' in HTML
    assert "handlePrimaryNavClick('today')" in HTML
    assert "handlePrimaryNavClick('pet')" in HTML
    assert ".nav-hub" in CSS
    assert ".nav-tab-menu" in CSS
    assert ".main-content .section-menu" in CSS
    assert ".section-shortcuts" in CSS
    assert ".section-shortcut-btn" in CSS
    assert ".map-warehouse-panel" in CSS
