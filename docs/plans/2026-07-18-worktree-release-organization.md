# 工作树分批整理与版本发布实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**目标：** 将 2026-07-18 工作树中的多个主题按风险、依赖和发布边界拆成可验证的本地提交，补齐历史提交的版本说明，并推送到 `origin/main`。

**架构：** 不改写已有提交，不回滚用户原有改动；先在 `CHANGELOG.md` 补记 `v0.7.52` 之后已经落地但漏记的提交，再按首页/探索与孩子工作台、Minecraft 词汇远征、独立学习机原型与资源门禁三个功能批次整理当前未提交文件。每批只暂存自身文件，版本说明和对应契约测试随批次进入提交。

**技术栈：** Vanilla JS、静态 HTML/CSS、Node.js 契约脚本、Playwright 浏览器回归、GitHub Pages 制品组装、Windows PowerShell。

---

## 基线与保护边界

- 当前分支：`main`，基线提交为 `2ee6349f`，与 `origin/main` 同步。
- 当前工作树已有大量用户未提交修改；不执行 `reset --hard`、`checkout --`、`clean` 或批量删除。
- 根目录 `child-audit-apple.png`、`picturebook-mobile.png` 是本地视觉验证证据，不进入功能提交；若用户后续明确要归档，再单独处理。
- `_site*`、`tmp/`、`.playwright-mcp/`、真实环境文件和浏览器数据不进入提交。

## Task 1: 补记已提交但漏记的版本说明

**Files:**

- Modify: `CHANGELOG.md`

为 `v0.7.52` 之后的 17 个已提交主题增加 `v0.7.53` 历史补记，至少覆盖：像素工作台设计与玻璃风格、首页/冒险终端、根入口与首页回归、压缩运行资源、Minecraft 词汇会话、单词记忆背景、拼音赛车、打字防线路线、学习工作台和冒险首页。描述必须区分“已经提交/已经实现”和后续当前工作树内容。

Run: `rg -n "v0.7.53|2ee6349f|1cfefa91" CHANGELOG.md`

Expected: `CHANGELOG.md` 含历史补记版本、日期和可追溯提交主题。

Commit: `docs: record post-v0.7.52 release history`

## Task 2: 提交首页/探索解耦与孩子工作台

**Files:**

- Modify: `index.html`, `css/style.css`, `css/pixel-story.css`, `js/app.js`, `js/exploration.js`, `js/exploration-detail.js`, `js/page-router.js`, `js/pixel-story-map.js`, `js/profile-storage-policy.js`, `js/profiles.js`, `js/runtime-loader.js`, `js/showcase.js`
- Add: `css/child-workbench-shell.css`, `js/child-workbench-shell.js`, `js/pixel-story-page.js`, `js/scheduled-checkins.js`
- Modify/Add: 首页、探索、工作台和提醒相关 `scripts/test-*.mjs`、`scripts/run-full-regression.mjs`
- Modify: `docs_project/modules/exploration.md`, `docs_project/modules/runtime-loader.md`, `docs_project/modules/child-workbench.md`, `docs_project/data-contracts/localstorage-keys.md`, `docs_project/data-contracts/localstorage-registry.json`, `docs_project/runbooks/testing-and-release.md`

验证首页不再嵌套探索地图，森林地图使用 `/app/explore/forest` 独立入口，故事地图使用固定宿主，孩子工作台导航和定时打卡不破坏 Profile/积分边界。

Run: `node scripts/test-home-explore-dom-ownership.mjs`; `node scripts/test-explore-mode-contract.mjs`; `node scripts/test-static-route-entries.mjs`; `node scripts/test-scheduled-checkins.mjs`; `node --check js/app.js`

With server: `node scripts/test-child-workbench-shell-browser.mjs`; `node scripts/test-home-explore-layout.mjs`; `node scripts/test-exploration-return-target-browser.mjs`; `node scripts/test-explore-deep-route-browser.mjs`

Commit: `feat: separate child workbench and exploration pages`

## Task 3: 提交 Minecraft 词汇远征与内容资产

**Files:**

- Modify: `css/minecraft-vocab.css`, `data/learn/external/mayihaoke/word-cards.json`, `data/learn/packs/english-mc-hybrid-2026/modules/*.json`, `js/minecraft-vocab-page.js`, `js/minecraft-vocab-session.js`, `scripts/build_minecraft_full_learning_pool.cjs`, `scripts/enrich_minecraft_vocab.cjs`, Minecraft tests and runbooks
- Add: `js/minecraft-vocab-expedition.js`, `data/learn/minecraft-expedition/camp-regions.json`, `data/learn/packs/english-mc-hybrid-2026/minecraft-card-back-prompts.json`, `assets/learn/english-vocab/minecraft-card-backs/`, `scripts/generate_minecraft_card_back_images.py`, `scripts/test-minecraft-expedition-*.mjs`, `docs_project/runbooks/self-hosted/MINECRAFT-EXPEDITION-CAMP-HERMES.md`
- Modify: `docs_project/data-contracts/localstorage-keys.md`, `docs_project/data-contracts/localstorage-registry.json`, `docs_project/runbooks/testing-and-release.md`

验证营地状态按 Profile 隔离、任务解锁和奖励 receipt 幂等；内容、卡片素材、图片缺失回退和发布白名单保持可审计。不得把参考站完整资源、密钥、原始生图中间物或 Anki 独立后端混入主站。

Run: `node scripts/test-minecraft-expedition-contract.mjs`; `node scripts/test-minecraft-vocab-content.mjs`; `node scripts/test-minecraft-vocab-session.mjs`; `node scripts/test-static-route-entries.mjs`

With server: `node scripts/test-minecraft-expedition-browser.mjs`; `node scripts/test-minecraft-vocab-browser.mjs`

Commit: `feat: add Minecraft vocabulary expedition camp`

## Task 4: 提交独立学习机原型与运行资源门禁

**Files:**

- Modify: `prj/学习机玩法原型/`, `prj/消灭苦力怕打字游戏/web/`, `css/playground.css`
- Modify: 原型 smoke、视觉、指标和回放测试；`scripts/assemble-pages-artifact.mjs`; `scripts/test-static-route-entries.mjs`; `scripts/run-full-regression.mjs`
- Modify: `README.md` 或对应原型 README/优化方案，仅记录当前实现与验证边界

验证学习机拼音赛车控制、打字防线敌人路线、回放反馈、学习指标和 Pages 发布资源仍保持独立原型边界。

Run: `node --check prj/学习机玩法原型/game.js`; `node prj/学习机玩法原型/scripts/test-learning-metrics.mjs`; `node prj/学习机玩法原型/scripts/test-pinyin-racer-visual.mjs`; `node scripts/test-static-route-entries.mjs`; `node scripts/assemble-pages-artifact.mjs _site_verify`

Commit: `feat: refine standalone learning game prototypes`

## Task 5: 全量验证、版本文档和推送

Run: `git diff --check`; `node scripts/test-pages-fast-gate-contract.mjs`; `node scripts/run-full-regression.mjs`; `node --test prj/petbank-server/test/*.test.mjs`; `git status --short --branch`

确认每个功能批次有版本说明、测试入口和明确的未实现边界；逐批执行 `git push origin main`，最后核对本地与远程无 ahead/behind。失败时保留已通过的批次，不回滚已提交内容，并在最终记录环境前置与代码断言失败的区别。
