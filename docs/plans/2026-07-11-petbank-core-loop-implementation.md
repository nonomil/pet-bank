# PetBank Core Loop Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify reward delivery and connect points, pet growth, and pet-house care into a verifiable daily loop without changing existing reward amounts.

**Architecture:** Add a small browser-side reward event service loaded before the existing application modules. Existing `addGrowthPoints`, `PetSystem`, `GameRewardReceipts`, and `TreasureChest` remain the source of business operations; the service validates and deduplicates events, then returns a standard result. Add a separate daily-care state module consumed by `HomeSystem` so care progress is isolated from the pet state schema.

**Tech Stack:** Vanilla JavaScript, browser `localStorage`, existing static HTML/CSS, Node.js test scripts using VM stubs.

---

### Task 1: Add CP1 failing tests for reward events

**Files:**
- Create: `scripts/test-core-reward-policy.mjs`
- Reference: `js/app.js`, `js/pet.js`, `js/treasure.js`

**Step 1: Write the failing test**

Cover event shape validation, duplicate `eventId`, points preservation, pet-exp application, and storage reload.

**Step 2: Run it to verify it fails**

Run: `node scripts/test-core-reward-policy.mjs`
Expected: FAIL because `CoreRewardService` is not defined.

### Task 2: Implement the reward event service

**Files:**
- Create: `js/core-reward-service.js`
- Modify: `index.html` to load the service before `js/app.js`

**Step 1: Implement the minimal contract**

Expose `window.CoreRewardService.claim(event)` and `getHistory()`. Store receipts under a versioned key. Validate `eventId`, `source`, and non-negative reward amounts. Support `growth_points`, `pet_exp`, `intimacy`, and `item`.

**Step 2: Run the focused test**

Run: `node scripts/test-core-reward-policy.mjs`
Expected: PASS.

**Step 3: Commit CP1 service**

```bash
git add js/core-reward-service.js index.html scripts/test-core-reward-policy.mjs
git commit -m "feat: add core reward event policy"
```

### Task 3: Adapt existing reward sources

**Files:**
- Modify: `js/app.js` game reward handlers and task completion handler
- Modify: `js/treasure.js` `applyReward`
- Modify: `js/shop.js` blind-box reward path only if it currently grants pet experience

**Step 1: Add source-specific tests**

Extend `scripts/test-core-reward-policy.mjs` with task, game, and chest event IDs and assert the existing point amounts are unchanged.

**Step 2: Route through the service**

Use stable source IDs. Preserve existing UI and fallback behavior when the service is unavailable.

**Step 3: Run focused and static checks**

Run: `node scripts/test-core-reward-policy.mjs`
Run: `node scripts/verify_pages_static.mjs`
Expected: PASS.

**Step 4: Commit CP1 adapters**

```bash
git add js/app.js js/treasure.js js/shop.js scripts/test-core-reward-policy.mjs
git commit -m "feat: route task game and chest rewards through policy"
```

### Task 4: Add CP2 pet-growth result normalization

**Files:**
- Modify: `js/core-reward-service.js`
- Modify: `js/app.js` `PetSystem.addExp` wrapper and reward render helpers
- Create: `scripts/test-pet-growth-feedback.mjs`

**Step 1: Write the failing test**

Assert that a reward result includes `petExpApplied`, `newLevel`, `leveledUp`, and `evolutionChanged` when applicable.

**Step 2: Implement result snapshots**

Capture pet state before and after claim. Do not change EXP_TABLE or existing reward amounts.

**Step 3: Add explicit feedback data**

Expose a small render helper that can show level-up/evolution text without coupling the service to a DOM.

**Step 4: Run the focused test**

Run: `node scripts/test-pet-growth-feedback.mjs`
Expected: PASS.

**Step 5: Commit CP2**

```bash
git add js/core-reward-service.js js/app.js scripts/test-pet-growth-feedback.mjs
git commit -m "feat: expose pet growth feedback from rewards"
```

### Task 5: Add CP3 daily-care state

**Files:**
- Create: `js/pet-care-daily.js`
- Modify: `index.html` to load it before `js/home.js`
- Create: `scripts/test-pet-care-daily-state.mjs`

**Step 1: Write the failing test**

Cover date rollover, three goals, idempotent action completion, and recommendation selection from pet state.

**Step 2: Implement the state module**

Expose `getState()`, `recordAction(action)`, `getNextAction(petState)`, and `resetForDate(date)` using a versioned localStorage key.

**Step 3: Run the focused test**

Run: `node scripts/test-pet-care-daily-state.mjs`
Expected: PASS.

### Task 6: Integrate daily care into the pet house

**Files:**
- Modify: `js/home.js` action handlers and `renderUI`
- Modify: `css/style.css` only if the existing home styles cannot present the compact care panel

**Step 1: Record successful actions**

After `feed`, `play`, `bath`, and `rest` succeed, record the corresponding care action exactly once.

**Step 2: Render progress and recommendation**

Show `今日照料 x/3`, the remaining goal labels, and one recommended action based on the lowest relevant pet dimension.

**Step 3: Run focused and browser-adjacent checks**

Run: `node scripts/test-pet-care-daily-state.mjs`
Run: `node scripts/verify_pages_static.mjs`

**Step 4: Commit CP3**

```bash
git add js/pet-care-daily.js js/home.js index.html css/style.css scripts/test-pet-care-daily-state.mjs
git commit -m "feat: add daily pet care loop"
```

### Task 7: Full verification and version documentation

**Files:**
- Modify: `docs/plans/2026-07-11-petbank-core-loop-design.md` with final verification notes
- Create: `docs/releases/2026-07-11-core-loop-v1.md`

**Step 1: Run focused tests**

Run: `node scripts/test-core-reward-policy.mjs`
Run: `node scripts/test-pet-growth-feedback.mjs`
Run: `node scripts/test-pet-care-daily-state.mjs`

**Step 2: Run existing gates**

Run: `node scripts/verify_pages_static.mjs`
Run: `node scripts/verify_web_project.mjs` when present.

**Step 3: Inspect the diff boundary**

Run: `git diff --stat` and confirm no vocabulary, prototype, generated asset, or `.firecrawl` files are staged.

**Step 4: Commit docs**

```bash
git add docs/plans/2026-07-11-petbank-core-loop-design.md docs/releases/2026-07-11-core-loop-v1.md
git commit -m "docs: record core loop v1 verification"
```
