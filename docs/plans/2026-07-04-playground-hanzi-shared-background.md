# Playground Hanzi Shared Background Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the playground page, hanzi page, and leaderboard page reuse the home background so all learning/play pages stay in the same visual language.

**Architecture:** Reuse the existing `assets/home-bg.webp` background that already powers `body.map-page-bg`, then align `#page-playground`, `#page-hanzi`, and `#page-leaderboard` to the same transparent-page plus fixed pseudo-background pattern. Guard the behavior with a CSS regression test so page-specific background art cannot creep back in unnoticed.

**Tech Stack:** HTML, CSS, Python regression scripts, local markdown docs

---

### Task 1: Add the failing CSS regression

**Files:**
- Create: `prj/shared_home_background_css.test.py`

**Step 1: Write the failing test**

Check that:

- `#page-playground` background is transparent
- `#page-playground::before` uses `../assets/home-bg.webp`
- `#page-hanzi` background is transparent
- `#page-hanzi::before` uses `../assets/home-bg.webp`
- `.hz-overlay` uses `../assets/home-bg.webp`
- `#page-leaderboard` background is transparent
- `#page-leaderboard::before` uses `../assets/home-bg.webp`
- none of those rules still reference `pg-bg.webp` / `hanzi-new-bg.webp` / `leaderboard-bg.png`

**Step 2: Run test to verify it fails**

Run: `python prj/shared_home_background_css.test.py`

Expected: FAIL because the current CSS still points to page-specific background assets.

### Task 2: Align playground background to the shared home background

**Files:**
- Modify: `css/playground.css`

**Step 1: Update the page container**

- Keep `background: transparent !important`
- Keep `isolation: isolate`
- Remove dependency on `pg-bg.webp`

**Step 2: Update the fixed background layer**

- Point `#page-playground::before` at `../assets/home-bg.webp`
- Keep the layer non-interactive
- Keep layering stable for the page content

**Step 3: Re-run the test**

Run: `python prj/shared_home_background_css.test.py`

Expected: still FAIL until hanzi CSS and leaderboard CSS are updated too.

### Task 3: Align hanzi background to the shared home background

**Files:**
- Modify: `css/hanzi-game.css`

**Step 1: Update the page container**

- Change the page background from the current green fallback to transparent
- Add `isolation: isolate`

**Step 2: Update the fixed background layer**

- Replace `hanzi-new-bg.webp` with `../assets/home-bg.webp`
- Remove the green fallback image stack
- Make the pseudo-layer match the playground layering model

**Step 3: Re-run the test**

Run: `python prj/shared_home_background_css.test.py`

Expected: still FAIL until leaderboard CSS is updated too.

### Task 4: Align leaderboard background to the shared home background

**Files:**
- Modify: `css/leaderboard.css`

**Step 1: Update the page container**

- Change the page background from the current fallback color to transparent
- Add `isolation: isolate`

**Step 2: Update the fixed background layer**

- Replace `leaderboard-bg.png` with `../assets/home-bg.webp`
- Keep the background layer non-interactive
- Ensure tabs, decorations, and leaderboard content render above the background layer

**Step 3: Re-run the test**

Run: `python prj/shared_home_background_css.test.py`

Expected: PASS

### Task 5: Bump any page-level asset versions that need cache refresh

**Files:**
- Modify: `index.html` if a cache-busting tweak is needed

**Step 1: Decide if browser cache could hide the CSS change**

- If existing stylesheet versioning is already enough, keep it
- If needed, bump the relevant stylesheet query string

**Step 2: Verify the home-background references in HTML/CSS**

Run: `rg -n "home-bg.webp|pg-bg.webp|hanzi-new-bg.webp|leaderboard-bg.(png|webp)" css index.html`

Expected: the page background selectors point to `home-bg.webp`, while old page-specific backgrounds are no longer used for full-page background rules.

### Task 6: Verify and document

**Files:**
- Modify: `docs/plans/2026-07-04-playground-hanzi-shared-background-design.md` only if implementation deviates

**Step 1: Run the targeted regression**

Run: `python prj/shared_home_background_css.test.py`

Expected: PASS

**Step 2: Run a quick search audit**

Run: `rg -n "#page-playground|#page-hanzi|#page-leaderboard|home-bg.webp|pg-bg.webp|hanzi-new-bg.webp|leaderboard-bg.(png|webp)" css index.html`

Expected: shared background usage is clear and old full-page background references are gone from those selectors.

**Step 3: Commit**

Only if the human partner asks for a commit.

---

Plan complete and saved to `docs/plans/2026-07-04-playground-hanzi-shared-background.md`.

Two execution options:

1. Subagent-Driven (this session) - I dispatch fresh subagent per task, review between tasks, fast iteration
2. Parallel Session (separate) - Open new session with executing-plans, batch execution with checkpoints

This run will continue in the current session and implement directly because the scope is small and already approved.
