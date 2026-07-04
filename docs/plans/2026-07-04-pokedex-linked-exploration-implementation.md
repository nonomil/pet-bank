# Pokedex Linked Exploration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect the pet card story system and the exploration story system so the web app feels like a lightweight card-collecting creature adventure built around the existing growth loop.

**Architecture:** First move long-form pet dossier text into a dedicated data layer, then refit card detail rendering to consume that layer instead of ad hoc JS-only samples. After the detail page is data-driven, rewrite the 12 exploration scene texts around “pokedex investigation” missions while preserving the current event structure and species-card reward pipeline.

**Tech Stack:** Vanilla JS, JSON data files, static Markdown docs, local Python smoke tests, local browser validation

---

### Task 1: Lock the new text assets into the repo

**Files:**
- Verify: `docs/图鉴探索联动/*.md`
- Verify: `data/pokedex-lore-draft.json`
- Modify later if needed: `scripts/generate_pokedex_link_docs.mjs`

**Step 1: Run the generator**

Run: `node scripts/generate_pokedex_link_docs.mjs`

Expected: the docs folder and lore draft JSON refresh successfully.

**Step 2: Sanity-check generated pet coverage**

Run: `@'\nconst fs = require('fs');\nconst d = JSON.parse(fs.readFileSync('data/pokedex-lore-draft.json','utf8'));\nconsole.log(d.pets.length);\n'@ | node`

Expected: `198`

### Task 2: Add a failing regression for lore data loading

**Files:**
- Create: `prj/pokedex_lore_data_contract.test.py`
- Modify later: `js/card-collection.js`

**Step 1: Write the failing test**

Check that:

- `data/pokedex-lore-draft.json` exists
- card collection code references the lore data source or a planned production equivalent
- the sampled pets expose fields like `intro`, `story`, `sceneName`

**Step 2: Run the test to verify it fails**

Run: `python prj/pokedex_lore_data_contract.test.py`

Expected: FAIL before the runtime consumes the new data layer.

### Task 3: Refactor card detail to use the lore data layer

**Files:**
- Modify: `js/card-collection.js`
- Possibly create: `js/pokedex-lore.js` or inline loader helper
- Use: `data/pokedex-lore-draft.json` (or rename to final production file)

**Step 1: Load the lore JSON**

- Add a loader for the lore data
- Key by pet id and/or pet name
- Preserve the current sunflower sample behavior through the shared data layer

**Step 2: Replace fallback-only story assembly**

- Prefer loaded lore fields for:
  - codexTitle
  - subtitle
  - story
  - traits
  - skills
  - scene linkage
- Keep a minimal fallback only for pets missing data

**Step 3: Run the card regressions**

Run:
- `python prj/pet_pokedex_detail_layout.test.py`
- `python prj/pet_gallery_home_refresh.test.py`
- `python prj/pokedex_lore_data_contract.test.py`

Expected: PASS

### Task 4: Rewrite exploration story data around pokedex investigation

**Files:**
- Modify: `data/stories/forest.json`
- Modify: `data/stories/beach.json`
- Modify: `data/stories/candy.json`
- Modify: `data/stories/waterfall.json`
- Modify: `data/stories/desert.json`
- Modify: `data/stories/underwater.json`
- Modify: `data/stories/mountain.json`
- Modify: `data/stories/cave.json`
- Modify: `data/stories/castle.json`
- Modify: `data/stories/volcano.json`
- Modify: `data/stories/space.json`
- Modify: `data/stories/stargarden.json`

**Step 1: Write a failing text regression**

Create a test that asserts:

- story files mention the investigation / pokedex framing
- each scene has a consistent mission-like opening and a registration-style ending

**Step 2: Replace scene copy with the approved drafts**

- Preserve event ids
- Preserve event types
- Replace only formal scene text and top-level ending text

**Step 3: Re-run the story regression**

Expected: PASS

### Task 5: Improve in-app reward feedback after card acquisition

**Files:**
- Modify: `js/app.js`
- Possibly modify: `js/exploration-detail.js`

**Step 1: Add a lightweight “登记完成 / 图鉴补完” message path**

- When a species card is awarded, make the user-facing text sound like a completed pokedex registration rather than a generic drop

**Step 2: Verify no reward chain regression**

Manual checks:
- high-danger scene species win still adds the card
- text feedback now matches the pokedex investigation theme

### Task 6: Manual browser validation

**Files:**
- Verify runtime behavior in the local app

**Step 1: Start the local server**

Run: `python -m http.server 8765 --bind 127.0.0.1`

**Step 2: Validate card detail**

- Open `宠物 -> 卡片图鉴`
- Check several pets across multiple galleries
- Confirm detail copy feels like a real dossier

**Step 3: Validate exploration**

- Open multiple scenes
- Confirm the opening text now reads like a mission from the gallery
- Win at least one species battle and confirm reward copy matches the new framing

### Task 7: Final regression sweep

**Files:**
- Verify all touched runtime files and tests

**Step 1: Run targeted tests**

Run:
- `python prj/pet_pokedex_detail_layout.test.py`
- `python prj/pet_gallery_home_refresh.test.py`
- `python prj/pokedex_lore_data_contract.test.py`
- any new exploration story regression

**Step 2: Search for stale placeholder language**

Run:
`rg -n "当前使用通用图鉴介绍模板|随便编|待补完|掉落:" js data docs -S`

Expected: no stale user-facing fallback copy remains in the newly upgraded flows.
