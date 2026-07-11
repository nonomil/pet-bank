# 网页项目优化 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不迁移框架、不重写页面的前提下，逐步把宠物积分网页收口为可信状态、可信奖励、可维护模块和可验证发布的静态应用。

**Architecture:** 保留现有 Vanilla JavaScript、静态路由和 iframe 游戏结构。先建立 storage、奖励和游戏结果的可测试服务边界，再由 `app.js` 的旧全局 API 作为兼容 facade 调用新服务；最后才逐步拆分页面控制器与体验层。

**Tech Stack:** 静态 HTML、Vanilla JavaScript、localStorage、Node.js 契约测试、GitHub Pages、可选 Supabase / SQLite 后端。

---

## 执行纪律

- 每个阶段只处理一个可回滚问题，单独提交、更新版本与变更日志。
- 先写失败的契约测试，确认失败原因后才写最小实现；不得依赖手动页面验证代替契约。
- 不混入词库、素材、生图或原型改动；这些改动必须先独立审查、验证、提交或明确丢弃。
- 不迁移 React/Vue/TypeScript，不重写 `app.js`；服务拆分必须保留旧调用入口。
- 每次发布前执行 Pages 快速门禁、相关专项测试、`git diff --check` 和制品资源核对。

## 阶段与版本

| 阶段 | 目标版本 | 工作包 | 结果 | 进入条件 |
| --- | --- | --- | --- | --- |
| 0 | `v0.7.35` | 项目边界整理 | 运行/原始/缓存/文档边界与清理清单 | 不删除来源不明文件 |
| 1 | `v0.7.36` | WP3 | 游戏奖励 receipt 幂等 | 阶段 0 已提交 |
| 2 | `v0.7.37` | WP5 | Storage Registry 审计 | receipt 已稳定 |
| 3 | `v0.7.38` | WP6 | Profile 快照白名单 | Registry 覆盖现有键 |
| 4 | `v0.7.39` | `app.js` 第一轮拆分 | 奖励、每日状态、游戏桥服务化 | Profile 回归通过 |
| 5 | `v0.7.40` | WP7 | Attempt 与复习调度 | learner scope 与日期语义稳定 |
| 6 | `v0.7.41` | WP8 + WP11 | GameResult v1 与儿童体验基线 | 三游戏 receipt 已接入 |
| 7 | `v0.8.0` | WP12 + 发布性能 | 首页行动卡、资源预算、可访问性 | 学习数据可解释 |

### Task 0: 项目边界与工作区整理（`v0.7.35`）

**Files:**
- Create: `docs_project/PROJECT-BOUNDARIES.md`
- Create: `docs_project/runbooks/repository-cleanup.md`
- Modify: `.gitignore`
- Modify: `README.md`
- Test: `scripts/test-repository-boundaries.mjs`

**Step 1: Write the failing test**

创建 `scripts/test-repository-boundaries.mjs`，断言：发布脚本不会复制 `tmp/`、浏览器 profile、原始生图输出；已引用的运行资源仍在 Pages 制品中。

**Step 2: Run test to verify it fails**

Run: `node scripts/test-repository-boundaries.mjs`

Expected: FAIL，原因是边界清单和受控忽略规则尚不存在。

**Step 3: Write minimal implementation**

- 在边界文档中把目录分为“网页运行时、受版本控制源码、原始素材、可再生成产物、本地缓存、参考资料”。
- `.gitignore` 只新增已确认的缓存规则，保留正式运行资源的反向白名单。
- 在清理手册中列出“可删前提、生成命令、验证命令、禁止删除项”。
- 不删除 `tmp/`、`docs/参考/` 或原型目录，直到清单逐项确认。

**Step 4: Run test to verify it passes**

Run: `node scripts/test-repository-boundaries.mjs`

Expected: PASS，并输出制品包含和排除的资源类别。

**Step 5: Commit**

```powershell
git add .gitignore README.md docs_project/PROJECT-BOUNDARIES.md docs_project/runbooks/repository-cleanup.md scripts/test-repository-boundaries.mjs
git commit -m "docs: define repository runtime boundaries"
```

### Task 1: 游戏奖励 receipt 幂等（WP3，`v0.7.36`）

**Files:**
- Create: `js/game-reward-receipts.js`
- Modify: `js/app.js`
- Modify: `js/math-pk.js`
- Modify: `prj/消灭苦力怕打字游戏/web/game.js`
- Modify: `prj/单词记忆射击场原型/game.js`
- Test: `scripts/test-game-reward-receipts.mjs`

**Step 1: Write the failing test**

测试用内存 localStorage 执行 `claim({ profileId, source, eventId, points, localDate })`：首次返回可领取，重复 eventId、跨 iframe 重放和非法积分均不得再次增加积分；不同 Profile 的同 eventId 不互相阻塞。

**Step 2: Run test to verify it fails**

Run: `node scripts/test-game-reward-receipts.mjs`

Expected: FAIL，原因是 `GameRewardReceipts` 不存在。

**Step 3: Write minimal implementation**

- 以 `profileId + source + eventId` 持久化 receipt；记录 `points`、`localDate`、`claimedAt`、`schemaVersion`。
- 打字防线在每次实际命中生成稳定事件 ID；像素探险与数学 PK 在每局开始生成 run ID，并在结算时发送/消费一次。
- `app.js` 只在 receipt 允许时调用既有 `addGrowthPoints`；保留旧桥消息兼容，但旧消息使用保守的单次 session/seq 去重。
- 本阶段不启用每日上限、不改奖励数值、不做服务端账本。

**Step 4: Run test to verify it passes**

Run: `node scripts/test-game-reward-receipts.mjs`

Expected: PASS，覆盖刷新重放、A/B 档案和非法 payload。

**Step 5: Commit**

```powershell
git add js/game-reward-receipts.js js/app.js js/math-pk.js prj/消灭苦力怕打字游戏/web/game.js prj/单词记忆射击场原型/game.js scripts/test-game-reward-receipts.mjs
git commit -m "fix: deduplicate game reward receipts"
```

### Task 2: Storage Registry 审计（WP5，`v0.7.37`）

**Files:**
- Create: `data/storage-registry.json`
- Create: `scripts/check-storage-registry.mjs`
- Test: `scripts/test-storage-registry.mjs`
- Modify: `docs_project/ARCHITECTURE.md`

**Step 1: Write the failing test**

列出 `js/**/*.js` 的 `localStorage.getItem/setItem/removeItem` 键，断言每个 `petbank_*` 键都在 Registry 声明 owner、scope、schemaVersion、profileScoped 和 cloudSync。

**Step 2: Run test to verify it fails**

Run: `node scripts/test-storage-registry.mjs`

Expected: FAIL，并报告未登记键。

**Step 3: Write minimal implementation**

- 为现有键建立机器可读 Registry；动态键使用模板及 owner 说明。
- checker 第一版只报告，不改变任何运行时读写。
- 明确 device、profile、household、auth、cloud-config 的边界。

**Step 4: Run test to verify it passes**

Run: `node scripts/test-storage-registry.mjs; node scripts/check-storage-registry.mjs`

Expected: PASS，输出 0 个未登记生产键。

**Step 5: Commit**

```powershell
git add data/storage-registry.json scripts/check-storage-registry.mjs scripts/test-storage-registry.mjs docs_project/ARCHITECTURE.md
git commit -m "docs: audit browser storage ownership"
```

### Task 3: Profile 快照白名单（WP6，`v0.7.38`）

**Files:**
- Modify: `js/profiles.js`
- Modify: `js/profile-sync.js`
- Modify: `js/cloud-sync.js`
- Modify: `js/cloud-restore.js`
- Test: `scripts/test-profile-snapshot-whitelist.mjs`

**Step 1: Write the failing test**

构造 A/B 档案、已登记和未登记键，断言 export/restore 只处理 Registry 标为 profile 且允许同步的键，且旧快照仍可读取。

**Step 2: Run test to verify it fails**

Run: `node scripts/test-profile-snapshot-whitelist.mjs`

Expected: FAIL，当前 snapshot 使用宽泛键匹配。

**Step 3: Write minimal implementation**

- 引入 snapshot `schemaVersion`。
- 先保留旧恢复器分支，再让新导出严格使用 Registry 白名单。
- 未登记键仅报告，不静默删除用户本地数据。

**Step 4: Run test to verify it passes**

Run: `node scripts/test-profile-snapshot-whitelist.mjs; node prj/profile_isolation_journey_simulation.mjs`

Expected: PASS，A/B 往返与旧快照兼容。

**Step 5: Commit**

```powershell
git add js/profiles.js js/profile-sync.js js/cloud-sync.js js/cloud-restore.js scripts/test-profile-snapshot-whitelist.mjs
git commit -m "fix: whitelist profile snapshot state"
```

### Task 4: `app.js` 服务边界第一轮拆分（`v0.7.39`）

**Files:**
- Create: `js/services/point-service.js`
- Create: `js/services/daily-state-service.js`
- Create: `js/services/game-bridge-service.js`
- Modify: `js/app.js`
- Modify: `js/runtime-loader.js`
- Test: `scripts/test-app-service-facades.mjs`

**Step 1: Write the failing test**

对三个服务写纯函数/最小 DOM-free 契约：发分不允许负 grant、每日状态按 localDate 读取、同 bridge 事件只被路由一次；旧 `window.addGrowthPoints` 仍可调用。

**Step 2: Run test to verify it fails**

Run: `node scripts/test-app-service-facades.mjs`

Expected: FAIL，服务模块不存在。

**Step 3: Write minimal implementation**

- 只抽取已由 WP1/WP3 稳定的逻辑，不移动页面模板或全局 UI。
- `app.js` 保留 facade，改为调用服务模块。
- runtime loader 在既有页面载入顺序中加入服务模块。

**Step 4: Run test to verify it passes**

Run: `node scripts/test-app-service-facades.mjs; node --check js/app.js; node scripts/test-pages-fast-gate-contract.mjs`

Expected: PASS。

**Step 5: Commit**

```powershell
git add js/services js/app.js js/runtime-loader.js scripts/test-app-service-facades.mjs
git commit -m "refactor: extract core app services"
```

### Task 5: Learning Attempt 与复习调度（WP7，`v0.7.40`）

**Files:**
- Create: `js/learning-attempts.js`
- Create: `js/review-scheduler.js`
- Modify: `js/english-vocab-progress.js`
- Modify: `js/hanzi-progress.js`
- Modify: `js/learn-center.js`
- Test: `scripts/test-review-scheduler.mjs`

**Step 1: Write the failing test**

为 correct、hint、wrong/lapse 编写固定时间夹具，断言首次学习、1/3/7 天到期、跨 Profile 隔离和旧 mastered 双写兼容。

**Step 2: Run test to verify it fails**

Run: `node scripts/test-review-scheduler.mjs`

Expected: FAIL，调度器不存在。

**Step 3: Write minimal implementation**

- 记录最小 Attempt：learner、contentId、kind、correct、hintLevel、occurredAt。
- 新状态区分 `provisional`、`retained`、`lapse`；旧 `mastered` 暂时双写。
- 先只做确定的 1/3/7 天规则，不引入 FSRS 或个性化模型。

**Step 4: Run test to verify it passes**

Run: `node scripts/test-review-scheduler.mjs; node scripts/test-english-vocab-profile-scope.mjs`

Expected: PASS。

**Step 5: Commit**

```powershell
git add js/learning-attempts.js js/review-scheduler.js js/english-vocab-progress.js js/hanzi-progress.js js/learn-center.js scripts/test-review-scheduler.mjs
git commit -m "feat: schedule learner review attempts"
```

### Task 6: GameResult v1 与儿童体验基线（WP8 + WP11，`v0.7.41`）

**Files:**
- Create: `js/game-result-contract.js`
- Modify: `js/app.js`
- Modify: `js/math-pk.js`
- Modify: `prj/消灭苦力怕打字游戏/web/game.js`
- Modify: `prj/单词记忆射击场原型/game.js`
- Modify: `css/style.css`
- Test: `scripts/test-game-result-contract.mjs`

**Step 1: Write the failing test**

断言三个游戏输出同一 schema：`schemaVersion`、`source`、`eventId`、`completedAt`、`score`、`stars`、`accuracy`；畸形 payload、来源伪造和重复结果均被拒绝。

**Step 2: Run test to verify it fails**

Run: `node scripts/test-game-result-contract.mjs`

Expected: FAIL，当前桥接 payload 不一致。

**Step 3: Write minimal implementation**

- 以适配器方式标准化现有消息，不改变各游戏玩法规则。
- 游戏页面增加统一暂停/退出、声音状态和 reduced-motion 尊重；不新增货币和排行榜。
- 宿主只消费已验证 GameResult，奖励仍由 WP3 receipt 决定。

**Step 4: Run test to verify it passes**

Run: `node scripts/test-game-result-contract.mjs; node scripts/test-static-route-entries.mjs`

Expected: PASS。

**Step 5: Commit**

```powershell
git add js/game-result-contract.js js/app.js js/math-pk.js prj/消灭苦力怕打字游戏/web/game.js prj/单词记忆射击场原型/game.js css/style.css scripts/test-game-result-contract.mjs
git commit -m "feat: standardize game result bridge"
```

### Task 7: 首页行动卡、可访问性与发布预算（WP12，`v0.8.0`）

**Files:**
- Create: `js/recommendation-service.js`
- Create: `scripts/test-pages-asset-budget.mjs`
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `css/style.css`
- Modify: `scripts/assemble-pages-artifact.mjs`
- Modify: `.github/workflows/deploy.yml`
- Test: `scripts/test-home-next-action.mjs`

**Step 1: Write the failing test**

为推荐服务建立 fixture：有到期复习时优先复习；否则显示今日任务；无任务时显示宠物照顾。再断言发布制品总大小、最大单文件和未引用资源报告满足预算。

**Step 2: Run test to verify it fails**

Run: `node scripts/test-home-next-action.mjs; node scripts/test-pages-asset-budget.mjs`

Expected: FAIL，推荐和预算报告不存在。

**Step 3: Write minimal implementation**

- 首页只新增一个“下一步”行动卡，保留原导航和入口作为回退。
- 添加键盘可达、200% 文本、移动布局与 `prefers-reduced-motion` 的契约/样式。
- 构建脚本输出资源清单与预算报告；CI 在组装前门禁该报告。

**Step 4: Run test to verify it passes**

Run: `node scripts/test-home-next-action.mjs; node scripts/test-pages-asset-budget.mjs; node scripts/test-pages-fast-gate-contract.mjs`

Expected: PASS。

**Step 5: Commit**

```powershell
git add index.html js/recommendation-service.js js/app.js css/style.css scripts/assemble-pages-artifact.mjs scripts/test-home-next-action.mjs scripts/test-pages-asset-budget.mjs .github/workflows/deploy.yml
git commit -m "feat: guide children to the next learning action"
```

## 每阶段发布核对

Run:

```powershell
node scripts/test-pages-fast-gate-contract.mjs
node --check js/app.js
node scripts/test-static-route-entries.mjs
node prj/runtime_loader_route_base_contract.test.mjs
node prj/route_aware_shell_contract.test.mjs
node prj/profile_isolation_journey_simulation.mjs
git diff --check
```

阶段附加测试必须在上述命令前执行。涉及 Pages 资源时，再运行：

```powershell
node scripts/assemble-pages-artifact.mjs _site_verify
```

检查对应 iframe、静态路由和新增运行资源确实出现在 `_site_verify/` 后，删除该临时目录或保持其被 `.gitignore` 忽略。

## 明确延期项

- WP9 云 revision/outbox：在快照白名单和服务端 API 完整性确认后单独设计，不放入静态网页重构提交。
- WP10 PK 服务端可信结果：依赖题集版本、nonce 与 Edge Function，不与本地 receipt 混做。
- PWA、复杂推荐、FSRS、框架迁移：只在状态、事件和体积预算稳定后评估。
