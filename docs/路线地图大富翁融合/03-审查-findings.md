# 路线地图螺旋圈 + 骰子推进 · 历史审查 findings

> 归档说明：本文件审查的是早期“螺旋圈 + 骰子推进”方案，用来保留为什么后来选择收口的证据。
> 当前现行方案已切换为 [04-方案-大富翁融合.md](./04-方案-大富翁融合.md) 中的轻量多圈层重构。
> 审查对象：`docs/方案/2026-07-02-路线地图螺旋圈骰子-方案.md`
> 需求基线：`docs/plans/2026-07-02-路线地图螺旋圈骰子-需求.md`
> 模式：只读审查，未改动任何代码/文档。
> 审查日期：2026-07-02

---

## F1 · 积分钩子位置引用错误（HIGH）

- **类别**：改动点准确性 / 链路完整性
- **严重度**：high
- **问题**：方案 §2.3 + §3 改动点清单声称「积分钩子挂在战斗结果回调，候选在 [exploration.js:443-469] 胜利分支附近」，并把它当成一个可直接下钩的「回调」。事实是 `exploration.js:442-469` 是 **`battleTurn()` 引擎内部的胜负判定块**，不是一个独立的「结果回调函数」。它在 `battleTurn` 内 push 日志、加 EXP、掉落，然后 `return battle`，由调用方决定如何处理。
- **证据**：
  - `js/exploration.js:442-470` —— 胜利判定在 `battleTurn` 内，无独立「结果回调」函数。
  - `js/exploration.js:481-484` —— 失败（`status='lost'`）也在 `battleTurn` 内设置。
  - 真正消费胜负状态、做 UI 切换/掉卡/结束叙事的「结果处理」分散在 **3 处**：
    - `js/app.js:1217-1253`（`battleAction` 普攻/技能/逃跑路径）
    - `js/app.js:1343-1350`（`useItemInBattle` 道具路径）
    - `js/app.js:1358-1376`（`closeBattleModal` → galgame 探索走 `ExplorationDetail.showEnding`/`exit`）
- **影响**：执行者按方案去找「exploration.js 回调」会扑空；即便在 `battleTurn` 内加分，会触发 **按序模式也重复奖励**（违背方案自己 §2.3 末「按序模式不触发积分奖惩」的约束）。
- **建议**：
  - 把钩子从「引擎内」改到「结果消费层」——在 `app.js` 的 `battleAction`/`useItemInBattle`/`closeBattleModal` 三处统一收口（或抽一个 `applyDiceOutcomeRewards(status)` 适配函数）。
  - 引擎 `battleTurn` **不要**直接动积分，否则按序入口（`goExplore` → galgame `triggerBattle` / 非 galgame `exploreScene`）会被误伤。
  - 必须区分 galgame 入口（`ExplorationDetail.show`）与非 galgame 入口（`exploreScene`），二者战斗结束路径不同，单一钩子覆盖不全。

## F2 · 双入口 boardId 判断成立，但 tryUnlock 注入会破图（HIGH）

- **类别**：改动点准确性 / 兼容性
- **严重度**：high
- **问题**：方案 §2.2 依据 `boardId === 'sceneGrid'`(探索 tab) 渲染骰子按钮、首页 `'sceneGridMap'` 不渲染。代码确认 `renderSceneGridMap(activeSceneId=null, boardId='sceneGridMap')` 双参签名存在，app.js 调用一为 `renderSceneGridMap()`（默认首页，line 514/1495），一为 `renderSceneGridMap(selectedSceneId, 'sceneGrid')`（line 1023）——**判断本身成立**。
  但：`exploration.js:225` 的 `tryUnlock(sceneId)` 在解锁成功后调用 `renderSceneGridMap(sceneId)`，**只传 activeSceneId、丢掉 boardId** → 强制落回首页 board。后果：用户在**探索 tab** 内解锁一个场景后，`#sceneGrid` 容器被清空重渲到 `#sceneGridMap`，探索 tab 的地图直接消失（bug）。这是**现状代码已存在**的脆弱点，方案若在该函数里再注入骰子按钮（按 boardId），`tryUnlock` 这条路径会被方案新逻辑放大暴露。
- **证据**：
  - `js/exploration.js:177` `renderSceneGridMap(activeSceneId = null, boardId = 'sceneGridMap')`
  - `js/exploration.js:225` `renderSceneGridMap(sceneId);` （丢 boardId）
  - `js/app.js:1023` `ExplorationSystem.renderSceneGridMap(selectedSceneId, 'sceneGrid');`
- **建议**：方案须显式列出「tryUnlock 修复」为前置改动点（S0/前置依赖），让 `tryUnlock` 持有/透传当前 boardId，或改为重渲前记 `lastBoardId`。否则 S6「首页 vs 探索 tab 差异」验证时这个 bug 会被归咎到新骰子逻辑。

## F3 · 螺旋算法在小屏会严重挤压，缓解不可操作（HIGH）

- **类别**：螺旋算法可行性 / NFR1/NFR3
- **严重度**：high
- **问题**：现状 `.map-scene-node` 卡片宽度 = `var(--node-size, 190px)`（当前 174–198px），`.map-scene-thumb height=128px`，`transform: translate(-50%,-50%)`。卡片是**固定像素宽**，而坐标是**百分比**。`.map-board min-height: 980px`（css:284）。阿基米德螺旋 r=a+bθ 把 12 个点塞进 5%–95% 半径圈，越往中心点间距越小（中心圈周长 = 2π·r_小，相邻点角间距 × r_小 → 像素间距可能 < 卡片宽度）。
  - 例：中心 r=5%（≈49px on 980px 高度），3 个点挤在中心圈时，3×190px 卡片互相覆盖。
  - 首页 `.map-board` 宽度等于首页列宽（窄），探索 tab `.map-board` 宽度不同，同一螺旋百分比布局在两处视觉效果不一致。
- 方案 §5 缓解只写「S1 截图审查门禁；必要时加缩放/拖动」——**截图门禁只是发现，不是缓解**；「缩放/拖动」是 P2 级增量，本轮 NFR1 要求「螺旋圈在小屏不挤作一团」是 P0。
- **证据**：`css/style.css:282-285`（min-height 980px）、`css/style.css:316-322`（width var(--node-size,190px)）、`js/exploration.js:7-19`（size 174–198）。
- **建议**：
  - 方案须给出**具体防重叠策略**：①中心 3–4 个点强制最小角间距 + 手调坐标；或②外圈采样密、内圈采样疏（r 非线性）；或③卡片在螺旋节点上**按位置缩放 size**（外圈大、内圈小到 120px）。
  - 必须在 S1 同时验证**首页 + 探索 tab 两个 board 宽度**的截图，方案目前只说「双入口」未说分别截图。
  - 「缩放/拖动」要么显式纳入本轮 scope（追加到改动点 + Step），要么从风险缓解里删掉、改写为「不达可读性则回退散点」。

## F4 · 角色位置状态持久化方案含糊（MEDIUM）

- **类别**：链路完整性 / 状态持久化
- **严重度**：medium
- **问题**：方案 §5 写「复用现有 `unlockedScenes`/进度存储，不新引入存储」，§2.2 写「角色位置 = 当前螺旋节点」。但现状 `unlockedScenes`（`petbank_unlocked_scenes`）只存「是否解锁过的布尔字典」，**没有「角色当前在哪个场景」的字段**。`MAP_LAYOUT` 没有 `currentIndex`，`activeSceneId` 仅作 UI 高亮用、每次渲染被重置。
  方案没说明：①「当前位置」存到哪个 localStorage key；②切回首页再切到探索 tab 时角色位置如何恢复；③骰子推进后角色停在 A，用户又点按序 `goExplore` 进入 B，下次骰子的「当前位置」是 A 还是 B；④多宠物 / 多存档时怎么处理。
- **证据**：`js/exploration.js:31,46-56`（unlockedScenes 仅布尔）；`js/exploration.js:177`（activeSceneId 为渲染入参，无持久化）。
- **建议**：方案 §2.2 须明确「角色位置」=新增 `localStorage['petbank_map_pos']`（存 sceneId 或 layout index），并定义与按序模式的同步规则（如：按序进入某场景后，角色位置也更新到该场景）。否则 S3「骰子推进逻辑」无法独立验证。

## F5 · 「无怪 +15 积分」判定时机不明（MEDIUM）

- **类别**：链路完整性 / 数值平衡
- **严重度**：medium
- **问题**：方案 §2.3 称「无怪 → 安全通过 → +15 积分（视为成功）」。现状 `startExploration`（exploration.js:297-304）对无怪场景直接 `addExp` 并 `return {success, msg, leveled_up}`，**不返回 `battle`**。这意味着无怪场景的「+15 积分」钩子不在「战斗结果回调」（根本没战斗），必须挂在 `startExploration` 的无怪分支或其调用方。
  - 又因 `startExploration` 被 `exploreScene`（app.js:1048）和 `ExplorationDetail.triggerBattle`（exploration-detail.js:262）**两处**调用，挂引擎会被按序模式误伤，挂 UI 层要改两处。
- **证据**：`js/exploration.js:297-304`；`js/app.js:1048-1067`；`js/exploration-detail.js:261-283`。
- **建议**：方案须把「无怪 +15」从「战斗结果回调」单独拆出来，明确挂在 `startExploration` 调用方的无 battle 分支，且仅在「骰子入口」时触发（用一个 `viaDice` 标志透传）。

## F6 · 积分不足扔骰子 / 骰子点数越界 / 落同格未覆盖（MEDIUM）

- **类别**：边界遗漏
- **严重度**：medium
- **问题**：方案 §5 风险表无「积分不足扔骰子」的处理（应该 `spendPoints` 预检拒绝，但方案没写用 `spendPoints` 还是 `addGrowthPoints(-10)`）。其它遗漏：
  - **落同格**：骰子掷 1 后再掷 1，角色原地不动但已扣 10 积分——是否仍触发该场景的探索（重复刷 EXP/掉落）？方案未定义。
  - **越界停末位**：方案 §2.2 写「越界则停在最后一个」，但停在最后一个（stargarden，第 12 章）后玩家无法再掷骰子推进游戏，缺少「通关后」状态机。
  - **HP 不足战斗失败连锁**：骰子落入有怪场景但 `pet.hp <= 0` 时，`startExploration` 直接返回 `{success:false, msg:'宠物已倒下'}`（exploration.js:280）——此时**骰子已扣 10 积分但探索失败**，方案没说积分是否退还、角色是否回退。
- **证据**：`js/exploration.js:280-281`；方案 §2.2/§2.4 无对应分支。
- **建议**：方案 §2.2/§2.4 补三条规则：①积分不足 → 不掷骰、不扣分（用 `spendPoints` 预检）；②落同格 → 触发探索但不再扣积分（或禁止原地掷）；③`startExploration` 返回 `success:false` 时角色回退到掷骰前位置、积分退还（或显式声明「掷骰成本不退」并写入决策表）。

## F7 · 数值与扣分 API 选择含糊（LOW）

- **类别**：数值 / API
- **严重度**：low
- **问题**：方案 §3 写「积分增减 API：复用 `getCurrentPoints()` / 现有积分增减函数」，但没点名。现有三个入口语义不同：
  - `addGrowthPoints(delta)`：`totalPoints < 0 → 0`（截断，app.js:279-285）——失败 −10 时若余额<10 会被截断到 0，等于少扣。
  - `deductGrowthPoints(pts)`：允许扣到负数（app.js:319-325）——惩罚语义。
  - `spendPoints(n)`：预检不足则拒绝（app.js:289-296）——消费语义。
  方案没说失败 −10 用哪个（截断会扭曲「净 −20」经济曲线），也没说成功 +15 用 `addGrowthPoints(15)`。
- **证据**：`js/app.js:279-325`。
- **建议**：方案决策表（§1 第 e 行）追加：成功 = `addGrowthPoints(15)`；失败 = `deductGrowthPoints(10)`（保惩罚语义，不被截断）；掷骰成本 = `spendPoints(10)`（不足拒绝）。

## F8 · S1 截图门禁不足以覆盖视觉风险（LOW）

- **类别**：Step 划分
- **严重度**：low
- **问题**：S1 截图审查能暴露「螺旋形态、卡片不重叠」，但方案没规定截图的**视口宽度档位**（桌面 / 平板 / 手机 / 希沃一体机）和**两个 board**（首页 + 探索 tab）。NFR1 把移动端 + 一体机列为要求，单张截图不算门禁。
- **建议**：S1 验收门禁至少 3 个视口（≥1280 / 768 / 375）× 2 个 board = 6 张截图；明确「内圈相邻卡片不得互相覆盖标题文字」为可量化判据。

## F9 · buildRouteSvg 螺旋连线无需改动——成立（确认）

- **类别**：改动点准确性（正向）
- **严重度**：low（信息项）
- **问题**：方案 §2.1 称 `buildRouteSvg` 的 `<polyline>` 已按数组顺序连点、自动成螺旋臂、无需改逻辑。代码确认 `buildRouteSvg`（exploration.js:115-127）用 `MAP_LAYOUT.map(node => 'x y').join(', ')` 生成 points，**仅依赖数组顺序**——只要 `generateSpiralLayout` 输出的 12 个 `{x,y}` 数组顺序对应章节 1→12，polyline 确实自动连成螺旋，无需改逻辑。**该改动点准确**。

## F10 · 兼容性声明大体成立，但章末精英怪 species 路径需复核（LOW）

- **类别**：兼容性
- **严重度**：low
- **问题**：方案 §2.5 称「章末精英怪（danger>=4 40% species）保留不动」。代码确认该判定在 `startExploration`（exploration.js:288-294）内，骰子入口若复用 `startExploration` 则自动继承。但 species 敌人首胜定向掉卡逻辑在 **`app.js:1219-1247`**（`battleAction` 胜利分支），骰子入口若把胜负钩子挪到别处，要保证不掉卡。
- **建议**：S7 回归测试用例须显式覆盖「骰子入口 → species 敌人 → 首胜掉卡」一条。

---

## 汇总

- HIGH：F1（钩子位置）、F2（tryUnlock 丢 boardId）、F3（小屏挤压缓解不可操作）
- MEDIUM：F4（角色位置持久化）、F5（无怪 +15 时机）、F6（边界遗漏）
- LOW：F7（API 选择）、F8（截图门禁）、F10（species 兼容）
- 正向确认：F9（polyline 自动连点）、双入口 boardId 签名成立（见 F2 上半）

**结论**：进入计划冻结前，至少须澄清 F1（钩子到底挂哪 3 个文件中的哪个/哪几个）、F2（tryUnlock 修复是否前置）、F3（防重叠具体策略 + 是否纳入缩放）、F4（角色位置存哪）、F6（边界三分支）。
