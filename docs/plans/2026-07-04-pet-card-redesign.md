# Pet Card Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current corner-stat HTML pet cards with Agnes-generated frame templates plus script-composed, Chinese-labeled collectible card images.

**Architecture:** Keep `CardCollection` as the page controller, but switch list cards to prefer a new `assets/cards/composed-v2/{pet_id}.webp` output. Generate a new frame family with Agnes, compose card images locally with PIL, and keep a fallback path only while the new asset pack is incomplete.

**Tech Stack:** Vanilla JavaScript, CSS, Python PIL, Agnes image API, local regression tests, Codex in-app browser verification.

---

### Task 1: Lock the new card pipeline with a failing regression test

**Files:**
- Modify: `G:/StudyCode/宠物积分系统/prj/pet_gallery_cover_upgrade.test.py`
- Create: `G:/StudyCode/宠物积分系统/prj/pet_card_redesign.test.py`

**Step 1: Write the failing test**

- Assert JS references:
  - `assets/cards/composed-v2/`
  - `card-composed-v2`
  - Chinese stat labels such as `生命` and `攻击`
- Assert scripts exist for:
  - Agnes frame generation
  - local V2 card composition

**Step 2: Run test to verify it fails**

Run: `python G:/StudyCode/宠物积分系统/prj/pet_card_redesign.test.py`

Expected: FAIL on missing V2 pipeline hooks.

### Task 2: Add Agnes V2 frame generation script and asset folder

**Files:**
- Create: `G:/StudyCode/宠物积分系统/scripts/generators/gen_card_frames_v2.py`
- Create: `G:/StudyCode/宠物积分系统/assets/cards/v2/`
- Modify: `G:/StudyCode/宠物积分系统/docs/GPT生图/README.md`

**Step 1: Define V2 frame prompts**

- Keep the frame child-friendly and collectible
- Reserve:
  - top badge area
  - central portrait area
  - bottom name and stat area
- No creature, no real numbers, no final text

**Step 2: Generate 4 rarity templates**

- `frame-common-v2.png`
- `frame-rare-v2.png`
- `frame-epic-v2.png`
- `frame-legendary-v2.png`

### Task 3: Build the V2 card composition script

**Files:**
- Create: `G:/StudyCode/宠物积分系统/scripts/generators/compose_cards_v2.py`
- Output: `G:/StudyCode/宠物积分系统/assets/cards/composed-v2/`

**Step 1: Compose one sample card first**

- Recommended first sample: `pvz_sunflower`
- Overlay:
  - pet portrait
  - series / source tag
  - pet name
  - Chinese stat labels: `生命 / 攻击 / 防御 / 速度`

**Step 2: Batch-compose the full set**

- Reuse the same frame family
- Keep emoji or placeholder fallback only for pets that truly lack usable art

### Task 4: Switch the gallery list to prefer full card images

**Files:**
- Modify: `G:/StudyCode/宠物积分系统/js/card-collection.js`
- Modify: `G:/StudyCode/宠物积分系统/css/card-collection.css`

**Step 1: Prefer V2 composed card image**

- Use `assets/cards/composed-v2/{id}.webp`
- Keep a graceful fallback only if an image is missing

**Step 2: Remove dependency on corner stat circles for the main card list**

- The image itself should now carry the main stat presentation
- HTML wrapper keeps collect state and click behavior

### Task 5: Verify sample quality and browser behavior

**Files:**
- Test: `G:/StudyCode/宠物积分系统/prj/pet_card_redesign.test.py`
- Test: `G:/StudyCode/宠物积分系统/prj/pet_gallery_cover_upgrade.test.py`

**Step 1: Run verification**

Run:
- `python G:/StudyCode/宠物积分系统/prj/pet_card_redesign.test.py`
- `python G:/StudyCode/宠物积分系统/prj/pet_gallery_cover_upgrade.test.py`
- `node --check G:/StudyCode/宠物积分系统/js/card-collection.js`

**Step 2: Browser acceptance**

- Reload local page
- Open `宠物 -> 卡片图鉴`
- Confirm:
  - list card is image-first
  - no strange four-corner stat reading
  - Chinese stat labels are visible
  - sample card quality matches the new direction
