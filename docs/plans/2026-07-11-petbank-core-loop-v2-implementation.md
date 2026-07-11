# PetBank Core Loop v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make reward outcomes visible and add reversible task events and lightweight return-loop history without changing the economy values.

**Architecture:** Extend the existing browser-side core reward service with a presentation model and a small DOM renderer. Add task-operation and growth-history modules with versioned localStorage keys. Existing page modules call these adapters and retain their current fallback messages when a module is unavailable.

**Tech Stack:** Vanilla JavaScript, browser `localStorage`, existing static pages, Node.js VM contract tests.

---

### Task 1: Define the v2 reward presentation model

**Files:**
- Modify: `js/core-reward-service.js`
- Create: `scripts/test-core-reward-presentation.mjs`

**Steps:**
1. Write a failing test for `toPresentation(result)` covering points, pet exp, intimacy, item, level-up, evolution, duplicate, and next-action text.
2. Run `node scripts/test-core-reward-presentation.mjs`; expect failure because the formatter is missing.
3. Implement a pure formatter returning serializable fields and no DOM dependency.
4. Run the test and expect PASS.
5. Commit `feat: add core reward presentation model`.

### Task 2: Render and expose the reward result card

**Files:**
- Create: `js/core-reward-feedback.js`
- Create: `scripts/test-core-reward-feedback.mjs`
- Modify: `js/runtime-loader.js` or `index.html` to load the module before page adapters

**Steps:**
1. Write a failing VM test for safe text rendering, duplicate state, and missing-container fallback.
2. Run the test and expect failure because `CoreRewardFeedback` is missing.
3. Implement `show(result, options)` and `render(container, model)` using `textContent`/DOM nodes rather than unescaped HTML.
4. Run the test and syntax checks.
5. Commit `feat: add unified reward feedback card`.

### Task 3: Connect current reward sources

**Files:**
- Modify: `js/treasure.js`
- Modify: `js/runtime-loader.js`
- Modify: `js/home.js`
- Modify: `js/app.js` only through a narrowly staged patch if necessary

**Steps:**
1. Add source-level assertions for chest, game, and home result calls.
2. Call `CoreRewardFeedback.show()` after accepted rewards/actions, preserving existing toast fallback.
3. Add one task completion hook without changing task point arithmetic.
4. Run all v1 tests plus the new feedback tests.
5. Commit `feat: show unified reward feedback across sources`.

### Task 4: Add reversible task operation events

**Files:**
- Create: `js/task-reward-events.js`
- Create: `scripts/test-task-reward-events.mjs`
- Modify: `js/app.js` task toggle path

**Steps:**
1. Write a failing test for complete, undo, complete-again, profile isolation, and date rollover.
2. Implement append-only operation records and a read API.
3. Route `toggleTask` through the recorder while keeping its existing point add/subtract behavior.
4. Run focused and daily-state tests.
5. Commit `feat: record reversible task reward events`.

### Task 5: Add growth history and return hints

**Files:**
- Create: `js/pet-growth-history.js`
- Create: `scripts/test-pet-growth-history.mjs`
- Modify: `js/core-reward-service.js`, `js/home.js`, and the child-home summary adapter

**Steps:**
1. Write a failing test for 30-entry retention, date rollover, and latest-event lookup.
2. Append accepted reward and care results to the history module.
3. Render latest growth and consecutive care days in the home summary.
4. Run focused tests and existing child journey tests.
5. Commit `feat: add pet growth history and return hints`.

### Task 6: Browser-adjacent verification and release notes

**Files:**
- Create: `docs/releases/2026-07-11-core-loop-v2.md`

**Steps:**
1. Run all v2 and v1 tests, static routes, Pages gate, repository boundaries, and syntax checks.
2. Start the existing local web entry only if a documented dev command is available; otherwise record the missing browser gate.
3. Inspect `git diff --cached --stat` and ensure vocabulary/prototype/generated files are not staged.
4. Write verification results and known gaps.
5. Commit `docs: record core loop v2 verification`.
