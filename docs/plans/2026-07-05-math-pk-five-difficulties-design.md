# Math PK Five Difficulties Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expand math PK from 3 difficulties to 5 learning steps, with the first two tiers limited to addition and subtraction only.

**Architecture:** Keep the existing `js/math-pk.js` arena flow, but replace the hard-coded three-tier difficulty logic with five explicit difficulty ids and per-tier generation rules. Persist backward compatibility by migrating old saved values (`easy` / `medium` / `hard`) into the new ids when loading settings or async question sets.

**Tech Stack:** Vanilla JS, localStorage, standalone Node test script, static HTML app

---

### Task 1: Lock the new difficulty contract with a failing test

**Files:**
- Create: `prj/math_pk_difficulty_levels.test.mjs`
- Modify: `js/math-pk.js`

**Step 1: Write the failing test**

- Evaluate `js/math-pk.js` in a minimal sandbox.
- Assert `easy20` only generates `+` / `-` questions.
- Assert `easy100` only generates `+` / `-` questions.
- Assert async summaries expose the new difficulty labels.

**Step 2: Run test to verify it fails**

Run: `node prj/math_pk_difficulty_levels.test.mjs`

Expected: FAIL because `easy20` / `easy100` are not recognized by the current generator and summary labels still assume 3 difficulties.

### Task 2: Implement the five-tier difficulty rules

**Files:**
- Modify: `js/math-pk.js`

**Step 1: Add the new ids and labels**

- `easy20`
- `easy100`
- `medium_mul`
- `medium_mix`
- `hard`

**Step 2: Add generation rules**

- `easy20`: 20 以内加减
- `easy100`: 100 以内加减
- `medium_mul`: 乘法入门
- `medium_mix`: 100 以内加减 + 乘法 + 部分应用题
- `hard`: 乘除

**Step 3: Keep backward compatibility**

- Old `easy` → `easy20`
- Old `medium` → `medium_mix`
- Old `hard` → `hard`

### Task 3: Update the settings UI and async metadata

**Files:**
- Modify: `js/math-pk.js`

**Step 1: Update the settings cards**

- Show five difficulty buttons.
- Adjust grid layout so mobile still reads cleanly.

**Step 2: Update async summary metadata**

- `describeAsyncQuestionSet()` must return the new human-readable labels.

### Task 4: Verify the full behavior

**Files:**
- Test: `prj/math_pk_difficulty_levels.test.mjs`
- Test: `prj/test_async_pk_results_contract.py`

**Step 1: Run focused tests**

Run:
- `node prj/math_pk_difficulty_levels.test.mjs`
- `python -m pytest prj/test_async_pk_results_contract.py -q`
- `node --check js/math-pk.js`

**Step 2: Spot-check generated questions**

- Sample `easy20` output should never include `×` or `÷`.
- Sample `easy100` output should never include `×` or `÷`.
- Sample `medium_mul` / `hard` output should still include multiplication or division paths.
