# Learning Center English Hybrid Pack Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an English hybrid learning pack to the existing learning center so the current project can launch external reading chapters, record completion locally, award growth points, and stay extensible for future custom packs.

**Architecture:** Reuse the current `LearnCenter` pack/module/lesson runtime and extend it with source-aware lesson handling. The first pack will be a hybrid pack driven by JSON data, where lesson metadata and rewards live locally, while chapter reading happens on external URLs such as `mayihaoke.com`. Keep all progress and rewards in the existing `petbank_learning_*` keys and route all points through `window.addGrowthPoints(delta)`.

**Tech Stack:** Static HTML, Vanilla JS IIFE modules, CSS, JSON data files under `data/learn`, localStorage, current `switchPage()` routing in `js/app.js`, existing `LearnCenter` runtime, Playwright smoke validation via `node scripts/learning-center-smoke.mjs`.

---

### Task 1: Extend the learning-pack data contract for hybrid English packs

**Files:**
- Modify: `data/learn/catalog.json`
- Create: `data/learn/packs/english-mc-hybrid-2026/manifest.json`
- Create: `data/learn/packs/english-mc-hybrid-2026/plan.json`
- Create: `data/learn/packs/english-mc-hybrid-2026/modules/mcbook56-story.json`
- Create: `data/learn/packs/english-mc-hybrid-2026/modules/mcbookstarters-reader.json`
- Create: `data/learn/packs/english-mc-hybrid-2026/modules/english-weekly-review.json`
- Create: `data/learn/packs/english-mc-hybrid-2026/modules/custom-entry-slot.json`
- Test: `scripts/learning-center-smoke.mjs`

**Step 1: Write the failing smoke assertions**

Add checks such as:

```javascript
check('英语资料包出现在学习中心目录', /Minecraft我的世界英语故事/.test(learnRuntime.pageText));
check('英语资料包 manifest 使用 hybrid 类型', manifest.packType === 'hybrid');
check('英语故事模块至少存在 1 节', storyModule.lessons.length > 0);
```

**Step 2: Run the smoke check to verify it fails**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: FAIL because the English pack files do not exist yet.

**Step 3: Create the minimal English pack data**

Create:

- one hybrid English pack in `catalog.json`
- one manifest with `packType`, `sourceAdapter`, and reward rules
- one plan file with daily rhythm
- three real modules + one reserved custom slot module

**Step 4: Run the smoke check again**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: English pack contract checks PASS.

---

### Task 2: Add source-aware lesson metadata parsing in `LearnCenter`

**Files:**
- Modify: `js/learn-center.js`
- Test: `scripts/learning-center-smoke.mjs`

**Step 1: Write the failing runtime assertions**

Add checks that require source parsing:

```javascript
check('英语 lesson 识别 external-chapter 来源', lesson.source.kind === 'external-chapter');
check('英语 pack 暴露 sourceAdapter', pack.manifest.sourceAdapter === 'mayihaoke-reader');
```

**Step 2: Run the smoke check to verify it fails**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: FAIL because the current runtime does not formally resolve hybrid source metadata.

**Step 3: Write the minimal implementation**

In `js/learn-center.js`, add helper functions such as:

```javascript
function resolvePackCapabilities(manifest) {}
function resolveLessonSource(pack, module, lesson) {}
function resolveLessonLaunchUrl(pack, module, lesson) {}
function resolveLessonReward(pack, module, lesson) {}
```

Keep the implementation small:

- use manifest/module/lesson fields directly
- return `null` safely for legacy packs
- preserve existing Chinese pack behavior

**Step 4: Run the smoke check again**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: source-resolution checks PASS without breaking existing packs.

---

### Task 3: Add the English pack to the learning hub and pack pages

**Files:**
- Modify: `js/learn-center.js`
- Modify: `css/learn-center.css`
- Test: `scripts/learning-center-smoke.mjs`

**Step 1: Write the failing UI assertions**

Add checks such as:

```javascript
check('学习中心首页显示英语资料包入口', /Minecraft我的世界英语故事/.test(learnPageText));
check('英语资料包页显示故事模块和复盘模块', /我的世界英语故事/.test(packText) && /每周英语复盘/.test(packText));
```

**Step 2: Run the smoke check to verify it fails**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: FAIL because the current hub copy and pack rendering do not know the new English pack yet.

**Step 3: Implement the minimal UI changes**

- show the new English pack card in the existing hub
- keep the same layout pattern as current packs
- add concise English-themed copy only where needed
- do not fork a separate UI framework

**Step 4: Run the smoke check again**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: English pack hub and pack-page checks PASS.

---

### Task 4: Add external chapter launch actions to the lesson page

**Files:**
- Modify: `js/learn-center.js`
- Modify: `css/learn-center.css`
- Test: `scripts/learning-center-smoke.mjs`

**Step 1: Write the failing lesson-action assertions**

Add checks such as:

```javascript
check('英语 lesson 页面存在打开外部章节按钮', !!lessonPage.querySelector('[data-learn-action=\"open-external\"]'));
check('外部章节按钮包含 mayihaoke 目标地址', /mayihaoke\\.com/.test(openBtn.href || openBtn.dataset.url));
```

**Step 2: Run the smoke check to verify it fails**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: FAIL because the current lesson page has no dedicated external launch action.

**Step 3: Write the minimal implementation**

Render an external-reading support card that includes:

- target words
- parent tip
- `打开点读页` button
- explanatory note that the user should return and tick completion

Prefer simple anchor/button behavior. Do not attempt automatic completion detection.

**Step 4: Run the smoke check again**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: external-launch checks PASS.

---

### Task 5: Add English lesson completion and one-time rewards

**Files:**
- Modify: `js/learn-center.js`
- Test: `scripts/learning-center-smoke.mjs`

**Step 1: Write the failing reward assertions**

Add checks such as:

```javascript
check('英语章节完成后写入 learning_progress', !!englishProgressRaw);
check('英语章节积分只发一次', pointsAfterFirst > pointsBefore && pointsAfterSecond === pointsAfterFirst);
```

**Step 2: Run the smoke check to verify it fails**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: FAIL because the new English modules and rewards are not wired yet.

**Step 3: Write the minimal implementation**

- reuse the existing completion path
- map English reward keys to pack/module/lesson
- keep duplicate-claim prevention identical to current learning rewards

**Step 4: Run the smoke check again**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: English reward checks PASS.

---

### Task 6: Add the “3 chapter streak” bonus without breaking existing packs

**Files:**
- Modify: `js/learn-center.js`
- Test: `scripts/learning-center-smoke.mjs`

**Step 1: Write the failing streak-bonus assertion**

Add a smoke check like:

```javascript
check('连续完成 3 个英语章节触发额外奖励', bonusPointsAfterThird === expectedPoints);
```

**Step 2: Run the smoke check to verify it fails**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: FAIL because no English streak rule exists yet.

**Step 3: Write the minimal implementation**

- add an English-specific streak bonus keyed by pack + streak group
- ensure it only fires once per completed streak segment
- keep current Chinese daily-bundle logic unchanged

**Step 4: Run the smoke check again**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: streak-bonus checks PASS.

---

### Task 7: Reserve custom-pack hooks and validate they do not break legacy packs

**Files:**
- Modify: `js/learn-center.js`
- Modify: `docs/设计/模块清单与接口.md`
- Test: `scripts/learning-center-smoke.mjs`

**Step 1: Write the failing capability assertions**

Add checks such as:

```javascript
check('LearnCenter 暴露 source-aware helper contract', typeof window.LearnCenter.resolveLessonSource === 'function');
check('legacy Chinese pack still renders normally', /暑假中文/.test(chinesePackText));
```

**Step 2: Run the smoke check to verify it fails**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: FAIL because helper contracts are not exported yet.

**Step 3: Write the minimal implementation**

- export the helper functions needed for future custom packs
- keep them optional and non-invasive
- update architecture docs to mention hybrid/custom pack readiness

**Step 4: Run the smoke check again**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: helper-contract and legacy-pack checks PASS.

---

### Task 8: Verify the full learning-center regression set

**Files:**
- Test: `js/learn-center.js`
- Test: `scripts/learning-center-smoke.mjs`
- Test: browser UI for English lessons

**Step 1: Run syntax validation**

Run:

```bash
node --check js/learn-center.js
```

Expected: exit code `0`.

**Step 2: Run the full smoke suite**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected: all current Chinese/site-gateway assertions still PASS, and all new English-hybrid assertions PASS.

**Step 3: Manual browser spot check**

Verify in the browser:

- English pack appears on the learning home page
- External chapter button opens the expected site
- Returning and clicking completion updates progress and points
- “我的进度” includes English completion data

**Step 4: Commit**

```bash
git add data/learn/catalog.json data/learn/packs/english-mc-hybrid-2026 js/learn-center.js css/learn-center.css scripts/learning-center-smoke.mjs docs/设计/模块清单与接口.md
git commit -m "feat: add hybrid english learning pack"
```
