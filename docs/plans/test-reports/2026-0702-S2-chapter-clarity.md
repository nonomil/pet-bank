# S2 · 章节信息增强（LV 层级清晰度）· test-report

| 项 | 内容 |
|---|---|
| Step | S2 |
| 目标 | 在不引入骰子/逐格/地块事件/地图积分玩法的前提下，让玩家一眼看清"现在在哪一层、后面往哪走" |
| 状态 | ⏳ 待截图门禁（主代理补桌面+移动端截图后打勾；05-实施计划.md 的 S2 状态由主代理在通过后再勾） |
| 改动文件 | `js/exploration.js`、`css/style.css` |

## 0. 边界自检

本轮只做"信息层增强"，未偷渡任何玩法系统：
- 未改 `MAP_LAYOUT` 坐标 / `ring` / `min_level` / `chapter` 字段（S1 坐标与色带分段逻辑保持不变）。
- 未改 `buildMapNode` 签名、`renderSceneGridMap` 双入口逻辑、`tryUnlock(boardId)`、`startExploration()` 主玩法、战斗/奖励/积分规则、故事分发。
- 未引入骰子 / 逐格 / 地块事件 / Boss 续走 / 地图积分 / 圈奖 / 复杂运行态。

## 1. 4 层 LV 标签（位置 + 文案）

用 HTML 绝对定位 `<div class="map-tier-label">`（非 SVG `<text>`，因 `.map-route-svg` 用 `preserveAspectRatio="none"` 会拉伸文字）。`pointer-events:none` + `z-index:9`，不挡节点点击。

坐标取每圈"底部空隙"——12 节点最大空档集中在底部偏中（castle 104° ↔ underwater 151° 之间 46° 空档），x=50 纵向堆叠，避开左右节点卡：

| 圈层 | 文案 | 位置 (x%, y%) | 代表色 |
|---|---|---|---|
| 外层 | `Lv.1-2 启程` | (50, 85) | `LV_THEME[1]` 绿 `#7ee68a` |
| 中层 | `Lv.3 探险`   | (50, 76) | `LV_THEME[3]` 棕 `#c89060` |
| 内层 | `Lv.4 精英`   | (50, 67) | `LV_THEME[4]` 橙 `#f0a040` |
| 中心 | `Lv.5 终点`   | (50, 59) | `LV_THEME[5]` 紫 `#a888d4` |

文案口径选用 LV（与 S1 的 `min_level` 分层依据一致），不用 chapter 名（chapter 仍只服务 `buildMapNode` 的章节主题色与现有逻辑）。

## 2. 分区背景（.map-ring-guide 圈层辅助区 fill）

未改 `.map-ring-guide` 描边类。新增 4 个 `<ellipse class="map-ring-fill">`，与 `RING_GUIDES` 同尺寸、由大到小叠层填色（idx 一一对应：ring1→outer / ring2→mid / ring3→inner / ring4→core），形成 4 条同心彩色圈带：

- 基础 `fill-opacity: 0.085`（07 要求的 0.08-0.12 区间内，淡但不失辨识）。
- 渲染顺序：`bandFills → guides(stroke) → tierSegs → route line`，描边与路线盖在分区底之上。
- 圈带色：外绿 / 中棕 / 内橙 / 中心紫，呼应 `buildRouteSvg` 已有的 LV 色带分段。

## 3. 当前层高亮（pet.level → LV 层规则）

**取值 API（已确认）**：`PetSystem.getState().level`（`exploration.js` 既有用法见 `isSceneUnlocked` / `updateMapStats` / `unlockScene`）。`renderSceneGridMap` 内做 `window.PetSystem` 存在性兜底，缺省回落到 1。

**映射规则**（`petLevelToTierKey`，与 `TIER_META.levelRange` 对齐）：

| pet.level | 当前层 key | 高亮标签 | 分区底加深 |
|---|---|---|---|
| 1 - 2 | `outer` | "Lv.1-2 启程" | 外圈 fill-opacity 0.16 |
| 3     | `mid`   | "Lv.3 探险"   | 中圈 0.16 |
| 4     | `inner` | "Lv.4 精英"   | 内圈 0.16 |
| ≥ 5   | `core`  | "Lv.5 终点"   | 中心 0.16 |

**高亮表现**：
- 标签加 `.is-current`：opacity 1 / 800 字重 / 反白文字 / 圈层色底 / 白边 + 双层阴影。
- 当前圈层 `map-ring-fill` 的 `fill-opacity` 由 0.085 抬到 0.16（在 `buildRouteSvg(curTierKey)` 内按 tier 比对设置）。

## 4. 节点信息变更

- **既有信息已完整**（本轮确认，未删未改）：`buildMapNode` 仍展示 `章节名(theme.name) + 场景名/emoji + 描述 + pills`；开放节点 pills = `危险 X` / `HP -X`，锁定节点 pills = `Lv.X` / `X 分`，锁覆层显示"🔒 需要 Lv.X"或"🔒 X 积分解锁"。
- **新增类 `is-reachable`**：当 `unlocked === true` 时挂到节点（按任务定义：pet.level ≥ min_level 且已解锁）。CSS 仅给 `.map-scene-bubble` 加一道 `2px rgba(255,226,143,0.22)` 极淡外圈作"可进入"轻提示，不覆盖 `is-open` / `is-active` 既有视觉；`is-active` 仍优先用其更强的 6px 高亮环。
- **未改 `buildMapNode` 签名**，未引入状态机。

## 5. 移动端策略

`max-width: 640px` 媒体查询内：
- 标签字号 11→9px、内边距 2/9→1/6、字距收紧、opacity 0.72→0.6（更退后），`is-current` 保持 0.95 维持"我在哪层"可读。
- 标签 `pointer-events:none`，不会抢占 34vw 节点的触控区；位置在节点卡之间的底部空隙，不挤压顶部最密的第一圈。

## 6. 截图门禁（主代理补）

待补产物（参考 S1 路径 `.tmp/map-s2-shots/`）：
- `map-desktop.png` / `explore-desktop.png`
- `map-mobile.png` / `explore-mobile.png`

通过标准：4 个 LV 标签可读且不遮节点；当前层标签明显高亮；分区底色可见但不喧宾夺主；移动端标签不挤。

## 7. 回归风险

预期零回归：
- 未碰 `startExploration` / 战斗 / 奖励 / 积分 / 故事分发 / `tryUnlock(boardId)` / `goExplore`。
- `buildRouteSvg` 仅多一个可选参数 `currentTierKey`（不传时 behaves as before，无 fill 输出仍兼容——实际所有调用点已透传）。
- `buildMapNode` 仅多一个 class，不改 DOM 结构 / 事件 / 签名。
- 新增 DOM（标签 + 4 个 fill 椭圆）均为 `pointer-events:none` / `aria-hidden`，不参与交互与可读树。
