# 宠物积分系统（成长伙伴·萌宠冒险岛）架构总览

> 当前基线：2026-07-12 工作树扫描。本文描述当前代码实际可运行的形态；产品愿景、历史方案和未接入能力必须单独标注。长期维护规则见仓库根目录 `AGENTS.md`。

## 1. 当前结论

- 产品是无框架、无构建、无转译的 Vanilla JS SPA，入口是 `index.html`。
- 主站默认是本地优先模式：业务状态在浏览器 `localStorage`，静态内容由 `fetch()` 读取 JSON/词库资源。
- `runtime-loader.js` 根据页面按需串行加载 JS/CSS，主站模块通过 `window` 命名空间和少量 DOM/浏览器事件通信。
- GitHub Pages 通过 `scripts/assemble-pages-artifact.mjs` 组装白名单制品；`prj/` 不是可整体发布的运行目录。
- `prj/petbank-server/` 是自托管 Node.js + SQLite 服务，已实现 health、账号认证、家庭/邀请码、孩子档案和 revision 快照 API；前端家长设置页与孩子 Profile 的启动恢复、切换/隐藏页上传已接入运行生命周期。
- 当前工作树的 Supabase、旧账号、家庭、社交和云同步运行时已经移除；相关文档仅可作为迁移历史或目标合同，不能当作现行功能。

## 2. Repo Map

| 区域 | 职责 | 关键文件 |
| --- | --- | --- |
| 应用壳 | 页面容器、导航、深层路由入口、inline handler | `index.html` |
| 路由边界 | 路由表、深层路径归一化、Pages 基址推断、壳层分类 | `js/page-router.js` |
| 主编排 | 积分、页面准备、页面激活、主站桥接 | `js/app.js` |
| 任务目录 | 六维任务、首页优先任务、任务配图纯函数 | `js/task-catalog.js` |
| 按需加载 | feature bundle、资源基址、加载去重、入口失败反馈 | `js/runtime-loader.js` |
| 核心状态 | 宠物、档案、库存、宝箱、奖励、成长历史 | `js/pet.js`、`js/profiles.js`、`js/inventory.js`、`js/treasure.js`、`js/core-reward-service.js` |
| 宠物与冒险 | 小屋、遛弯、旅行记忆、探索、战斗、卡牌 | `js/home.js`、`js/walk.js`、`js/travel-memory.js`、`js/exploration*.js`、`js/card-*.js` |
| 学习系统 | 学习包、学习单、汉字、英语、数学、复盘 | `js/learn-center.js`、`js/hanzi*.js`、`js/english-vocab-progress.js`、`js/math-pk.js`、`js/family-review.js` |
| 游乐场 | 主站入口和独立小游戏运行时 | `app/playground/`、`prj/` 中各原型 |
| 内容数据 | 宠物、场景、故事、学习包、词库、题目和物品 | `data/` |
| 素材 | 图片、声音、战斗特效、生成资源 | `assets/`、部分 `prj/*/assets/` |
| 构建与验证 | Pages 制品、词库生成、smoke、contract、回归 | `scripts/`、`prj/*test*.mjs` |
| 自托管后端 | SQLite 数据库、认证、家庭/孩子和增量快照 API | `prj/petbank-server/`、`docs_project/runbooks/self-hosted/` |

## 3. 启动与运行链路

### 3.1 首屏启动

`index.html` 首先加载 `pet.js`、奖励服务、`inventory.js`、`treasure.js`、`profiles.js`、`runtime-loader.js`、图标/战斗特效、`task-catalog.js` 和 `page-router.js`，再加载 `app.js`，最后加载成长反馈与作品展示模块。`page-router.js` 只暴露 `PetBankPageRouter`，不直接操作 DOM；`app.js` 初始化 profile、读取本地状态并暴露 `switchPage`、`addGrowthPoints`、`saveAppState` 等兼容入口。任务目录只通过 `PetBankTaskCatalog` 注入，不在主编排器内重复定义。

### 3.2 页面按需加载

页面切换仍由 `switchPage(pageName)` 编排，随后调用 `preparePage()`/`PetBankRuntime.ensurePage()`。当前 bundle 大致为：

| 页面/入口 | 运行时依赖 |
| --- | --- |
| `map`、`today`、`reward`、`inventory`、`works`、`settings` | 首屏核心脚本 |
| `pet` | 宠物目录加载 |
| `home` | 宠物照料、成长历史、旅行记忆、小屋 |
| `walk` | 遛弯样式与模块 |
| `card` / 卡牌对战 | 卡牌收集、通用战斗、竞技场 UI、音效 |
| `explore` | 语音、通用战斗、场景/章节/进度/详情 |
| `playground`、`mathpk`、`hanzi`、`leaderboard`、`tools` | 数学、排行榜、汉字、家长工具 |
| `learn-*`、`learning-sheet` | 英语 scope、学习中心及学习包 |
| `review` | 本机成长复盘 |

资源路径必须经 `window.resolvePetBankAssetUrl()` 解析，以支持根路径、GitHub Pages 子路径和深层 URL。加载脚本使用 `async=false` 和 Promise 去重来维持依赖顺序。

### 3.3 Pages 制品链路

`assemble-pages-artifact.mjs` 复制 `index.html`、`css/`、`js/`、`assets/`、`data/`、`app/`，再对学习机、像素探险、打字防线使用独立白名单复制。它还生成静态路由入口并修正像素探险发布资源。修改 `prj/` 或生成素材时，必须检查该脚本的 allowlist 和对应制品测试。

## 4. 业务模块

| 领域 | 当前模块 | 主要状态/输出 |
| --- | --- | --- |
| 任务积分 | `app.js` | 六个成长维度；`petbank_points` 持续累积；每日任务状态由共享日状态合同管理 |
| 奖励闭环 | `core-reward-service.js`、`core-reward-feedback.js`、`task-reward-events.js`、`GameRewardReceipts` | 校验 source/reward、receipt 去重、反馈卡和任务操作记录；旧玩法仍有兼容积分入口 |
| 宠物养成 | `pet.js`、`pet-care-daily.js`、`pet-growth-history.js`、`pet-evolution-preview.js` | `data/pets.json` 目录、经验、进化、照料、衰减和历史 |
| 宠物空间 | `home.js`、`walk.js`、`travel-memory.js` | 小屋家具/主题、遛弯日志、旅行记忆和收藏 |
| 探索战斗 | `exploration*.js`、`battle-engine.js`、`battle-fx.js`、`voice.js` | 场景、章节故事、数学反馈、通用战斗、语音、特效 |
| 卡牌 | `card-collection.js`、`card-arena.js`、`card-arena-ui.js` | 图鉴、系列套票、2v2 PvE、里程碑和本地卡牌进度 |
| 学习中心 | `learn-center.js`、`hanzi*.js`、`english-vocab-progress.js` | 学习包、学习单、测验、汉字进度、英语词汇和打印 |
| 游戏化学习 | `math-pk.js`、`leaderboard.js`、`app/playground/`、`prj/*原型` | 数学 PK、汉字、打字防线、像素探险、学习机等；原型与主站职责分开 |
| 商店与背包 | `shop.js`、`inventory.js`、`treasure.js` | 兑换、盲盒、库存、装备、日常/探索/里程碑宝箱 |
| 家长与复盘 | `profiles.js`、`tools.js`、`family-review.js`、`child-journey-feedback.js`、`showcase.js` | 本地多孩子、导入导出、番茄钟、卡点复盘、成长作品 |
| 家庭账号 | `self-hosted-api.js`、`parent-account.js`、`profiles.js` | 家长注册/登录、refresh、家庭/邀请、孩子映射；失败时保留本机档案 |
| 账号后端 | `prj/petbank-server/` | SQLite WAL、外键、追加迁移、认证、家庭、孩子、revision 快照；好友/社交未实现 |

## 5. 核心流程

### 5.1 今日任务 -> 积分 -> 宠物反馈

```text
index.html / today
  -> app.js toggleTask / addGrowthPoints
  -> PetBankDailyState 读取 YYYY-MM-DD + active profile
  -> localStorage: daily_state + points + task event
  -> updateStats / PetSystem.addExp / 首页和宠物反馈
```

每日任务和日常宝箱已经共用 `PetBankDailyState`。`petbank_completed`、`petbank_tasks_completed_today`、`petbank_daily_claim_date` 仍作为旧兼容键存在，不能直接删除。

### 5.2 学习/游戏 -> 奖励 receipt -> 复盘

```text
learn-center / math-pk / iframe game
  -> 产生带 profileId + source + eventId 的结果
  -> CoreRewardService 或 GameRewardReceipts 去重
  -> addGrowthPoints / 宠物经验等既有业务 API
  -> task/reward history + feedback + family-review 本机聚合
```

当前已防住部分刷新、重复 iframe 消息和重复结算；仍需继续收口所有直接改余额的旧路径，并定义单局/每日经济策略。

### 5.3 Profile 切换 -> 快照 -> reload

```text
ProfileManager.switchTo
  -> 枚举所有 petbank_* 业务键
  -> 保存 petbank_profile_data_{id}
  -> 清空业务键并恢复目标快照
  -> location.replace(shellUrl)
  -> 模块重新从 localStorage 初始化
```

这是兼容性方案，不是强类型存储层。非 `petbank_` 键、模块内存状态和未登记 key 可能逃逸，后续要用 registry + 白名单替代隐式全量快照。

### 5.4 家长账号 -> 家庭/孩子映射

```text
settings/family
  -> ParentAccountUI
  -> SelfHostedApi register/login/refresh
  -> Node.js API -> SQLite accounts/households/children
  -> ProfileManager.linkCloudChild(localProfileId, cloudChildId, householdId)
```

当前链路能完成账号、家庭、邀请和孩子档案管理；`ProfileManager` 已在启动恢复、切换前上传、切换后恢复和页面隐藏/退出时调用 `SelfHostedApi.latestSnapshot/pushSnapshot`。网络失败会进入按孩子合并的本地 outbox 并退避重试，revision 冲突会在家长设置页提供本地保留、采用云端和导出备份；当前仍没有多端自动合并策略。

## 6. 核心约定

### 数据访问

- 浏览器主存储是 `localStorage`，业务 key 统一 `petbank_` 前缀；新增/变更必须更新 [localstorage-keys.md](data-contracts/localstorage-keys.md)。
- 新代码优先调用所属模块 API，不新增裸 `getItem/setItem`；共享状态必须有 owner、schemaVersion、迁移和 profile scope。
- 静态 JSON/词库使用 `resolvePetBankAssetUrl` + `response.ok` + schema/fallback；`file://` 不是受支持运行方式。
- SQLite 只属于自托管后端共享数据目录；前端可报告账号/家庭/孩子 API 和基础快照 push/pull 的明确成功响应，但不能把单一 revision 上传误写成已具备离线队列或多端合并能力。

### 时间

- 业务日键使用本地 `YYYY-MM-DD`；优先调用 `window.PetBankDailyState.localDate()`。
- `Date.now()` 是毫秒；`toISOString()` 用于审计；`PetSystem` 衰减内部使用 Unix 秒，边界不能混算。
- 宝箱/旧兼容键仍使用本地化日期字符串，遛弯/竞技场也有历史格式；新逻辑不得新增格式，迁移应兼容旧值。
- 业务结算不能依赖 UI timer；页面异步回调使用 activation token/取消机制避免污染新页面。

### 错误与通信

- 用户操作失败：`showToast` 或页面内反馈。
- 可恢复读取失败：带模块前缀 `console.warn` + 合法 fallback。
- 关键状态变更、奖励、购买、导入失败：不得空 catch，必须返回失败或抛出。
- fetch 必须检查 `response.ok`；核心初始化依赖缺失不能静默跳过。
- 现有模块用 IIFE/命名空间 + `window` API 互调；新模块只暴露一个唯一 PascalCase 命名空间，不继续增加散落全局。

## 7. 技术债与优化入口

| 优先级 | 问题 | 证据/影响 |
| --- | --- | --- |
| P0 | `app.js` 约 4,390 行，仍承担编排、领域逻辑、UI、存储和兼容；纯路由计算已拆到 `page-router.js` | 页面生命周期和共享状态改动的 blast radius 仍最大 |
| P0 | `learn-center.js` 约 3,656 行；`math-pk.js` 约 1,815 行；`card-arena-ui.js` 约 1,515 行 | 状态、结算和 UI 混合，难测 |
| P0 | localStorage 虽已有 registry 和迁移门禁，但 Profile 仍使用动态全量快照 | 未登记 key、模块内存状态和快照 schema 仍可能造成隔离/恢复边界问题 |
| P0 | 奖励层已部分统一，但旧模块仍可直接调整余额 | 需要彻底阻断重复奖励 |
| P0 | 自托管账号/家庭/孩子 API 与 Profile 快照生命周期已接入，outbox 和冲突处理已实现 | 仍不能把 revision 上传当成多端自动合并；冲突需要家长明确选择 |
| P1 | 日切格式、秒/毫秒、timer 生命周期不完全统一 | 跨模块时间 bug |
| P1 | `style.css` 约 6,635 行、`learn-center.css` 约 3,633 行；HTML 约 1,458 行 | 样式和结构耦合 |
| P1 | `prj/` 混合原型、生成物、测试和独立后端 | 清理/发布容易误删或误发 |
| P2 | 根目录无统一 package/lint/type/schema 门禁，模块文档行号会漂移 | 工程反馈慢 |

详细方案见 [当前扫描与优化方案](../docs/方案/项目路线/07-当前扫描与优化方案-2026-07-12.md)。不建议当前阶段做 React/Vue/TypeScript 全量重写；先在现有静态架构中收口数据、时间、奖励和验证边界。

## 8. 修改与验证

1. 先读 `AGENTS.md`、本页、目标模块文档和数据契约；代码与旧文档冲突时记录漂移并以代码为准。
2. 修改前检查 `git status --short`，保留已有未提交/已暂存改动。
3. 存储、时间、奖励、profile、路由、发布白名单和后端迁移属于高风险改动，先列读写者/入口/迁移兼容性。
4. 新增 key/路由/bundle/数据字段/测试必须同步对应契约和 runbook。
5. 按影响范围运行 contract/simulation；全局改动运行 `node scripts/run-full-regression.mjs`；发布改动额外组装制品并检查深层入口。
