from pathlib import Path


def test_pk_service_contains_submit_attempt_and_pending_matches():
    js = Path("js/pk-service.js").read_text(encoding="utf-8")
    assert "submit-pk-attempt" in js
    assert "pendingMatches" in js


def test_game_modules_expose_async_match_entrypoints():
    math_js = Path("js/math-pk.js").read_text(encoding="utf-8")
    hanzi_js = Path("js/hanzi-game.js").read_text(encoding="utf-8")
    assert "startAsyncMatch" in math_js
    assert "startAsyncMatch" in hanzi_js


def test_async_pk_modules_expose_question_set_describers():
    math_js = Path("js/math-pk.js").read_text(encoding="utf-8")
    hanzi_js = Path("js/hanzi-game.js").read_text(encoding="utf-8")
    pk_js = Path("js/pk-service.js").read_text(encoding="utf-8")
    assert "describeAsyncQuestionSet" in math_js
    assert "difficultyLabel" in math_js
    assert "describeAsyncQuestionSet" in hanzi_js
    assert "modeLabel" in hanzi_js
    assert "getQuestionSetSummary" in pk_js
    assert "summaryText" in pk_js
