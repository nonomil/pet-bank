# 宠物积分系统 AGENTS 维护说明

> 本文件按 2026-07-12 当前工作树扫描得到。它描述的是“现在代码实际怎么跑”，不是产品愿景或历史设计。当前工作树原本就有大量未提交修改/删除；后续代理不得擅自回滚、清理或覆盖这些改动。

## 子代理口令路由

当用户的请求包含下列口令时，优先使用 Codex App 原生 `spawn_agent` 创建对应的自定义子代理。将口令之后的内容作为子代理任务；如果没有后续任务，先要求用户提供任务，不要自行修改文件。

| 用户口令 | 自定义子代理名 | 路由模型 |
| --- | --- | --- |
| `flash子代理`、`子代理flash` | `deepseek_flash_worker` | `deepseek-v4-flash` via `domestic_shim` |
| `glm子代理`、`子代理glm` | `glm_worker` | `glm-5-2` via `domestic_shim` |

路由规则：

1. 使用原生 `spawn_agent`，并以表中“自定义子代理名”创建子代理。
2. 不使用 `codex exec`、后台 CLI、直接 HTTP 或 shell 进程代替可视子代理。
3. 子代理启动后，报告实际创建的子代理名；不要仅根据口令宣称模型已被选择。
4. 如果当前宿主未暴露原生子代理工具或无法创建指定名称的自定义子代理，停止并报告该能力限制。
5. 对涉及写入、删除、发布、密钥或外部操作的任务，先遵守用户显式授权和适用的项目规则。

## 1. 项目边界与事实

- 产品当前是 Vanilla JS 静态 SPA：入口为 `index.html`，页面容器全部在 HTML 中，业务逻辑在 `js/`，样式在 `css/`，静态数据在 `data/`，素材在 `assets/`。
- 默认运行模式是浏览器本地优先模式：孩子端业务状态主要在 `localStorage`；家长设置页可选接入自托管账号、家庭和孩子映射，但不依赖云端才能运行离线玩法。
- GitHub Pages 的唯一制品入口是 `scripts/assemble-pages-artifact.mjs`。不要把整个 `prj/`、`docs/` 或临时目录直接当成发布目录。
- `prj/petbank-server/` 是 Node.js + `better-sqlite3` 的自托管后端，已实现 health、注册/登录/refresh、家庭/成员/邀请码、孩子档案和 revision 快照 API；`js/parent-account.js` 与 `js/profiles.js` 已接入家长账号/家庭/孩子管理和 Profile 启动恢复、切换/隐藏页上传。
- Supabase 运行时目录和旧 cloud/auth/social 文件已经移除；历史方案文档可以提到迁移背景，但不得重新引用为线上后端，也不得把历史文档中的 Supabase 能力当成已实现能力。
- `docs_project/` 是重要参考，但其中部分模块文档和行号滞后于当前工作树。遇到文档与代码冲突，以当前代码、`runtime-loader.js`、制品脚本和当前测试入口为准，并在任务结束时说明文档漂移。
- 文档分层要按读者使用：根 `README.md` 是项目/使用者介绍，`docs/README.md` 和 `docs/工程/` 是产品与工程审计、路线和自托管方案资料，`docs_project/` 是 Codex/开发者修改时使用的当前契约、runbook 和验证入口；三者都必须避免把目标能力写成已实现能力。

## 2. 如何运行与验证

```powershell
# 推荐本地静态服务；file:// 会导致 fetch JSON 失败
node scripts/local-server.mjs

# 快速检查
node scripts/smoke.mjs

# 当前回归入口；需要先启动上面的静态服务
node scripts/run-full-regression.mjs

# Pages 发布门禁/制品
node scripts/test-pages-fast-gate-contract.mjs
node scripts/test-static-route-entries.mjs
node scripts/assemble-pages-artifact.mjs _site_verify

# 后端仅做独立单测
node --test prj/petbank-server/test/*.test.mjs
```

Windows 双击 `启动服务.bat` 等价于在 `127.0.0.1:7000` 启动静态服务。浏览器 smoke/Playwright 测试可能依赖本机 Chrome、环境变量和临时目录；失败时区分“环境未满足”和“业务断言失败”。测试制品放 `tmp/`，不要写进发布文档或 `docs/releases/`。

## 3. 仓库地图

| 位置 | 当前职责 | 关键入口 |
| --- | --- | --- |
| `index.html` | SPA 壳、所有 page 容器、导航和大量 inline handler | `switchPage()`、`data-page`、`page-*` |
| `js/app.js` | 主编排器：任务、积分、页面激活、首页/积分/探索 UI、若干兼容存储；路由表和纯路径计算已移至 `page-router.js` | `switchPage`、`preparePage`、`addGrowthPoints`、`saveAppState` |
| `js/page-router.js` | 路由表、深层路径归一化、Pages 基址推断、设置路由和壳层分类；无 DOM 副作用 | `PetBankPageRouter` |
| `js/profile-storage-policy.js` | Profile 快照边界：排除设备、家长、账号和 Profile 元数据键；未知 `petbank_*` 默认保留 | `PetBankProfileStoragePolicy` |
| `js/runtime-loader.js` | 按页面加载 JS/CSS，解析深层路径资源基址，控制 feature 初始化 | `ensurePage`、`SCRIPT_BUNDLES`、`STYLE_BUNDLES` |
| `js/` | 核心业务模块和 window 全局 API | 见下方业务模块表 |
| `css/` | 全局样式、页面样式、动画、轻量 vendor 样式 | `style.css`、`learn-center.css` |
| `data/` | 宠物、战斗、场景、学习包、词库、故事和奖励等运行数据 | 多数由 `fetch()` 加载 |
| `assets/` | 图片、音频、战斗特效、学习资源和生成素材 | 由 HTML/JS/制品白名单引用 |
| `app/playground/` | 主站深层 playground 入口壳 | 多数页面实际逻辑仍在根 `js/` 或 `prj/` |
| `prj/` | 独立小游戏原型、资源流水线、契约测试、自托管后端 | 不是单一业务层，按子项目独立判断；`prj/petbank-server/` 另有账号/家庭/孩子/快照 API |
| `scripts/` | Pages 组装、词库/资源生成、smoke、回归和边界检查 | `run-full-regression.mjs` |
| `docs_project/` | 架构、数据契约、runbook、模块说明和审查记录 | 修改对应实现时同步维护 |

## 4. 启动链路与页面链路

1. `index.html` 先加载 `pet.js`、奖励服务、`scheduled-checkins.js`、`asset-loader.js`、`inventory.js`、`treasure.js`、`cloud-sync-outbox.js`、`profile-storage-policy.js`、`profiles.js`、`runtime-loader.js`、图标、战斗特效、`task-catalog.js`、`page-router.js`，再加载 `app.js`、`child-journey-feedback.js` 和 `showcase.js`。
2. `profile-storage-policy.js` 和 `page-router.js` 分别先注册 `PetBankProfileStoragePolicy`、`PetBankPageRouter`；前者定义 Profile 快照边界，后者只处理路由数据和路径计算，二者都不直接操作页面。`app.js` 初始化 profile、读取任务/积分/宠物状态，注册全局导航和渲染函数；页面切换仍由 `switchPage(pageName)` 统一编排。
3. 需要重资源的页面由 `runtime-loader.js` 串行加载 bundle：宠物/小屋、遛弯、卡牌收集、卡牌对战、探索、游乐场、学习、商城、复盘。
4. 深层 URL 由 Pages 制品脚本生成静态入口，再回到共享 `index.html`；因此资源路径必须经过 `window.resolvePetBankAssetUrl`，禁止写死站点根路径。
5. 页面之间没有正式的模块导入图。当前主要通信方式是 `window.ModuleName`、`window` 上的函数、DOM `onclick` 和少量浏览器事件；依赖缺失多靠 `typeof window.X === 'function'` 防守。

当前主要 page：

- 孩子主线：`map`、`today`、`learn`、`pet`、`explore`、`playground`。
- 宠物/冒险：`home`、`walk`、`card`、`shop`、`inventory`、`reward`。
- 学习/游戏：`learning-sheet`、`learn-pack`、`learn-plan`、`learn-lesson`、`learn-print`、`mathpk`、`hanzi`、`typing-defense`、`word-memory-map`、`learning-arcade`、`leaderboard`。
- 家长/复盘：`parent`、`settings`、`works`、`tools`、`review`。

## 5. 业务模块

| 领域 | 模块 | 核心事实/入口 |
| --- | --- | --- |
| 成长积分 | `app.js` | 六维任务：学习、运动、自控、探索、实践、守护；`petbank_points` 累积，任务状态按 profile + 本地日切 |
| 奖励闭环 | `core-reward-service.js`、`core-reward-feedback.js`、`task-reward-events.js`、`runtime-loader.js` 中的 game receipt | 统一奖励事件校验、receipt 防重复、结果展示；跨模块积分统一走 `PetBankPoints` |
| 宠物 | `pet.js`、`pet-care-daily.js`、`pet-growth-history.js`、`pet-evolution-preview.js` | `data/pets.json` 宠物目录；状态、经验、进化、衰减和照料 |
| 宠物空间 | `home.js`、`walk.js`、`travel-memory.js` | 小屋家具/主题、遛弯日志、旅行记忆和收藏 |
| 冒险战斗 | `exploration*.js`、`battle-engine.js`、`battle-fx.js`、`voice.js` | 场景/故事/数学反馈、通用战斗计算、语音和特效 |
| 卡牌 | `card-collection.js`、`card-arena.js`、`card-arena-ui.js` | 卡牌收集、套票奖励、2v2 对战和里程碑 |
| 学习中心 | `learn-center.js`、`english-vocab-progress.js`、`hanzi*.js` | 学习包目录、每日学习单、中文识字、英语词汇、测验和打印 |
| 游戏化学习 | `math-pk.js`、`leaderboard.js`、`app/playground/`、`prj/` 内原型 | 数学 PK、汉字、打字防线、像素探险、学习机玩法等；独立原型不等于主站模块 |
| 商店/库存 | `shop.js`、`inventory.js`、`treasure.js` | 积分兑换、盲盒、道具、宝箱和里程碑 |
| 家长/反馈 | `profiles.js`、`tools.js`、`family-review.js`、`child-journey-feedback.js`、`showcase.js` | 本地多孩子、导入导出、番茄钟、卡点复盘、成长作品 |
| 家庭账号 | `js/self-hosted-api.js`、`js/parent-account.js`、`profiles.js` | 家长注册/登录、refresh、家庭/邀请码、云端孩子映射；孩子玩法仍本地优先 |
| 自托管后端 | `prj/petbank-server/` | 配置校验、SQLite WAL/外键/追加迁移、认证、家庭、孩子、revision 快照 API；社交未实现 |

## 6. 核心层规矩

### 6.1 数据访问

- 浏览器运行时的事实来源是 `localStorage`；业务 key 必须使用 `petbank_` 前缀，并登记在 `docs_project/data-contracts/localstorage-keys.md`。
- `petbank_points`、`petbank_pet`、`petbank_cards`、`petbank_inventory`、`petbank_tasks_completed_today`、`petbank_daily_state`、学习/数学/排行榜进度是高风险共享数据。修改前先查所有读写者，不能只改一个模块。
- 旧代码仍有大量直接 `localStorage.getItem/setItem`。新代码优先通过所属模块公开 API；确需共享时集中定义 key、解析器、默认值和迁移策略，禁止再扩散裸读写。
- `ProfileManager` 使用“按快照策略遍历 `petbank_*` 业务键 → 写入 `petbank_profile_data_{id}` → 清空当前 Profile 键 → 恢复目标快照 → reload”的 swap 方案。`profile-storage-policy.js` 排除设备、家长、账号和 Profile 元数据；未知 `petbank_*` 默认会被纳入，因此不要把账号、配置或第三方数据混进业务前缀，并要同步 registry 与策略测试。
- Profile 快照不是强类型数据库：旧 key、漏迁移、模块内存状态和非前缀 key 都可能造成隔离漏洞。涉及 profile 的改动必须跑 `profile_isolation_journey_simulation` 和英语词汇隔离测试。
- `data/*.json`、学习包和词库是发布时的静态内容，加载必须检查 `response.ok`，使用 `resolvePetBankAssetUrl`，解析失败给明确 fallback/用户提示。
- `data/vocab/**/*.db` 是构建/运行数据，不要把 SQLite 词库和自托管账号库混为一层。词库生成脚本要和生成 JSON/manifest 一起验证。
- 学习中心 `LearnCenter.completeLesson()` 必须按“先写 `petbank_learning_progress`、再写 `petbank_learning_rewards`、最后经 `PetBankPoints.add()` 发积分”的顺序结算；任一步持久化失败都不能显示完成或发分。英语词卡由 `EnglishVocabProgress` 管理 Profile 作用域键，`record()`/兑换券写入失败必须返回可观察失败，不得继续推进 UI。
- 后端 SQLite 数据只能留在自托管共享目录；生产 `PETBANK_DATA_DIR` 和 JWT secret 必须来自安全环境。迁移只追加新 SQL，不能改写已发布迁移。账号/家庭/孩子管理可以报告 API 成功；只有实际完成快照 push、revision 校验和恢复验证后，才能报告“云端状态已同步”。
- `petbank_self_hosted_access_token`、`petbank_self_hosted_refresh_token`、`petbank_self_hosted_api_base_url` 是连接凭证/配置，不属于孩子业务快照；Profile swap 不得清空或迁移它们。`ProfileManager` 在启动恢复、孩子切换、页面隐藏/退出前调用快照同步；网络失败仍保留本地离线状态并提示可重试。

### 6.2 时间与生命周期

- 日期身份必须使用本地日历日期，不要用 `toLocaleDateString()` 或 `toDateString()` 生成跨模块业务 key。新逻辑统一使用 `window.PetBankTime.localDate()`；`PetBankDailyState` 负责每日任务/宝箱状态，不再各自实现日期算法。
- `Date.now()` 统一表示毫秒时间戳；`toISOString()` 只用于审计/记录时间；展示时间再转本地格式。`PetSystem` 的衰减内部使用 Unix 秒，调用边界不能把秒和毫秒混算。
- 当前历史实现仍不统一：兼容键仍可能使用本地化日期字符串，部分日志仍保留旧 `toDateString()` 值，竞技场也有历史日期字段；修改相关逻辑时要保持兼容迁移，禁止新增第四种格式。新业务日键只允许 `PetBankTime.localDate()` 输出的 `YYYY-MM-DD`。
- 每日状态必须带 `date` 和 `profileId`，跨日重置要保留累计积分；每日宝箱、遛弯、竞技场限制、学习单不能互相复用不兼容的日期字段。
- 所有 `setTimeout`/`setInterval` 都要说明生命周期；页面切换或 profile reload 后不得让旧异步回调污染新页面。使用 `app.js` 的 page activation token 或在模块中保存并清理 timer/abort controller。汉字、数学 PK、卡牌对战分别通过 `HanziGame.stop()`、`MathPKGame.stop()`、`CardArenaUI.stop()` 接收离页清理；新增玩法必须提供同等 owner 级清理入口。
- 游戏计时、动画延时和业务日切是三种不同概念：不能用 UI timer 当业务结算依据；奖励结算必须以事件 receipt 和明确事件 ID 去重。

### 6.3 错误处理

- 用户主动操作失败：给 `showToast` 或页面内明确反馈，并保留可定位原因。
- 非关键异步资源失败：`console.warn('[ModuleName] ...', error)`，给 fallback 或禁用对应入口；不能假装加载成功。
- JSON/localStorage 解析失败：只在可恢复读取处 `try/catch` 并返回 schema 合法的默认值；写入失败要返回失败结果或提示。
- 业务状态变更、奖励、购买、导入恢复失败不能使用空 `catch {}` 静默吞掉；必须让调用者知道没有完成。
- `fetch` 必须检查 `response.ok` 后再解析；网络失败和内容格式失败要区分日志。
- 致命初始化错误不要吞掉。错误日志统一带模块前缀，避免只输出裸 `error`。
- 当前代码的五种旧模式（空 catch、warn、fallback、toast、未处理）并存；这是债务，不是新代码规范。修旧代码时优先删空 catch，而不是扩大静默范围。

### 6.4 模块与页面通信

- 现有约定是 IIFE/命名空间 + `window` 暴露。新模块必须使用唯一 PascalCase 命名空间，不得新增散落的 `window.foo` 全局。
- 页面/模块调用可选依赖前用 `typeof window.X === 'function'`，但核心依赖缺失不能静默跳过，应让 runtime loader 失败并显示提示。
- 新页面逻辑接入 `runtime-loader.js` 的 bundle；脚本顺序是契约，依赖脚本必须先加载，不能依赖偶然的 DOM 或网络顺序。
- 新路由必须同时考虑 `switchPage`、page 容器、runtime bundle、深层静态入口、相对资源基址和对应 contract test。
- HTML 目前大量使用 inline `onclick`，不要在单次改动里顺手全量迁移事件系统；如新增行为，至少保持命名空间清晰，并避免给同一动作增加第二套入口。

### 6.5 奖励与积分

- 奖励事件要有稳定的 `eventId`、`profileId`、`source` 和合法 reward 类型；同一事件重复触发必须返回 duplicate，不得二次加分。
- `window.PetBankPoints` 是跨模块唯一积分 API：读取用 `get()`，增加用 `add()`，消费用 `spend()`，惩罚扣减才用 `deduct()`；`app.js` 的 `addGrowthPoints` 仅保留为主编排器和兼容宿主入口。
- 新玩法奖励优先走 `CoreRewardService`/`GameRewardReceipts`，再由 `PetBankPoints` 实际落值；不要在新模块内直接改 `window.totalPoints`、`petbank_points` 或另造积分账本。
- `petbank_task_reward_events_v1` 是可逆任务操作记录，不等于积分账本；记录事件和修改余额必须分清。
- 购买、宝箱、卡牌套票、游戏结算都要验证余额/库存/receipt 的原子顺序，失败不能只更新 UI。

## 7. 当前明显技术债（按风险，不是建议现在立刻重写）

### P0：改动前必须先理解

1. `js/app.js` 约 4,390 行，仍是任务、积分、页面激活、渲染、事件、存储和兼容逻辑的上帝模块；路由纯计算已拆出，但任何页面生命周期改动仍容易影响全站。
2. `js/learn-center.js` 约 3,656 行、`js/math-pk.js` 约 1,815 行、`js/card-arena-ui.js` 约 1,515 行；大型 UI/状态/结算逻辑混合，先找入口和持久化再改。
3. 没有正式 ES module/type/lint/build 层，40+ JS 文件靠全局命名和加载顺序连接；`PetBankPageRouter`、`PetBankRuntime` 和其他命名空间是当前显式边界，重命名或调整 bundle 比普通函数改动风险高。
4. localStorage 仍没有统一 DAO/schema/version 层，Profile 已有显式非 Profile 排除策略但未知 key 仍靠动态快照兜底；共享 key、schema 和 profile 隔离是数据一致性的最大风险。
5. 奖励层已完成主要玩法的统一入口收口，但 `app.js` 仍保留旧兼容函数和历史测试直接读写 `petbank_points`；新增玩法必须只使用 `PetBankPoints`，防止重新出现第二账本。
6. 时间格式和单位不统一，日切、宠物衰减、战斗计时混在不同模块；时间相关 bug 往往是跨模块 bug。
7. 自托管 API 与前端账号 UI 已接通，snapshot push/pull 已接入 Profile 切换、启动恢复和页面生命周期；当前仍没有离线 outbox、后台重试队列和多端合并策略。

### P1：持续制造开发成本

1. `css/style.css` 约 6,635 行、`css/learn-center.css` 约 3,633 行；样式、页面结构和状态类耦合，改 UI 要做深层路由/移动端验证。
2. `index.html` 约 1,458 行且包含大量 inline handler；页面结构、导航和行为边界没有清晰分层。
3. `app.js` 在运行时注入战斗 CSS；新增样式优先放对应 CSS 文件，避免继续扩大隐藏副作用。
4. `prj/` 同时承载原型、资源、生成脚本、验证脚本和独立后端；不能根据目录大小批量清理，必须按制品引用和子项目说明判断。
5. 生成数据、原始素材、缓存、截图和正式运行资源并存；遵守 `docs_project/PROJECT-BOUNDARIES.md`，尤其不要删除 `assets/`、`data/`、`prj/` 中未提交文件。
6. `docs_project` 的部分旧模块文档仍指向已删除的云端文件、旧行号或旧测试清单；文档同步规则本身也需要后续校正，不能机械相信行号。

### P2：工程治理缺口

- 根目录没有统一 `package.json`、依赖锁定或 lint/format；只有 `prj/petbank-server/package.json` 管理后端依赖。
- JavaScript 缺少类型和稳定 schema 校验，数据字段主要靠约定。
- CSS、HTML、JS 中英文和历史命名混杂；不在无关任务中做大范围风格重构。
- Supabase 历史迁移文档会造成架构误判；自托管 API 文档、前端接入状态和“自动同步是否完成”必须保持单一事实。

## 8. 修改流程

1. 先读本文件，再读目标模块的 `docs_project/modules/`、数据契约和相关 runbook；文档与代码冲突时记录并以代码为准。
2. 修改前检查 `git status --short`，保留用户未提交改动；禁止 `git reset --hard`、`git checkout --`、`git clean -fdx` 和无确认批量删除。
3. 涉及存储、日期、奖励、profile、路由、发布白名单或后端迁移时，先列出读写者/入口/迁移兼容性，再编辑；新路由优先改 `page-router.js`，Profile 边界优先改 `profile-storage-policy.js`，页面副作用留在 `app.js`。
4. 新增 `localStorage` key、页面路由、runtime bundle、数据字段、测试脚本时，同步更新对应 `docs_project` 契约和 runbook。
5. 代码改完按影响范围验证：至少跑对应 contract/simulation；全局改动跑 `run-full-regression.mjs`；发布相关改动额外组装制品并检查深层入口。
6. 汇报时区分：当前实现、历史残留、未实现计划、因脏工作树无法确认的内容；不要把“文档写了”当成“功能已经上线”。

## 9. 受保护的边界

- 不把真实 `.env`、JWT、数据库、备份、浏览器 profile 或测试制品提交到 Git。
- 不把 `tmp/`、`_site*`、`_pages_test_root/`、参考资料和原始素材直接发布。
- 自托管发布必须先组装并验证新 release，再切换 `current`；数据库在 `/srv/pet-bank/shared/`，不能放 release 目录。
- 数据库迁移只追加；账号、家庭、孩子、邀请 API 已接入前端时仍需保持离线降级；快照自动同步已有权限、revision、恢复和端到端测试，新增 outbox 或复杂合并仍需单独验证。
- 清理动作必须有未引用证据、可恢复来源和用户授权；“看起来像缓存/屎山”不是删除依据。
