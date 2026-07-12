# 宠物手机：星光成长侦探社 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在探索地图中提供一个可玩的“星光联络器”首季案件链，文本、数据和代码职责分离，且不影响当前场景故事与战斗。

**Architecture:** `data/story-packs/03-space-growth-detective/` 保存只读的故事文本和案件配置；`PetStoryCases` 负责加载、线索解析、照料调用和带收据的本地案件进度；探索页仅挂载三卡案件面板。案件标识由 `profileId + pet_id + storyId + caseId` 组成，奖励仍通过既有核心奖励服务。

**Tech Stack:** Vanilla JavaScript IIFE、JSON、localStorage、Node 内置 `assert/vm`、Playwright。

---

### Task 1: 建立案件状态和内容契约

**Files:**
- Create: `scripts/test-pet-story-cases.mjs`
- Create: `js/pet-story-cases.js`
- Modify: `js/pet.js`

**Step 1: Write the failing test**

验证宠物实例身份、动态线索档位、按 profile/宠物隔离的结案记录、重复 receipt 拦截，以及真实照料 API 的成功/失败结果。

**Step 2: Run test to verify it fails**

Run: `node scripts/test-pet-story-cases.mjs`

Expected: FAIL because `js/pet-story-cases.js` does not exist.

**Step 3: Write minimal implementation**

实现 `window.PetStoryCases`；给 `PetSystem` 增加可持久化的 `pet_id`，兼容旧存档缺失 ID 的一次性补写。

**Step 4: Run test to verify it passes**

Run: `node scripts/test-pet-story-cases.mjs`

Expected: PASS.

### Task 2: 单独编写故事文本与数据包

**Files:**
- Create: `data/story-packs/03-space-growth-detective/manifest.json`
- Create: `data/story-packs/03-space-growth-detective/cases/*.json`
- Create: `scripts/test-space-growth-detective-content.mjs`
- Create: `docs/探索地图故事/03-宠物手机星光成长侦探社/01-故事方案.md`
- Create: `docs/探索地图故事/03-宠物手机星光成长侦探社/03-第一季故事文本.md`

**Step 1: Write the failing test**

验证 manifest、五案顺序、线索和照料白名单、儿童短文本、回信和备用结局字段。

**Step 2: Run test to verify it fails**

Run: `node scripts/test-space-growth-detective-content.mjs`

Expected: FAIL because the content pack does not exist.

**Step 3: Write minimal implementation**

新增五个案件 JSON；Markdown 只保存可供审稿的完整文本，不作为运行时来源。

**Step 4: Run test to verify it passes**

Run: `node scripts/test-space-growth-detective-content.mjs`

Expected: PASS.

### Task 3: 接入探索地图的三卡面板

**Files:**
- Modify: `js/runtime-loader.js`
- Modify: `js/app.js`
- Modify: `css/style.css`
- Create: `scripts/test-space-growth-detective-browser.mjs`

**Step 1: Write the failing browser test**

验证探索页显示来信、线索、选择和回信；选择正确答案后点击照料，真实宠物字段变化并记录案件；无宠物时走观察备用结局；没有战斗 modal。

**Step 2: Run test to verify it fails**

Run: `node scripts/test-space-growth-detective-browser.mjs`

Expected: FAIL because探索页尚未挂载案件面板。

**Step 3: Write minimal implementation**

在 explore bundle 加载 `pet-story-cases.js`，在地图壳上方挂载受控三卡面板。所有 HTML 文本转义，行动仅从白名单调用 `PetSystem`。

**Step 4: Run test to verify it passes**

Run: `node scripts/test-space-growth-detective-browser.mjs`

Expected: PASS.

### Task 4: 奖励、文档与回归

**Files:**
- Modify: `docs_project/data-contracts/localstorage-keys.md`
- Modify: `docs/探索地图故事/03-宠物手机星光成长侦探社/02-后续落地细节.md`

**Step 1: Run focused tests**

Run: `node scripts/test-pet-story-cases.mjs` and `node scripts/test-space-growth-detective-content.mjs`.

**Step 2: Run browser and existing regressions**

Run: `node scripts/test-space-growth-detective-browser.mjs` and `node scripts/test-short-travel-chapter-browser.mjs` against a local static server.

**Step 3: Verify build boundaries**

Run: `node scripts/test-pages-fast-gate-contract.mjs` and `node scripts/test-static-route-entries.mjs`.

**Step 4: Commit and integrate**

Stage only story files, module, page wiring, CSS, tests, and documentation; commit on the feature branch, then fast-forward merge to `main` without touching unrelated working-tree changes.
