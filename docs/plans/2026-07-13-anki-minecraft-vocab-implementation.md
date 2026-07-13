# Anki Minecraft Vocab Web Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an isolated static web project that extracts the modern Anki deck database and presents its directory, cards, HTML fields, images, and audio.

**Architecture:** A Python extractor reads `collection.anki21` from the user-provided `.apkg`, writes normalized JSON and copied media under `prj/anki-minecraft-vocab/`, and a dependency-free browser app loads those JSON files. The app treats deck paths as the directory source, keeps encrypted-looking fields visible as unavailable data, and does not write to the main `data/vocab/` registry yet.

**Tech Stack:** Python 3 standard library (`zipfile`, `sqlite3`, `json`, `html`), Vanilla HTML/CSS/JS, browser static server.

---

### Task 1: Add extraction contract and fixtures

**Files:**
- Create: `prj/anki-minecraft-vocab/scripts/extract_apkg.py`
- Create: `prj/anki-minecraft-vocab/scripts/test_extract_apkg.py`
- Create: `prj/anki-minecraft-vocab/README.md`

**Step 1: Write the failing test**

Test a temporary APKG containing both `collection.anki2` and `collection.anki21`, assert the modern database is selected, note fields are normalized, deck paths are preserved, and media references are safe relative paths.

**Step 2: Run test to verify it fails**

Run: `python -m unittest discover -s prj/anki-minecraft-vocab/scripts -p "test_*.py" -v`

Expected: FAIL because the extractor does not exist.

**Step 3: Implement the minimal extractor**

Implement CLI arguments for `--input`, `--out-dir`, and optional `--copy-media`. Open the APKG as a ZIP, select `collection.anki21` before `collection.anki2`, parse models/decks/notes/cards, convert field HTML to searchable text, retain raw HTML, resolve `media` references, and reject path traversal.

**Step 4: Run test to verify it passes**

Run the same unittest command and expect PASS.

**Step 5: Document usage**

Document the real extraction command, the modern database explanation, the encrypted-field limitation, and the static server command. Do not copy the source APKG into the project.

### Task 2: Extract the supplied deck into the isolated project

**Files:**
- Generate: `prj/anki-minecraft-vocab/data/manifest.json`
- Generate: `prj/anki-minecraft-vocab/data/decks.json`
- Generate: `prj/anki-minecraft-vocab/data/cards.json`
- Generate: `prj/anki-minecraft-vocab/assets/media/*`

**Step 1: Run the extractor**

Run: `python prj/anki-minecraft-vocab/scripts/extract_apkg.py --input "docs/参考/案例/🍅【我的世界】主题词汇━薯仔的外语小站.apkg" --out-dir prj/anki-minecraft-vocab --copy-media`

Expected: a manifest reporting 11,241 notes/cards and the media mapping count, with no output outside `prj/anki-minecraft-vocab/`.

**Step 2: Run data validation**

Run: `python -m unittest discover -s prj/anki-minecraft-vocab/scripts -p "test_*.py" -v`

Expected: PASS, including JSON parsing and path safety checks.

### Task 3: Build the static browser

**Files:**
- Create: `prj/anki-minecraft-vocab/index.html`
- Create: `prj/anki-minecraft-vocab/app.js`
- Create: `prj/anki-minecraft-vocab/styles.css`

**Step 1: Add the page shell**

Create a responsive app with a directory pane, search/filter controls, card list, and card detail panel. Use accessible buttons and labels; do not use emoji as UI icons.

**Step 2: Load normalized JSON**

Load `data/manifest.json`, `data/decks.json`, and `data/cards.json`, show a clear error if the page is opened with `file://`, and display a loading state while data is fetched.

**Step 3: Add interactions**

Implement deck selection, collapse/expand, text search, card selection, front/back toggle, audio playback, and mobile directory drawer behavior. Keep DOM rendering scoped to the project and escape/limit raw HTML rendering to card content.

**Step 4: Add responsive styling**

Use a restrained Minecraft-inspired green/charcoal/stone palette, dense directory scanning layout, stable card dimensions, visible focus states, reduced-motion support, and no horizontal overflow at 320px.

### Task 4: Browser verification and handoff

**Files:**
- Modify: `prj/anki-minecraft-vocab/README.md` if verification commands need updating.

**Step 1: Start a static server**

Run: `python -m http.server 8766 --bind 127.0.0.1` from `prj/anki-minecraft-vocab/`.

**Step 2: Verify key flows**

Open `http://127.0.0.1:8766/` and verify the directory count, search, card selection, front/back toggle, image loading, audio controls, and mobile layout.

**Step 3: Run repository-safe checks**

Run the extractor unit tests and inspect `git status --short`. Do not include generated media or project output in the main Pages artifact until an explicit integration decision is made.

