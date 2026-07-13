# Minecraft 单词卡学习接入 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在宠物积分主站中加入可恢复、按 Profile 隔离、完成后发放成长分的 Minecraft 单词卡学习远征，同时保留完整 Anki 独立浏览器和参考站本地词表。

**Architecture:** 复用现有 `LearnCenter` 数据包和 `EnglishVocabProgress` 词卡进度；新增 `MinecraftVocabSession` 负责确定性队列、会话快照和奖励事件，新增 `MinecraftVocabPage` 负责页面渲染。主站通过 `page-router.js`、`runtime-loader.js` 和一个新的经典学习页接入，Anki 项目继续排除在 Pages 制品外。

**Tech Stack:** Vanilla JS IIFE/window namespace、静态 JSON、localStorage Profile 快照、Node `vm`/assert 合同测试、Playwright 浏览器 smoke、现有 Pages artifact 组装脚本。

---

### Task 1: 固化参考站结构化词表快照

**Files:**
- Create: `scripts/fetch-mayihaoke-minecraft-words.mjs`
- Create: `scripts/test-mayihaoke-minecraft-words.mjs`
- Create/Modify: `data/learn/external/mayihaoke/word-cards.json`
- Modify: `data/learn/external/mayihaoke/resources.json`

**Step 1: Write the failing test**

为规范化函数准备 fixture，断言 API 行可以转换为 `index/word/phonetic/chinese/example/example_translation`，缺少单词或中文的行被丢弃，HTML 字段不会原样注入运行时。

**Step 2: Run test to verify it fails**

Run: `node scripts/test-mayihaoke-minecraft-words.mjs`

Expected: FAIL because the fetch/normalization module does not exist.

**Step 3: Write minimal implementation**

实现公开接口抓取、`response.ok` 检查、字段规范化、去重、来源元数据和 JSON 写入；默认只保存结构化文本，不下载参考站媒体。

**Step 4: Run test to verify it passes**

Run: `node scripts/test-mayihaoke-minecraft-words.mjs`

Expected: PASS；随后运行脚本生成约 500 条本地词卡快照并确认每条必填字段完整。

**Step 5: Commit**

```bash
git add scripts/fetch-mayihaoke-minecraft-words.mjs scripts/test-mayihaoke-minecraft-words.mjs data/learn/external/mayihaoke/word-cards.json data/learn/external/mayihaoke/resources.json
git commit -m "data: snapshot Minecraft reference vocabulary"
```

### Task 2: 先写会话与奖励合同测试

**Files:**
- Create: `scripts/test-minecraft-vocab-session.mjs`
- Create: `scripts/fixtures/minecraft-vocab-session-fixture.json`（若测试需要固定卡片样本）
- Test contract later: `scripts/test-minecraft-vocab-browser.mjs`

**Step 1: Write the failing test**

覆盖以下行为：每日队列严格为 2 review + 5 new + 3 recall + 1 scene；卡片不足时不重复；相同 Profile/日期队列稳定；不同日期重建；会话保存键带 Profile；未完成不能奖励；完成后 reward event ID 稳定；重复 claim 返回 duplicate。

**Step 2: Run test to verify it fails**

Run: `node scripts/test-minecraft-vocab-session.mjs`

Expected: FAIL because `js/minecraft-vocab-session.js` does not exist.

**Step 3: Commit the red test**

```bash
git add scripts/test-minecraft-vocab-session.mjs scripts/fixtures/minecraft-vocab-session-fixture.json
git commit -m "test: define Minecraft vocab session contract"
```

### Task 3: Implement Profile-scoped session state and reward policy

**Files:**
- Create: `js/minecraft-vocab-session.js`
- Modify: `docs_project/data-contracts/localstorage-keys.md`
- Modify: `docs_project/data-contracts/localstorage-registry.json`

**Step 1: Write minimal implementation**

实现 `MinecraftVocabSession.createQueue()`、`load()`、`save()`、`start()`、`recordAction()`、`isComplete()`、`getRewardEvent()` 和 `claimReward()`。读取 Profile ID 时复用 `ProfileManager.getActiveId()`，缺省使用 `default`；日期复用 `PetBankTime.localDate()`；奖励只调用 `GameRewardReceipts.claim()`，不直接写积分键。

**Step 2: Run focused tests**

Run: `node scripts/test-minecraft-vocab-session.mjs`

Expected: PASS；失败写入必须返回 `persisted: false`，不能把动作或奖励标记为完成。

**Step 3: Commit**

```bash
git add js/minecraft-vocab-session.js docs_project/data-contracts/localstorage-keys.md docs_project/data-contracts/localstorage-registry.json
git commit -m "feat: add profile-scoped Minecraft vocab sessions"
```

### Task 4: Add route, runtime bundle, and host page

**Files:**
- Modify: `js/page-router.js`
- Modify: `js/runtime-loader.js`
- Modify: `js/app.js`
- Modify: `index.html`
- Modify: `scripts/test-page-router-contract.mjs`
- Modify: `scripts/test-static-route-entries.mjs`

**Step 1: Extend failing contracts**

断言 `minecraft-vocab` 归属学习 tab、经典 shell、路径 `/app/learn/minecraft-vocab`、深层路径归一化和页面容器存在；断言 runtime bundle 会加载 CSS、session 和 page 脚本。

**Step 2: Run red contracts**

Run: `node scripts/test-page-router-contract.mjs; node scripts/test-static-route-entries.mjs`

Expected: FAIL because route/page/bundle are not present.

**Step 3: Implement host wiring**

加入页面容器、路由表、`ensurePage('minecraft-vocab')`、`runPageActivation`、离页停止入口和 `LearnCenter.openMinecraftVocab()`。学习中心的 Minecraft 词卡模块按钮进入新页，原有 `learn-lesson` 词卡页保留回退路径。

**Step 4: Run route contracts**

Run: `node scripts/test-page-router-contract.mjs; node scripts/test-static-route-entries.mjs`

Expected: PASS。

### Task 5: Build the daily expedition UI

**Files:**
- Create: `js/minecraft-vocab-page.js`
- Create: `css/minecraft-vocab.css`
- Modify: `js/runtime-loader.js` (bundle order if needed)
- Modify: `js/lucide-lite.js` only if an existing icon is unavailable

**Step 1: Write page contract assertions**

在 `scripts/test-minecraft-vocab-browser.mjs` 中断言首页、四段节奏、11 个任务、图片、词卡、释义切换、音频按钮、主动回忆输入、场景句和移动端固定操作区。

**Step 2: Run browser test to verify red**

Run: `node scripts/test-minecraft-vocab-browser.mjs`

Expected: FAIL because page namespace and DOM do not exist。

**Step 3: Implement minimal page**

使用已有 `assets/learn/portal-minecraft-english-cover-20260705.png` 和本地词卡图片/音频；首页显示今日进度和“开始远征”，会话按阶段只显示当前任务，按钮操作后重新渲染并保持滚动位置。使用 lucide 图标、明确 `aria-label` 和 `prefers-reduced-motion`，移动端操作区固定在内容底部且预留安全区。

**Step 4: Run browser test**

Run: `python -m http.server 8765 --bind 127.0.0.1; node scripts/test-minecraft-vocab-browser.mjs`

Expected: PASS on desktop and 390px viewport with no page errors。

**Step 5: Commit**

```bash
git add js/minecraft-vocab-page.js css/minecraft-vocab.css js/page-router.js js/runtime-loader.js js/app.js index.html scripts/test-page-router-contract.mjs scripts/test-static-route-entries.mjs scripts/test-minecraft-vocab-browser.mjs
git commit -m "feat: add Minecraft vocab expedition page"
```

### Task 6: Connect answer persistence and reward end to end

**Files:**
- Modify: `js/minecraft-vocab-page.js`
- Modify: `js/english-vocab-progress.js` only for required observable failure handling
- Modify: `scripts/test-english-vocab-profile-scope.mjs`
- Modify: `scripts/test-game-reward-receipts.mjs` or add focused reward fixture

**Step 1: Add failure cases**

模拟词卡进度键写失败、会话键写失败、奖励 API 缺失和重复提交；断言 UI 不前进、不显示完成、不增加 `petbank_points`。

**Step 2: Run red test**

Run: `node scripts/test-minecraft-vocab-session.mjs; node scripts/test-english-vocab-profile-scope.mjs`

Expected: new failure cases fail until page/session integration is complete。

**Step 3: Implement integration**

每个动作先写词卡进度，再写会话快照；全部完成后才 claim reward；成功/重复/失败都显示可观察反馈。页面离开时调用 `MinecraftVocabPage.stop()`，清理音频和 timer。

**Step 4: Run focused tests**

Run: `node scripts/test-minecraft-vocab-session.mjs; node scripts/test-english-vocab-profile-scope.mjs; node scripts/test-game-reward-receipts.mjs`

Expected: PASS。

### Task 7: Verify full site and release docs

**Files:**
- Modify: `scripts/learning-center-smoke.mjs`
- Modify: `scripts/run-full-regression.mjs`
- Modify: `docs_project/modules/learn-center.md`
- Modify: `CHANGELOG.md`
- Modify: `docs_project/runbooks/self-hosted/ANKI-MINECRAFT-VOCAB-HERMES.md`
- Modify: `prj/anki-minecraft-vocab/DEPLOY-HERMES.md`
- Modify: `prj/anki-minecraft-vocab/hermes.yaml`

**Step 1: Run focused browser and Anki tests**

Run the standalone Anki tests, Minecraft browser test, learning-center smoke, route contracts, and Pages fast gate。

**Step 2: Run full regression**

Run: `node scripts/run-full-regression.mjs`

Expected: all existing and new checks pass; report environmental browser skips separately。

**Step 3: Assemble and inspect Pages artifact**

Run: `node scripts/assemble-pages-artifact.mjs _site_verify; node scripts/test-static-route-entries.mjs`

Expected: main site route exists, Anki standalone project remains excluded, no raw APKG or temporary files enter the artifact。

**Step 4: Commit release documentation**

```bash
git add scripts/learning-center-smoke.mjs scripts/run-full-regression.mjs docs_project/modules/learn-center.md CHANGELOG.md docs_project/runbooks/self-hosted/ANKI-MINECRAFT-VOCAB-HERMES.md prj/anki-minecraft-vocab/DEPLOY-HERMES.md prj/anki-minecraft-vocab/hermes.yaml
git commit -m "docs: release Minecraft vocab learning integration"
```

**Step 5: Push and report**

Run: `git push origin main` only after all tests and artifact checks pass. Report commit, remote branch, local URLs, test counts, and any pre-existing dirty files left untouched。
