# S5 · 回归核对（轻量多圈层重构）· test-report

| 项 | 内容 |
|---|---|
| Step | S5（只读回归核对 + test-report，不改代码） |
| 范围 | 复核 S0/S1/S2 对 `js/exploration.js` + `css/style.css` 路线地图层改动是否破坏主玩法 |
| 约束 | 05-实施计划 §4：不改 startExploration 主玩法 / 战斗奖励 / 积分规则 / 故事分发 / buildMapNode 签名 |
| 状态 | ✅ **零回归**（主玩法全保留）；1 条软提示见 §11 |

> 核对基线：`83ac71a`（S0 前）= buildMapNode(scene, layout, activeSceneId) / tryUnlock(sceneId)；本轮 S0/S1/S2 落在 `912439d`(S0) → `7b5d3ff`(S1) → `353d0b0`(S2)。working tree 仅 `app.js` 第 494 行（PAGE_TO_TAB，非玩法）变动。

## 回归核对清单（9 项）

### 1. startExploration(sceneId) — ✅ 签名与语义未变
- 定义：`exploration.js:392` `function startExploration(sceneId)`，单参，与 S0 前 `83ac71a:274` 完全一致。
- 语义链完整：getSceneById → isSceneUnlocked 校验 → HP 校验（`pet.hp <= 0` / `hp < hp_cost`）→ `PetSystem.takeDamage(hp_cost)` + `addExploration()` → `monsters.length > 0` 返回 `battle` 对象；无怪走 `addExp(5 + danger*2)`。
- 本轮未触碰：`git diff --stat HEAD` 不含 exploration.js working tree 改动（已提交于 912439d/7b5d3ff/353d0b0）。

### 2. tryUnlock(sceneId, boardId) — ✅ boardId 全部到位，双入口落点正确
- 定义：`exploration.js:333`，S0 加 boardId（S0 前 `83ac71a:217` 为单参 `tryUnlock(sceneId)`）。
- 解锁后重渲落点（`exploration.js:340-346`）：`targetBoard = boardId || 'sceneGridMap'` → `renderSceneGridMap(sceneId, targetBoard)`；若 `targetBoard === 'sceneGrid'` 额外调 `renderExplorePage(sceneId)`。**探索 tab 解锁重渲落回 #sceneGrid ✅**。
- 调用点核对：
  - `exploration.js:236`（buildMapNode 内 onclick）：`tryUnlock('${scene.id}', '${safeBoard}')` — 透传 boardId ✅
  - `app.js:987`（renderScenePreview 预览卡）：`tryUnlock('${scene.id}')` — 不传 boardId，落默认 'sceneGridMap'。此为预览卡上下文（非地图节点），且为 S0 前既有调用、本轮未改；行为正确（预览卡属首页侧）✅

### 3. buildMapNode — ⚠️ 软提示：签名加可选 boardId（S0），向后兼容
- 定义：`exploration.js:228`。
- **签名变化**：S0 由 `(scene, layout, activeSceneId)`（`83ac71a:129`）扩为 `(scene, layout, activeSceneId, boardId)`。boardId 可选（`exploration.js:233` `safeBoard = boardId || 'sceneGridMap'`）。
- 向后兼容：唯一调用方 `renderSceneGridMap:288` 显式传 4 参；若以 3 参调用，boardId=undefined → 落默认首页板，不报错。
- onclick 仍为 goExplore / tryUnlock（`exploration.js:234-236`）✅
- S2 新增 class（不影响逻辑）：`ring-${layout.ring}`（:240）、`is-reachable`（:243，已解锁即加）。
- **结论**：非破坏性。严格对照"不改 buildMapNode 签名"约束属软提示——加了可选尾参，是 S0 双入口修复的必要透传通道，无调用方受损。

### 4. renderSceneGridMap(activeSceneId, boardId) — ✅ 双入口正确
- 定义：`exploration.js:280`，默认 `(null, 'sceneGridMap')`。
- 调用点：
  - 首页：`app.js:515`（switchPage 'map'）`renderSceneGridMap()` → #sceneGridMap ✅
  - 首页：`app.js:1496` `renderSceneGridMap()` → #sceneGridMap ✅
  - 探索 tab：`app.js:1024`（renderExplorePage）`renderSceneGridMap(selectedSceneId, 'sceneGrid')` → #sceneGrid ✅

### 5. buildRouteSvg — ✅ 默认调用不受影响
- 定义：`exploration.js:173` `function buildRouteSvg(currentTierKey)`，currentTierKey 可选。
- S1 加 LV 色带（:178-183 `RING_GUIDES.map` + TIER_META 配色）；S2 加分区底 `map-ring-fill`（:183 ellipse）。
- 唯一调用：`exploration.js:305` `buildRouteSvg(curTierKey)`。无参调用时 currentTierKey=undefined → 所有圈带 fill-opacity=0.085（无高亮），不报错 ✅

### 6. 积分 / 战斗（app.js）— ✅ 本轮未触碰
- `addGrowthPoints` `app.js:279`、`spendPoints` `app.js:289`、`deductGrowthPoints` `app.js:320` 均在。
- 战斗结果消费层 `closeBattleModal` `app.js:1359-1377`（endBattle / galgame 收尾 / renderAll）完整。
- working tree diff：app.js 仅改第 494 行 `PAGE_TO_TAB`（tools/settings 归类 playground），非玩法函数 ✅

### 7. exploration-detail.js — ✅ 本轮未触碰
- `genMathQuestion` `exploration-detail.js:126`、galgame 渲染（:98-107 `galgame-stage`）完整。
- 不在 `git diff --stat HEAD` 内（未改）✅

### 8. MAP_LAYOUT 数据完整 — ✅ 12 场景，ring == min_level
- 定义：`exploration.js:20-33`，共 12 条。
- 字段：每条均含 `id / x / y / size / chapter / min_level / ring`（name 来自 scene 数据，非 layout）。
- ring 与 min_level 逐条一致：

| sceneId | min_level | ring | 一致 |
|---|---|---|---|
| forest | 1 | 1 | ✅ |
| beach | 2 | 2 | ✅ |
| candy | 2 | 2 | ✅ |
| waterfall | 2 | 2 | ✅ |
| desert | 3 | 3 | ✅ |
| cave | 3 | 3 | ✅ |
| mountain | 3 | 3 | ✅ |
| castle | 4 | 4 | ✅ |
| underwater | 4 | 4 | ✅ |
| volcano | 5 | 5 | ✅ |
| space | 5 | 5 | ✅ |
| stargarden | 5 | 5 | ✅ |

### 9. node -c 语法检查 — ✅ 全过
```
exploration.js OK
app.js OK
exploration-detail.js OK
```

## 10. 总结：零回归

| 维度 | 结论 |
|---|---|
| 主玩法（startExploration / 战斗 / 积分 / 故事分发） | ✅ 未触碰，语义完整 |
| 路线地图层（buildMapNode / renderSceneGridMap / buildRouteSvg） | ✅ 仅装饰与布局增强，onclick 链路 goExplore/tryUnlock 保留 |
| 双入口 boardId | ✅ 首页 'sceneGridMap' / 探索 tab 'sceneGrid' 各归其位 |
| 数据完整性（MAP_LAYOUT 12 场景 / ring==min_level） | ✅ |
| 语法 | ✅ 三文件 node -c 通过 |

## 11. 软提示（非回归，供主代理知会）

- **buildMapNode 签名**：S0 加可选尾参 boardId（`exploration.js:228`），对照 05-实施计划 §4"不改 buildMapNode 签名"属字面软提示。该参向后兼容（默认 'sceneGridMap'），是双入口修复的必要透传，无调用方受损。建议主代理在收尾时确认是否需把约束措辞放宽为"不改 buildMapNode 必需签名 / 向后兼容"。
- **app.js:987 预览卡 tryUnlock**：不传 boardId（落首页板），为 S0 前既有行为、本轮未改；预览卡属首页侧，落点正确，无需修。
