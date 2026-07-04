# Pet Gallery Cover Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the pet gallery into a more polished pokedex homepage with Agnes-generated gallery cover art, collectible state badges instead of grayscale hiding, and cleaner second-level “theme booklet” filtering.

**Architecture:** Keep the existing `CardCollection` module but add a `theme booklet` layer between gallery selection and grid filtering. Generate four landscape cover images via the existing Agnes workflow into workspace assets, wire those images into the gallery cards, and update card state styling so collected/uncollected are visual markers rather than disabled-looking cards.

**Tech Stack:** Vanilla JavaScript, CSS, Python Agnes generator script, local regression tests, Codex in-app browser verification.

---

### Task 1: Add failing regression coverage for cover-art and theme-booklet behavior

**Files:**
- Create: `G:/StudyCode/宠物积分系统/prj/pet_gallery_cover_upgrade.test.py`
- Test: `G:/StudyCode/宠物积分系统/prj/pet_gallery_cover_upgrade.test.py`

**Step 1: Write the failing test**

- Assert JS contains:
  - `神话瑞兽册`
  - `星梦奇旅册`
  - `card-gallery-cover-image`
  - `card-theme-empty`
- Assert CSS contains:
  - `card-gallery-card-media`
  - `card-collect-state-badge`
  - `card-theme-booklets`
- Assert CSS no longer contains grayscale rule for `.card-item.card-item-book.uncollected .card-portrait img`

**Step 2: Run test to verify it fails**

Run: `python G:/StudyCode/宠物积分系统/prj/pet_gallery_cover_upgrade.test.py`

Expected: FAIL on current implementation.

### Task 2: Add Agnes gallery cover generation script and assets

**Files:**
- Create: `G:/StudyCode/宠物积分系统/scripts/generators/gen_gallery_covers.py`
- Create: `G:/StudyCode/宠物积分系统/assets/pokedex-halls/` (output directory)
- Modify: `G:/StudyCode/宠物积分系统/docs/GPT生图/README.md`

**Step 1: Reuse Agnes token-loading pattern**

- Copy the safe `.env` token-loading pattern from `gen_hanzi_images.py`
- Keep token out of logs

**Step 2: Define 4 gallery prompts**

- Sunshine / Adventure / Classroom / Blocky hall covers
- Use a unified storybook scenic prompt style
- No text, landscape ratio, HTML overlays reserved

**Step 3: Generate final assets**

- Save final files into `assets/pokedex-halls/`
- Record result JSON for traceability

### Task 3: Implement theme booklet filtering and cover-card rendering

**Files:**
- Modify: `G:/StudyCode/宠物积分系统/js/card-collection.js`

**Step 1: Add theme booklet config**

- Map gallery id -> booklet id -> series list
- Track selected booklet state

**Step 2: Update filtering**

- All hall: hide booklet chips and show a helper message
- Selected hall: show only that hall’s booklet chips
- Grid filters by booklet when one is selected

**Step 3: Update gallery card markup**

- Add image layer using generated cover assets
- Keep title/progress HTML on top of image

### Task 4: Redesign collected/uncollected card state styling

**Files:**
- Modify: `G:/StudyCode/宠物积分系统/css/card-collection.css`
- Modify: `G:/StudyCode/宠物积分系统/js/card-collection.js`

**Step 1: Remove grayscale-disabled look**

- Keep portraits full color for all cards
- Replace disabled treatment with state badges

**Step 2: Add collected-state markers**

- `已收录` or `待发现` badge
- Mild border/accent differences only

**Step 3: Tighten gallery-card proportions**

- Reduce the current oversized block look
- Use a shorter, more cover-like aspect

### Task 5: Verify, browser-check, and document output paths

**Files:**
- Test: `G:/StudyCode/宠物积分系统/prj/pet_gallery_cover_upgrade.test.py`
- Test: `G:/StudyCode/宠物积分系统/prj/pet_gallery_home_refresh.test.py`
- Test: `G:/StudyCode/宠物积分系统/prj/pet_pokedex_detail_layout.test.py`
- Test: `G:/StudyCode/宠物积分系统/prj/shared_home_background_css.test.py`

**Step 1: Run verification**

Run:
- `python G:/StudyCode/宠物积分系统/prj/pet_gallery_cover_upgrade.test.py`
- `python G:/StudyCode/宠物积分系统/prj/pet_gallery_home_refresh.test.py`
- `python G:/StudyCode/宠物积分系统/prj/pet_pokedex_detail_layout.test.py`
- `python G:/StudyCode/宠物积分系统/prj/shared_home_background_css.test.py`
- `node --check G:/StudyCode/宠物积分系统/js/card-collection.js`

**Step 2: Browser acceptance**

- Reload local app in Codex in-app browser
- Open `宠物 -> 卡片图鉴`
- Check cover cards, booklet logic, and collected-state visuals

**Step 3: Report generated asset paths**

- Mention exact final image paths in `assets/pokedex-halls/`
