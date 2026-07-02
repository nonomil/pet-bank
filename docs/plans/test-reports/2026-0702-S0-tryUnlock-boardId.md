# S0 · tryUnlock 重渲保留 boardId 修复 · test-report

| 项 | 内容 |
|---|---|
| Step | S0（前置 bug 修复） |
| 关联方案 | [方案 §1.j](../../方案/2026-07-02-路线地图螺旋圈骰子-方案.md) / [findings F2](../../方案/2026-07-02-路线地图螺旋圈骰子-方案审查-findings.md) |
| 改动文件 | `js/exploration.js` |
| 状态 | ✅ 静态核对通过（截图门禁不适用，纯逻辑修复） |

## 1. Bug 现象

`tryUnlock(sceneId)`（旧 exploration.js:217-229）成功后调 `renderSceneGridMap(sceneId)`，**第二参 boardId 缺省**走默认值 `'sceneGridMap'`（首页板）。若用户在「探索 tab」内解锁场景，重渲会写回首页 `#sceneGridMap`，导致探索 tab 的 `#sceneGrid` 容器**不被填充**（地图消失/重渲到隐藏的首页板），用户看到空白。

## 2. 修复方式

1. **`tryUnlock(sceneId, boardId)`** 增形参 `boardId`（默认空→兜底 `'sceneGridMap'`）。成功后调 `renderSceneGridMap(sceneId, targetBoard)` 透传；仅当 `targetBoard==='sceneGrid'` 才额外触发 `renderExplorePage`（首页板不需要）。
2. **`buildMapNode(scene, layout, activeSceneId, boardId)`** 增第 4 参 `boardId`，把解锁按钮的 onclick 由
   `ExplorationSystem.tryUnlock('${scene.id}')` 改为 `ExplorationSystem.tryUnlock('${scene.id}', '${safeBoard}')`，让点击点自带 board 上下文。
3. **`renderSceneGridMap(activeSceneId, boardId)`** 把自身收到的 `boardId` 透传给 `buildMapNode`（line 185→186 调用处补参）。

三处连成链：渲染时 boardId 一路下传 → onclick 内联 → 点击时 tryUnlock 原样回传 → 重渲落在同一板。

## 3. 调用点核对（静态）

| 调用点 | 形态 | 处理 |
|---|---|---|
| exploration.js `buildMapNode` onclick（双入口共用） | 内联 `tryUnlock('${id}', '${board}')` | ✅ 透传 boardId |
| app.js:986 `renderScenePreview` 内解锁按钮 | `tryUnlock('${id}')` 无 board | ⚠ 见下 |

**app.js:986 核对结论**：`renderScenePreview`（app.js:975-1007）渲染的 `<div id="sceneFocusCard">` 元素在 `index.html` **不存在**（grep 全仓无此 id），且 `renderScenePreview` 全仓**无任何调用方**（仅定义未引用，死代码）。因此该 tryUnlock 调用点实际不触发，不影响 S0 正确性。建议后续清理该死代码（不在本轮 scope）。

## 4. 验证方式（静态核对）

由于纯前端、无构建链，本轮采用**静态读码 + Node 加载核对**：

1. **加载核对**：`node -e "require('./js/exploration.js')"` 成功加载，`ExplorationSystem.tryUnlock.length === 2`（形参数符合预期）。
2. **链路追踪**：沿 `renderSceneGridMap(boardId)` → `buildMapNode(boardId)` → `onclick tryUnlock(boardId)` → `renderSceneGridMap(boardId)` 完整闭环，boardId 无丢失点。
3. **双入口核对**：
   - 首页入口（app.js:514/1495）`renderSceneGridMap()` → boardId=`'sceneGridMap'` → 解锁后重渲回首页板 ✅
   - 探索 tab 入口（app.js:1023）`renderSceneGridMap(selectedSceneId, 'sceneGrid')` → boardId=`'sceneGrid'` → 解锁后重渲回 `#sceneGrid`，并额外触发 `renderExplorePage` ✅

## 5. 通过标准

- [x] `tryUnlock` 持有 boardId 并透传到重渲
- [x] 探索 tab 内解锁任一场景，`#sceneGrid` 仍在且重渲正确（链路核对成立）
- [x] 首页解锁路径不受影响（默认值兜底）
- [x] 不破坏 tryUnlock 既有 toast / unlockScene / saveUnlockState 逻辑（仅扩参，未改流程）

## 6. 风险与回滚

- **风险**：极低。仅扩形参 + 透传，无分支/数值改动；默认值兼容旧调用（无 board 时落首页板，与原行为一致）。
- **回滚**：还原 `tryUnlock` 为单参、`buildMapNode` 为 3 参、删除 onclick 第二参即可。

## 7. 截图门禁

不适用（纯逻辑修复，无可视化变化）。视觉验证由主代理后续 browser-act 在 S1 截图门禁时一并覆盖（探索 tab 内点解锁 → 板仍在）。
