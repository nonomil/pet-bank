# Pet Pokedex Detail Sample Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a first-pass pet pokedex detail sample that upgrades the card modal into a book-like encyclopedia layout, with a fully authored `向日葵` sample and safe fallbacks for other pets.

**Architecture:** Rework the current `CardCollection.showDetail()` output from a compact dark battle-card modal into a larger two-column “pokedex book” layout. Keep the data source in `pets.json`, add a small JS-side detail metadata map for the first hero sample, and update the card collection layout so the list page feels like a catalog that leads into the new detail page.

**Tech Stack:** HTML string rendering in browser JS, CSS, Python source regression script, local markdown docs

---

### Task 1: Add the failing detail-layout regression

**Files:**
- Create: `prj/pet_pokedex_detail_layout.test.py`

**Step 1: Write the failing test**

Check that:

- `js/card-collection.js` contains a detail hero section class
- it contains a stage strip section class
- it contains a story section class
- it contains a trait section class
- it contains a skill section class
- `css/card-collection.css` contains matching style hooks

**Step 2: Run test to verify it fails**

Run: `python prj/pet_pokedex_detail_layout.test.py`

Expected: FAIL because the current modal still uses the old compact detail structure.

### Task 2: Define sample pokedex detail metadata

**Files:**
- Modify: `js/card-collection.js`

**Step 1: Add a small detail metadata map**

- Add a `DETAIL_SAMPLE_DATA` object keyed by pet name or id
- Author a full sample for `向日葵`
- Include:
  - title / subtitle
  - story
  - 3-4 traits
  - 2-3 skills
  - stage labels

**Step 2: Add fallback helpers**

- Add helpers that derive:
  - fallback subtitle
  - fallback story from existing `desc`
  - fallback traits from series / rarity / source
  - fallback skill labels from stat bias

**Step 3: Re-run the test**

Run: `python prj/pet_pokedex_detail_layout.test.py`

Expected: still FAIL until the new modal structure and CSS are implemented.

### Task 3: Upgrade the detail modal structure

**Files:**
- Modify: `js/card-collection.js`
- Modify: `index.html` only if the modal host needs a structural wrapper

**Step 1: Replace the old compact modal markup**

- Change `showDetail()` to render:
  - detail shell
  - left visual column
  - right info column
  - stage strip
  - stats panel

**Step 2: Make the layout reusable**

- Use the same layout for all pets
- Use `向日葵` sample content when available
- Use fallback content for every other pet

**Step 3: Improve stage rendering**

- Render available stage images from `stages` or `imageStages`
- Highlight the current stage based on existing pet stage logic when the viewed pet is the active pet
- Otherwise highlight a default representative stage

### Task 4: Redesign the CSS for the catalog + detail sample

**Files:**
- Modify: `css/card-collection.css`

**Step 1: Tighten the catalog page structure**

- Reduce the empty feeling in the stats band
- Make source cards align more intentionally
- Wrap tabs in a dedicated filter band
- Give the card list a clearer content container rhythm

**Step 2: Add the new pokedex detail styles**

- Add styles for:
  - detail shell
  - left hero panel
  - right story panel
  - badges / tags
  - stage strip
  - stat cards
  - responsive collapse

**Step 3: Preserve project visual language**

- Use warm paper tones, green accents, and soft gold lines
- Avoid returning to the old heavy dark battle-card modal look

### Task 5: Verify the new detail experience

**Files:**
- Modify: `prj/pet_pokedex_detail_layout.test.py` only if selectors must be refined

**Step 1: Run the new regression**

Run: `python prj/pet_pokedex_detail_layout.test.py`

Expected: PASS

**Step 2: Re-run the shared background regression**

Run: `python prj/shared_home_background_css.test.py`

Expected: PASS

**Step 3: Run a quick search audit**

Run: `rg -n "card-detail-story|card-detail-traits|card-detail-skills|card-detail-stages|向日葵" css/card-collection.css js/card-collection.js`

Expected: all new layout hooks and the authored sample are present.

### Task 6: Document the sample scope

**Files:**
- Modify: `docs/plans/2026-07-04-pet-pokedex-detail-design.md` only if implementation deviates

**Step 1: Record any implementation differences**

- Update the design doc only if the shipped structure differs materially from the approved design

**Step 2: Commit**

Only if the human partner asks for a commit.
