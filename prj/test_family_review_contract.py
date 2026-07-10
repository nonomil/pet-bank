from pathlib import Path


def test_review_page_loads_family_review_mount_and_script():
    html = Path("index.html").read_text(encoding="utf-8")
    loader = Path("js/runtime-loader.js").read_text(encoding="utf-8")
    assert 'id="family-review-root"' in html
    assert "js/family-review.js" in loader


def test_family_review_service_aggregates_household_social_and_pk_state():
    js = Path("js/family-review.js").read_text(encoding="utf-8")
    assert "HouseholdSystem" in js
    assert "SocialSystem" in js
    assert "PKService" in js


def test_leaderboard_reads_cloud_social_and_pk_summaries():
    js = Path("js/leaderboard.js").read_text(encoding="utf-8")
    assert "PKService.getState" in js
    assert "SocialSystem.getState" in js
