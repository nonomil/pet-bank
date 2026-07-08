# PK Brawl Battle Motion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade Math PK, card arena, and exploration encounters to use approach/contact/impact/recoil/return battle motion with visible hit feedback on the defender.

**Architecture:** Reuse the current `BattleFx`, `MathPKGame`, and `CardArenaUI` event structure instead of introducing a new engine. Lock the new motion contract with tests first, then implement exploration motion hooks, Math PK rush-impact-return motion, and finally the richer card arena motion variants.

**Tech Stack:** Vanilla JavaScript, existing CSS effect layers, current audio hooks, Node contract tests, full local simulation regression runner.

---

## Task Status

- [ ] Task 1: Lock the new battle motion contract with failing tests
- [ ] Task 2: Extend exploration battle motion with approach/impact/recoil
- [ ] Task 3: Upgrade Math PK to true rush-contact-impact-return motion
- [ ] Task 4: Upgrade card arena with heavier motion variants
- [ ] Task 5: Add reduced-motion and CSS cleanup
- [ ] Task 6: Run focused contracts and full regression
- [ ] Task 7: Update docs and changelog, then commit

## Task 1: Lock The New Battle Motion Contract With Failing Tests

**Files:**
- Modify: `prj/pk_brawl_shared_experience_contract.test.mjs`
- Create: `prj/pk_brawl_battle_motion_contract.test.mjs`
- Read: `js/math-pk.js`
- Read: `js/card-arena-ui.js`
- Read: `js/app.js`
- Read: `js/battle-fx.js`

**Step 1: Add explicit motion markers**

Write a new static contract that requires:

- exploration battle source includes markers like:
  - `battle-motion-approach`
  - `battle-motion-impact`
  - `battle-motion-recoil`
- math PK source includes markers like:
  - `math-pk-rush-active`
  - `math-pk-impact-burst`
  - `math-pk-target-recoil`
- card arena source includes markers like:
  - `arena-battle-lunge`
  - `arena-impact-burst`
  - `arena-target-recoil`

**Step 2: Require defender-side hit feedback**

Add assertions that all three modes contain explicit target-hit / recoil markers instead of only attacker-side FX.

**Step 3: Run the new contract and confirm it fails**

Run:

```bash
node prj/pk_brawl_battle_motion_contract.test.mjs
```

Expected: FAIL before implementation.

## Task 2: Extend Exploration Battle Motion With Approach / Impact / Recoil

**Files:**
- Modify: `js/battle-fx.js`
- Modify: `js/app.js`
- Modify: `css/style.css`
- Test: `prj/battle_fx_contract.test.mjs`
- Test: `prj/audio_battle_feedback_contract.test.mjs`
- Test: `prj/pk_brawl_battle_motion_contract.test.mjs`

**Step 1: Add motion metadata to BattleFx specs**

Extend event specs so attack events know:

- who is the attacker
- who is the defender
- which motion style to use
- whether defender recoil is needed

**Step 2: Add role-aware DOM hooks in battle modal**

Use existing battle modal character containers to toggle:

- attacker approach class
- defender hit/recoil class
- center impact burst class

**Step 3: Keep overlay FX and add contact timing**

Do not remove current overlay FX.
Instead:

- attacker moves first
- impact overlay appears slightly after movement begins
- defender recoil fires at impact time

**Step 4: Keep story readability intact**

Do not let motion cover:

- HP bars
- action buttons
- result buttons

**Step 5: Run focused tests**

```bash
node prj/battle_fx_contract.test.mjs
node prj/audio_battle_feedback_contract.test.mjs
node prj/pk_brawl_battle_motion_contract.test.mjs
node --check js/battle-fx.js
node --check js/app.js
```

Expected: PASS.

## Task 3: Upgrade Math PK To True Rush / Contact / Impact / Return Motion

**Files:**
- Modify: `js/math-pk.js`
- Test: `prj/math_pk_fx_contract.test.mjs`
- Test: `prj/pk_brawl_battle_motion_contract.test.mjs`
- Reuse: `prj/math_pk_multiplication_onboarding.test.mjs`
- Reuse: `prj/math_pk_difficulty_levels.test.mjs`

**Step 1: Keep the existing attack style picker**

Reuse current style variants like dash / hop / spin, but make each one:

- move the attacker forward
- trigger impact on the defender
- return the attacker after contact

**Step 2: Add defender-side recoil**

Robot and pet targets should each get:

- hit flash
- recoil transform
- optional HP pulse / brief stun pop

**Step 3: Match the reference feel**

For Math PK specifically:

- use a bright yellow/white impact burst
- place it near the defender body center
- keep total duration short

**Step 4: Ensure both sides can attack**

Human answer success and robot抢答 success must both use:

- forward lunge
- target impact
- return to original stage position

**Step 5: Run focused tests**

```bash
node prj/math_pk_fx_contract.test.mjs
node prj/pk_brawl_battle_motion_contract.test.mjs
node prj/math_pk_multiplication_onboarding.test.mjs
node prj/math_pk_difficulty_levels.test.mjs
node --check js/math-pk.js
```

Expected: PASS.

## Task 4: Upgrade Card Arena With Heavier Motion Variants

**Files:**
- Modify: `js/card-arena-ui.js`
- Modify: `css/arena.css`
- Test: `prj/pk_brawl_shared_experience_contract.test.mjs`
- Test: `prj/pk_brawl_battle_motion_contract.test.mjs`
- Reuse: `prj/audio_battle_feedback_contract.test.mjs`

**Step 1: Map action types to motion styles**

At minimum:

- basic attack -> short lunge
- skill / power strike -> heavier forward strike
- ultimate -> longer lunge or spin burst
- defend / heal -> no lunge, but defender-side pulse or shield

**Step 2: Add actor / target class choreography**

During resolved actions:

- acting side gets `arena-battle-lunge-*`
- target side gets `arena-target-recoil-*`
- impact burst appears near target frame

**Step 3: Make card arena the richest mode**

Allow this mode to add:

- stronger trail
- slightly larger burst
- stronger HP shake

without changing battle resolution logic.

**Step 4: Run focused tests**

```bash
node prj/pk_brawl_shared_experience_contract.test.mjs
node prj/pk_brawl_battle_motion_contract.test.mjs
node prj/audio_battle_feedback_contract.test.mjs
node --check js/card-arena-ui.js
```

Expected: PASS.

## Task 5: Add Reduced-Motion And CSS Cleanup

**Files:**
- Modify: `css/style.css`
- Modify: `css/arena.css`
- Modify: `js/math-pk.js` inline CSS block if needed

**Step 1: Add reduced-motion fallbacks**

For all three modes:

- reduce travel distance
- remove rotation
- shorten flash duration

**Step 2: Prevent layout drift**

Ensure all motion classes use:

- `transform`
- `opacity`

instead of layout-affecting position changes where possible.

**Step 3: Run CSS-related contracts**

```bash
node prj/battle_fx_contract.test.mjs
node prj/math_pk_fx_contract.test.mjs
node prj/pk_brawl_battle_motion_contract.test.mjs
```

Expected: PASS.

## Task 6: Run Focused Contracts And Full Regression

**Files:**
- Read: `scripts/run-full-regression.mjs`

**Step 1: Run focused battle tests**

```bash
node prj/pk_brawl_battle_motion_contract.test.mjs
node prj/pk_brawl_shared_experience_contract.test.mjs
node prj/math_pk_fx_contract.test.mjs
node prj/battle_fx_contract.test.mjs
node prj/audio_battle_feedback_contract.test.mjs
```

**Step 2: Run simulation regression**

```bash
node scripts/run-full-regression.mjs
```

Expected: `All ... regression tasks passed.`

## Task 7: Update Docs And Changelog, Then Commit

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `docs/plans/README.md`
- Modify: `docs/plans/2026-07-08-pk-brawl-battle-motion-design.md`
- Modify: `docs/plans/2026-07-08-pk-brawl-battle-motion-implementation.md`

**Step 1: Update indexes**

Add both new plan docs to `docs/plans/README.md`.

**Step 2: Update changelog**

Add a version entry describing:

- shared rush-contact-impact-return battle motion
- Math PK reference-style hit feedback
- richer card arena attack motion
- exploration defender-side hit response

**Step 3: Final hygiene**

```bash
git diff --check
```

**Step 4: Commit**

```bash
git add CHANGELOG.md docs/plans/README.md docs/plans/2026-07-08-pk-brawl-battle-motion-design.md docs/plans/2026-07-08-pk-brawl-battle-motion-implementation.md js/battle-fx.js js/app.js css/style.css js/math-pk.js js/card-arena-ui.js css/arena.css prj/pk_brawl_battle_motion_contract.test.mjs prj/pk_brawl_shared_experience_contract.test.mjs prj/math_pk_fx_contract.test.mjs prj/battle_fx_contract.test.mjs prj/audio_battle_feedback_contract.test.mjs
git commit -m "feat: upgrade shared pk battle motion"
```
