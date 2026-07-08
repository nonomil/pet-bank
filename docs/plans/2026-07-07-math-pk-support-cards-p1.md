# Math PK Support Cards P1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a first playable layer of support-card choice and post-match star rewards to Math PK, starting with low-risk learning-support cards that fit the current multiplication onboarding and formal PK flow.

**Architecture:** Keep the existing `MathPKGame` full-screen arena and current `training` / `robot` / `async` modes. Add one lightweight pre-match card-selection step, one active support-card record in local state, small per-round behavior hooks, and a simple local-only star progression track. Do not introduce deck building, rarity rolls, cloud sync, or heavy battle stats in P1.

**Tech Stack:** Vanilla JavaScript in `js/math-pk.js`, current inline arena CSS, `localStorage`, Node `vm` contract tests under `prj/*.test.mjs`.

---

## Task Status

- [ ] Task 1: Lock support-card contract with a failing test
- [ ] Task 2: Add support-card catalog and local progression state
- [ ] Task 3: Add pre-match three-card selection UI
- [ ] Task 4: Apply P1 support-card effects in practice and PK
- [ ] Task 5: Add post-match star summary and local reward track
- [ ] Task 6: Add regression and UX contract coverage
- [ ] Task 7: Manual browser verification
- [ ] Task 8: Final verification and docs update

## Scope

P1 only includes:

- `3 选 1` support-card choice before entering a match
- Three P1 cards:
  - `看阵列`
  - `慢一点`
  - `再试一次`
- `medium_mul` and `medium_mix` only
- Simple `3 星制` end-of-match summary
- Local star progress and simple reward-node messaging

P1 explicitly excludes:

- Deck management
- Card upgrade
- Rarity / gacha / chest randomness
- Boss fights
- Cloud sync
- Aggressive combat cards like stun, skip-turn, or double damage

---

## Task 1: Lock Support-Card Contract With a Failing Test

**Files:**

- Create: `prj/math_pk_support_cards_contract.test.mjs`
- Read: `js/math-pk.js`
- Read: `prj/math_pk_difficulty_levels.test.mjs`

**Step 1: Write the failing contract test**

Create a new Node `vm` test that asserts:

- `MathPKGame` exposes a support-card catalog or equivalent getter
- `medium_mul` and `medium_mix` expose a pre-match support-card choice
- The first P1 card ids exist:
  - `show_array`
  - `slow_robot`
  - `retry_once`
- The game exposes a way to estimate or report post-match stars

Suggested assertions:

```js
assert.ok(source.includes('MATH_PK_SUPPORT_CARDS'), 'Math PK should define a support-card catalog');
assert.ok(source.includes('show_array'), 'Math PK should include the show_array support card');
assert.ok(source.includes('slow_robot'), 'Math PK should include the slow_robot support card');
assert.ok(source.includes('retry_once'), 'Math PK should include the retry_once support card');
assert.ok(source.includes('math-pk-support-chooser'), 'Math PK should render a support-card chooser');
assert.ok(source.includes('estimateRewardStars'), 'Math PK should expose reward star estimation');
```

**Step 2: Run the test and confirm it fails**

```bash
node prj/math_pk_support_cards_contract.test.mjs
```

Expected: FAIL because the catalog and chooser do not exist yet.

---

## Task 2: Add Support-Card Catalog and Local Progression State

**Files:**

- Modify: `js/math-pk.js`

**Step 1: Add local-storage keys**

In `CONFIG`, add:

```js
STORAGE_KEY_SUPPORT_PROGRESS: 'petbank_math_support_progress',
STORAGE_KEY_SUPPORT_UNLOCKS: 'petbank_math_support_unlocks'
```

**Step 2: Add support-card catalog**

Near difficulty config, add:

```js
const MATH_PK_SUPPORT_CARDS = {
    show_array: {
        id: 'show_array',
        name: '看阵列',
        stages: ['medium_mul'],
        type: 'learning_support',
        timing: 'question_render',
        description: '乘法题自动显示分组图',
        tag: '适合看图'
    },
    slow_robot: {
        id: 'slow_robot',
        name: '慢一点',
        stages: ['medium_mul', 'medium_mix'],
        type: 'learning_support',
        timing: 'robot_think',
        description: '本局机器人每题多思考 2 秒',
        tag: '适合慢慢想',
        effect: { robotThinkMsBonus: 2000 }
    },
    retry_once: {
        id: 'retry_once',
        name: '再试一次',
        stages: ['medium_mul', 'medium_mix'],
        type: 'learning_support',
        timing: 'first_wrong_answer',
        description: '本局第一次答错不丢出手机会',
        tag: '适合练信心'
    }
};
```

**Step 3: Add match-level support state**

In `state`, add:

```js
support: {
    selectedCardId: null,
    offeredCardIds: [],
    retryUsed: false,
    starsEarned: 0
}
```

**Step 4: Add local progression helpers**

Add helpers for:

- reading unlocked card ids from localStorage
- reading stage star progress from localStorage
- writing updates back

P1 defaults:

- unlocked at start: `show_array`, `slow_robot`, `retry_once`
- progress per stage defaults to `0`

**Step 5: Expose a small read API**

Expose on `window.MathPKGame`:

```js
getSupportCards: () => MATH_PK_SUPPORT_CARDS,
getUnlockedSupportCardIds: () => getUnlockedSupportCardIds(),
estimateRewardStars: (summary) => Game._estimateRewardStars(summary)
```

**Step 6: Run syntax check**

```bash
node --check js/math-pk.js
```

Expected: PASS.

---

## Task 3: Add Pre-Match Three-Card Selection UI

**Files:**

- Modify: `js/math-pk.js`
- Test: `prj/math_pk_support_cards_contract.test.mjs`

**Step 1: Offer 3 cards at match entry**

Add a helper:

```js
_buildSupportOffer(diff)
```

Rules:

- `easy20` / `easy100`: no support-card chooser in P1
- `medium_mul`: choose from cards valid for `medium_mul`
- `medium_mix`: choose from cards valid for `medium_mix`
- `hard`: keep disabled in P1

If only 2 cards qualify for a stage, repeat one only as a last resort is not allowed; instead show 2 cards cleanly. Prefer exact available count over fake variety.

**Step 2: Add chooser renderer**

Add a new render method:

```js
supportChooser(diff)
```

UI requirements:

- class marker: `.math-pk-support-chooser`
- 2-3 large, tappable cards
- each card shows:
  - card name
  - one-line description
  - short tag like `适合慢慢想`
- selecting a card sets `state.support.selectedCardId` and starts the intended mode

Recommended flow:

- `medium_mul` lobby:
  - `开始练习` first opens chooser
  - card selected -> `startTraining()`
- `medium_mul` PK:
  - `开始对战` first opens chooser
  - card selected -> `start()`
- `medium_mix`:
  - `开始对战` first opens chooser

**Step 3: Keep the chooser lightweight**

Do not create a separate page.
Render inside `arena-center` as a modal-like lobby panel in the same arena.

**Step 4: Add public picker actions**

Expose:

```js
chooseSupportCardAndStart(cardId, nextMode)
```

Where `nextMode` is `training` or `robot`.

**Step 5: Run test**

```bash
node prj/math_pk_support_cards_contract.test.mjs
```

Expected: PASS or at least progress from previous failure.

---

## Task 4: Apply P1 Support-Card Effects in Practice and PK

**Files:**

- Modify: `js/math-pk.js`
- Reuse: `prj/math_pk_multiplication_onboarding.test.mjs`
- Reuse: `prj/math_pk_difficulty_levels.test.mjs`

**Step 1: `show_array`**

Behavior:

- In `medium_mul` formal PK, multiplication questions can render a compact array hint below the expression when `show_array` is active.
- In training, this card has no extra effect because arrays are already shown; instead show a small “本局支援：看阵列” badge.

Implementation:

- Detect if selected card is `show_array`
- When `render.match(question)` sees a multiplication question and the card is active, add a tiny `math-array math-array-compact`

**Step 2: `slow_robot`**

Behavior:

- Add `2000ms` to robot think time

Implementation:

- In `_estimateRobotThinkMs(question, diff)`, add bonus if selected card is `slow_robot`

**Step 3: `retry_once`**

Behavior:

- First wrong answer in a match does not consume the attack race
- It should be visible to the child when used up

Implementation:

- In robot PK answer flow, if first wrong answer occurs and card active and not used:
  - set `retryUsed = true`
  - clear input
  - show cue `再试一次已使用`
  - do not mark round lost or resolved

For training mode:

- since training already allows retry, this card should instead preserve streak on the first wrong answer only
- after first wrong answer with card:
  - keep current streak unchanged
  - show `这次不扣连对`
  - mark `retryUsed = true`

**Step 4: Show active-card status in UI**

Render a small badge:

- `本局支援：慢一点`
- `再试一次已使用`
- `本局支援：看阵列`

This can sit below the round pill or above the question area.

**Step 5: Run focused tests**

```bash
node prj/math_pk_multiplication_onboarding.test.mjs
node prj/math_pk_difficulty_levels.test.mjs
node --check js/math-pk.js
```

Expected: PASS.

---

## Task 5: Add Post-Match Star Summary and Local Reward Track

**Files:**

- Modify: `js/math-pk.js`
- Test: `prj/math_pk_support_cards_contract.test.mjs`

**Step 1: Add star evaluation**

Add:

```js
_estimateRewardStars(summary)
```

P1 rules:

- `medium_mul`
  - 1 star: completed the session
  - 1 star: `correctCount >= 3` or `training.totalCorrect >= 3`
  - 1 star: at least one multiplication item answered correctly
- `medium_mix`
  - 1 star: won match
  - 1 star: correct rate >= 70%
  - 1 star: max combo >= 2

For stages outside P1:

- return `0`

**Step 2: Persist progress**

On result:

- add stars to `mathPkStarProgress[diff]`
- do not overcomplicate reward claiming yet

Reward-node messaging:

- if progress crosses `3`, show `解锁新支援卡`
- if progress crosses `6`, show `解锁宠物入场动作`
- otherwise show `再拿 1 颗星，就能更进一步` style text

**Step 3: Extend result UI**

Add summary block:

```text
本局获得 ★★☆
累计星轨：4 / 12
解锁：新支援卡「拆一拆」
```

Keep it concise and child-readable.

**Step 4: Keep rewards local-only**

Do not change async PK cloud payloads in P1.

---

## Task 6: Add Regression and UX Contract Coverage

**Files:**

- Modify or create:
  - `prj/math_pk_support_cards_contract.test.mjs`
  - optionally `prj/math_pk_reward_track_contract.test.mjs`

**Assertions to cover:**

- P1 card ids exist
- chooser marker exists
- star-estimation API exists
- `slow_robot` increases estimated think time
- `retry_once` marker exists in source
- reward strings exist:
  - `本局获得`
  - `累计星轨`
  - `解锁`

**Validation:**

```bash
node prj/math_pk_support_cards_contract.test.mjs
node prj/math_pk_fx_contract.test.mjs
node prj/math_pk_difficulty_levels.test.mjs
```

Expected: PASS.

---

## Task 7: Manual Browser Verification

**Files:**

- Verify: `js/math-pk.js`
- Verify: local app at `http://127.0.0.1:8765/` or current local server

**Checklist:**

1. Enter `乘法启程`
2. Tap `开始练习`
3. Confirm `3 选 1` support-card chooser appears
4. Choose `慢一点`
5. Confirm practice starts and active-card badge appears
6. Enter formal PK
7. Choose `看阵列`
8. Confirm multiplication questions show compact array hint
9. Choose `再试一次`
10. Confirm first wrong answer gives visible second chance
11. Finish a session
12. Confirm star summary appears and cumulative track updates

---

## Task 8: Final Verification and Docs Update

**Files:**

- Modify: `CHANGELOG.md`
- Modify: `docs/数学PK游戏/README.md`
- Modify if needed: `docs/数学PK游戏/04-学习支援卡与奖励轨道方案.md`

**Run:**

```bash
node --check js/math-pk.js
node prj/math_pk_support_cards_contract.test.mjs
node prj/math_pk_multiplication_onboarding.test.mjs
node prj/math_pk_fx_contract.test.mjs
node prj/math_pk_difficulty_levels.test.mjs
git diff --check
```

**Commit suggestion:**

```bash
git add CHANGELOG.md docs/数学PK游戏/README.md docs/数学PK游戏/04-学习支援卡与奖励轨道方案.md docs/plans/2026-07-07-math-pk-support-cards-p1.md js/math-pk.js prj/math_pk_support_cards_contract.test.mjs
git commit -m "feat: add math pk support cards p1"
```

