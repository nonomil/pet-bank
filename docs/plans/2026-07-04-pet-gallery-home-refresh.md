# Pet Gallery Home Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the pet collection page into a friendlier four-gallery “pokedex hall” homepage with renamed top categories, unified icon badges, upgraded overview cards, and correct filtering that includes `pvz`.

**Architecture:** Keep the existing `CardCollection` module and retrofit it with a gallery configuration layer above the existing series filter. Replace hard-coded source cards with gallery cards, redesign the overview section with dedicated hooks, and keep regression coverage at the string-structure level plus in-browser verification.

**Tech Stack:** Vanilla JavaScript, CSS, lightweight Python regression checks, Codex in-app browser verification.

---

### Task 1: Add failing regression checks for gallery-home refresh

**Files:**
- Create: `G:/StudyCode/宠物积分系统/prj/pet_gallery_home_refresh.test.py`
- Test: `G:/StudyCode/宠物积分系统/prj/pet_gallery_home_refresh.test.py`

**Step 1: Write the failing test**

- Assert the JS contains:
  - `阳光花园馆`
  - `奇趣冒险馆`
  - `创想课堂馆`
  - `方块生态馆`
  - a gallery mapping that includes `original` and `pvz`
- Assert the CSS contains:
  - `card-overview-hero`
  - `card-gallery-card`
  - `card-gallery-icon`

**Step 2: Run test to verify it fails**

Run: `python G:/StudyCode/宠物积分系统/prj/pet_gallery_home_refresh.test.py`

Expected: FAIL because the current JS/CSS still uses old source-card structures.

### Task 2: Implement gallery configuration and filtering

**Files:**
- Modify: `G:/StudyCode/宠物积分系统/js/card-collection.js`

**Step 1: Add gallery configuration**

- Create a config object for the 4 top-level galleries
- Map `original` + `pvz` into the same gallery
- Add human-facing gallery names, subtitles, and icon markup

**Step 2: Update filter state**

- Track selected gallery separately from selected series
- Make gallery click set the active gallery and reset series as needed
- Limit visible series tabs and grid items to the active gallery

**Step 3: Update source labels**

- Replace old source labels in card/detail copy with new gallery-facing labels

### Task 3: Redesign the overview and gallery cards

**Files:**
- Modify: `G:/StudyCode/宠物积分系统/js/card-collection.js`
- Modify: `G:/StudyCode/宠物积分系统/css/card-collection.css`

**Step 1: Replace the overview section markup**

- Build a larger hero overview card
- Build rarity and current-view side cards

**Step 2: Replace the old source card markup**

- Render gallery cards with circular badge icons
- Add subtitle text and visual active state

**Step 3: Add CSS**

- Style the new overview cards
- Style gallery cards and badge icons
- Preserve responsiveness

### Task 4: Verify green and browser acceptance

**Files:**
- Test: `G:/StudyCode/宠物积分系统/prj/pet_gallery_home_refresh.test.py`
- Test: `G:/StudyCode/宠物积分系统/prj/pet_pokedex_detail_layout.test.py`
- Test: `G:/StudyCode/宠物积分系统/prj/shared_home_background_css.test.py`

**Step 1: Run regression checks**

Run:
- `python G:/StudyCode/宠物积分系统/prj/pet_gallery_home_refresh.test.py`
- `python G:/StudyCode/宠物积分系统/prj/pet_pokedex_detail_layout.test.py`
- `python G:/StudyCode/宠物积分系统/prj/shared_home_background_css.test.py`
- `node --check G:/StudyCode/宠物积分系统/js/card-collection.js`

**Step 2: Browser verification**

- Reload the local page in Codex in-app browser
- Open `宠物 -> 卡片图鉴`
- Verify the 4 gallery cards, overview cards, and gallery filtering visually

**Step 3: Close out**

- Report what changed
- Call out any remaining visual rough edges honestly
