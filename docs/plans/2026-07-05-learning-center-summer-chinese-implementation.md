# Learning Center + Summer Chinese Pack Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a reusable learning-center module inside the existing `pet-bank` SPA, then ship the first internal pack: an "幼小衔接暑假中文资料包" with progress, reward, and print-friendly views.

**Architecture:** Keep the current single-page app and localStorage architecture. Add a new `learn` product area driven by `data/learn/catalog.json` + pack manifests/modules, then store learning progress and reward claims in new `petbank_learning_*` keys that automatically inherit multi-profile isolation through the existing `ProfileManager` swap model.

**Tech Stack:** Static HTML, Vanilla JS IIFE modules, CSS, JSON data files, localStorage, existing `switchPage()` routing, existing `addGrowthPoints()` entry, Playwright smoke validation via `node scripts/*.mjs`.

---

### Task 1: Scaffold the learning-center data contract

**Files:**
- Create: `data/learn/catalog.json`
- Create: `data/learn/packs/summer-chinese-bridge-2026/manifest.json`
- Create: `data/learn/packs/summer-chinese-bridge-2026/plan.json`
- Create: `data/learn/packs/summer-chinese-bridge-2026/modules/morning-reading.json`
- Create: `data/learn/packs/summer-chinese-bridge-2026/modules/literacy-45days.json`
- Create: `data/learn/packs/summer-chinese-bridge-2026/modules/weekly-review.json`
- Create: `data/learn/packs/summer-chinese-bridge-2026/modules/poems.json`
- Create: `data/learn/packs/summer-chinese-bridge-2026/modules/classics.json`
- Test: `data/learn/**/*.json`

**Step 1: Write the failing data smoke check**

Add a failing pack-contract assertion to a new smoke script:

```javascript
check('catalog exposes at least one learning pack', Array.isArray(catalog.packs) && catalog.packs.length > 0);
check('summer pack manifest id matches catalog entry', manifest.id === 'summer-chinese-bridge-2026');
```

**Step 2: Run it to verify it fails**

Run:

```bash
python -m http.server 8000
node scripts/learning-center-smoke.mjs
```

Expected: FAIL because `data/learn/catalog.json` and pack files do not exist yet.

**Step 3: Write the minimal data files**

Create the JSON contract first:

- `catalog.json` lists the summer pack
- `manifest.json` declares title, audience, modules, reward rules
- `plan.json` defines week/day rhythm
- each `modules/*.json` contains `lessons[]`

**Step 4: Run the smoke check again**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: pack-contract checks PASS.

---

### Task 2: Add the new `学习` top-level route and page shells

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Create: `css/learn-center.css`
- Test: browser UI, `scripts/learning-center-smoke.mjs`

**Step 1: Write the failing UI assertions**

Add smoke checks:

```javascript
check('top nav contains 学习 tab', !!document.querySelector('.nav-tab[data-page="learn"]'));
check('page-learn exists', !!document.getElementById('page-learn'));
check('page-learn-pack exists', !!document.getElementById('page-learn-pack'));
check('page-learn-plan exists', !!document.getElementById('page-learn-plan'));
check('page-learn-lesson exists', !!document.getElementById('page-learn-lesson'));
check('page-learn-print exists', !!document.getElementById('page-learn-print'));
```

**Step 2: Run the smoke check to verify it fails**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: FAIL because the new nav tab and page containers do not exist yet.

**Step 3: Implement the route shell**

- add `📚 学习` to the top nav in `index.html`
- add 5 page containers:
  - `page-learn`
  - `page-learn-pack`
  - `page-learn-plan`
  - `page-learn-lesson`
  - `page-learn-print`
- extend `PAGE_TO_TAB` in `js/app.js`
- extend `switchPage()` with render hooks for `LearnCenter`
- include `css/learn-center.css` and `js/learn-center.js`

**Step 4: Run the smoke check again**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: route-shell checks PASS.

---

### Task 3: Implement the `LearnCenter` runtime module

**Files:**
- Create: `js/learn-center.js`
- Modify: `index.html`
- Modify: `js/app.js`
- Test: `scripts/learning-center-smoke.mjs`

**Step 1: Write the failing module assertions**

Add smoke checks:

```javascript
check('LearnCenter global exists', !!window.LearnCenter);
check('LearnCenter.renderHub exists', typeof window.LearnCenter.renderHub === 'function');
check('LearnCenter.renderPack exists', typeof window.LearnCenter.renderPack === 'function');
check('LearnCenter.renderLesson exists', typeof window.LearnCenter.renderLesson === 'function');
check('LearnCenter.renderPrint exists', typeof window.LearnCenter.renderPrint === 'function');
```

**Step 2: Run the smoke check to verify it fails**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: FAIL because `js/learn-center.js` is not implemented yet.

**Step 3: Write the minimal implementation**

Implement an IIFE module that:

- loads `data/learn/catalog.json`
- loads a selected pack manifest and module JSON files
- stores active page context (`packId`, `moduleId`, `lessonId`)
- renders:
  - hub page
  - pack overview
  - plan view
  - lesson view
  - print view

Expose:

```javascript
window.LearnCenter = {
  init,
  renderHub,
  renderPack,
  renderPlan,
  renderLesson,
  renderPrint,
  openPack,
  openLesson,
  openPrint
};
```

**Step 4: Run the smoke check again**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: module existence checks PASS.

---

### Task 4: Add progress persistence and one-time learning rewards

**Files:**
- Modify: `js/learn-center.js`
- Modify: `js/app.js`
- Test: `scripts/learning-center-smoke.mjs`

**Step 1: Write the failing progress/reward checks**

Add smoke checks:

```javascript
check('learning progress key is created after completion', localStorage.getItem('petbank_learning_progress') !== null);
check('learning reward key is created after completion', localStorage.getItem('petbank_learning_rewards') !== null);
check('learning completion increases points once', pointsAfterFirst > pointsBefore && pointsAfterSecond === pointsAfterFirst);
```

**Step 2: Run the smoke check to verify it fails**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: FAIL because lesson completion is not implemented yet.

**Step 3: Write the minimal implementation**

In `js/learn-center.js`:

- add read/write helpers for:
  - `petbank_learning_catalog_state`
  - `petbank_learning_progress`
  - `petbank_learning_rewards`
  - `petbank_learning_print_prefs`
- implement `completeLesson(packId, moduleId, lessonId)`
- reward via `window.addGrowthPoints(delta)`
- claim uniqueness key format:

```javascript
`${packId}:${moduleId}:${lessonId}`
```

- add optional daily bundle bonus:

```javascript
`${packId}:daily-bundle:${dayKey}`
```

**Step 4: Run the smoke check again**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: completion persistence and one-time reward checks PASS.

---

### Task 5: Render the first real summer-Chinese pack end-to-end

**Files:**
- Modify: `data/learn/packs/summer-chinese-bridge-2026/modules/morning-reading.json`
- Modify: `data/learn/packs/summer-chinese-bridge-2026/modules/literacy-45days.json`
- Modify: `data/learn/packs/summer-chinese-bridge-2026/modules/weekly-review.json`
- Modify: `data/learn/packs/summer-chinese-bridge-2026/modules/poems.json`
- Modify: `data/learn/packs/summer-chinese-bridge-2026/modules/classics.json`
- Modify: `js/learn-center.js`
- Modify: `css/learn-center.css`
- Test: `scripts/learning-center-smoke.mjs`

**Step 1: Write the failing content/render checks**

Add smoke checks:

```javascript
check('summer pack shows 60-day reading module', pageText.includes('60 天晨读'));
check('summer pack shows 45-day literacy module', pageText.includes('45 天识字'));
check('lesson page shows pinyin toggle', !!document.querySelector('[data-learn-action="toggle-pinyin"]'));
check('print page renders A4-friendly wrapper', !!document.querySelector('.learn-print-sheet'));
```

**Step 2: Run the smoke check to verify it fails**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: FAIL because the first pack content and print layout are incomplete.

**Step 3: Write the minimal real content and rendering**

- seed the summer pack with:
  - `60` reading lessons
  - `45` literacy lessons
  - weekly review entries
  - poems/classics support content
- render lesson cards with:
  - title
  - pinyin content
  - estimated minutes
  - complete button
- render print view with:
  - A4-width sheet
  - larger typography
  - optional pinyin visibility
  - checkbox footer zone

**Step 4: Run the smoke check again**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: pack-content, pinyin-toggle, and print-layout checks PASS.

---

### Task 6: Document, smoke test, and record the feature

**Files:**
- Create: `scripts/learning-center-smoke.mjs`
- Modify: `docs/plans/README.md`
- Modify: `docs/项目现状总览.md`
- Modify: `docs/设计/技术架构.md`
- Modify: `docs/设计/模块清单与接口.md`
- Modify: `CHANGELOG.md`
- Test: local browser + smoke script

**Step 1: Write the regression checklist**

```text
1. 顶部出现 学习 一级入口
2. 学习中心首页能看到资料包目录
3. 幼小衔接暑假中文资料包能进入
4. 60 天晨读与 45 天识字都可逐天打开
5. lesson 完成写入 localStorage 进度
6. lesson 积分只发一次
7. 切换孩子后学习进度隔离
8. 打印页可直接浏览器打印
```

**Step 2: Run the smoke pass**

Run:

```bash
python -m http.server 8000
node scripts/learning-center-smoke.mjs
```

Expected: PASS with no uncaught page errors from the learning-center flow.

**Step 3: Update docs**

Record:

- new `学习` navigation area
- new `LearnCenter` module
- new `petbank_learning_*` keys
- new `data/learn/` pack structure

**Step 4: Commit**

```bash
git add index.html js/app.js js/learn-center.js css/learn-center.css data/learn scripts/learning-center-smoke.mjs docs/plans/README.md docs/项目现状总览.md docs/设计/技术架构.md docs/设计/模块清单与接口.md CHANGELOG.md
git commit -m "feat: add learning center and summer chinese pack scaffold"
```
