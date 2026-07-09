# Battle Impact Upgrade Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Strengthen math PK, pet card PK, and exploration battle hit presentation so attacks feel like close-range contact with a clear impact and defender reaction.

**Architecture:** Reuse the existing CSS-class-driven battle motion systems in `js/math-pk.js`, `js/card-arena-ui.js`, and `js/app.js`. Add a small set of new semantic motion markers for stage flash, impact shockwave, and stronger target slam, then tune the existing keyframes and DOM effect nodes to use them.

**Tech Stack:** Vanilla JS, inline CSS in `js/math-pk.js`, shared CSS in `css/arena.css` and `css/style.css`, Node contract tests, Playwright screenshots.

---

### Task 1: Lock the new motion contract

**Files:**
- Modify: `prj/math_pk_fx_contract.test.mjs`
- Modify: `prj/pk_brawl_battle_motion_contract.test.mjs`

**Step 1: Write the failing test**

Add assertions for new motion markers:
- math PK: `math-pk-impact-shockwave`, `math-pk-target-slam`, `math-pk-stage-impact-focus`
- card arena: `arena-impact-shockwave`, `arena-target-slam`, `arena-stage-impact-focus`
- exploration: `battle-motion-impact-shockwave`, `battle-motion-slam`, `battle-motion-stage-impact-focus`

**Step 2: Run test to verify it fails**

Run: `node prj/math_pk_fx_contract.test.mjs && node prj/pk_brawl_battle_motion_contract.test.mjs`

Expected: FAIL because the new markers do not exist yet.

**Step 3: Write minimal implementation**

No implementation in this task.

**Step 4: Run test to verify it still fails for the expected reason**

Run the same command and confirm the missing-marker failure is explicit.

**Step 5: Commit**

```bash
git add prj/math_pk_fx_contract.test.mjs prj/pk_brawl_battle_motion_contract.test.mjs
git commit -m "test: lock stronger battle impact markers"
```

### Task 2: Strengthen math PK hit presentation

**Files:**
- Modify: `js/math-pk.js`
- Test: `prj/math_pk_fx_contract.test.mjs`

**Step 1: Write the failing test**

Use the failing contract from Task 1 as the red test.

**Step 2: Run test to verify it fails**

Run: `node prj/math_pk_fx_contract.test.mjs`

Expected: FAIL for the missing math PK markers.

**Step 3: Write minimal implementation**

Add:
- stronger rush keyframes with more forward travel
- stage focus flash class on `.arena-stage`
- target slam class and keyframes on defender avatar
- impact shockwave node/class on defender side

**Step 4: Run test to verify it passes**

Run: `node prj/math_pk_fx_contract.test.mjs`

Expected: PASS

**Step 5: Commit**

```bash
git add js/math-pk.js prj/math_pk_fx_contract.test.mjs
git commit -m "feat: strengthen math pk impact motion"
```

### Task 3: Strengthen pet card and exploration battles

**Files:**
- Modify: `js/card-arena-ui.js`
- Modify: `css/arena.css`
- Modify: `js/app.js`
- Modify: `css/style.css`
- Test: `prj/pk_brawl_battle_motion_contract.test.mjs`

**Step 1: Write the failing test**

Use the failing contract from Task 1 as the red test.

**Step 2: Run test to verify it fails**

Run: `node prj/pk_brawl_battle_motion_contract.test.mjs`

Expected: FAIL for the missing card arena / exploration markers.

**Step 3: Write minimal implementation**

Add:
- stronger lunge / approach keyframes
- stage impact focus pulse on arena and battle modal
- defender slam / squash feedback
- impact shockwave overlays tied to the defender side

**Step 4: Run test to verify it passes**

Run: `node prj/pk_brawl_battle_motion_contract.test.mjs`

Expected: PASS

**Step 5: Commit**

```bash
git add js/card-arena-ui.js css/arena.css js/app.js css/style.css prj/pk_brawl_battle_motion_contract.test.mjs
git commit -m "feat: strengthen shared battle impact motion"
```

### Task 4: Verify the experience in browser

**Files:**
- Modify: `CHANGELOG.md`

**Step 1: Write the failing test**

No new automated test. Verification is visual.

**Step 2: Run test to verify it fails**

No red test for this step.

**Step 3: Write minimal implementation**

Update changelog with the battle-impact upgrade note.

**Step 4: Run verification**

Run:
- `node prj/math_pk_fx_contract.test.mjs`
- `node prj/pk_brawl_battle_motion_contract.test.mjs`
- Playwright screenshot capture of math PK battle before/after hit

Expected:
- both contract tests pass
- screenshot shows attacker closer to target and stronger defender impact light

**Step 5: Commit**

```bash
git add CHANGELOG.md docs/plans/2026-07-09-battle-impact-upgrade.md
git commit -m "docs: record battle impact upgrade"
```
