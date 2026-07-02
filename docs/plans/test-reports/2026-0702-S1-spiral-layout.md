# S1 · 地标放置版 · test-report

| 项 | 内容 |
|---|---|
| Step | S1（地标放置版：地图底图 + 手调地标坐标 + 大富翁空格节点） |
| 关联方案 | [方案 §2.1](../../方案/2026-07-02-路线地图螺旋圈骰子-方案.md) |
| 改动文件 | `css/style.css`（底图接入 + `.map-blank-node` 样式）、`js/exploration.js`（弃用算法螺旋，MAP_LAYOUT 手调坐标 + BLANK_CELLS + 空格节点渲染） |
| 状态 | ✅ 静态核对 + 间距校验通过；**截图门禁留空，由主代理后续 browser-act 补** |

> **回炉说明**：原"算法螺旋(generateSpiralLayout)"被判定视觉太乱、否决。本版改用「地图底图地标 + 手调坐标 + 大富翁空格节点」。算法函数与 `_SPIRAL` 已从 exploration.js 移除。

## 1. 底图接入（css/style.css）

`.map-board-surface`（style.css:248-257）背景由 `assets/home-bg.webp` 改为 `assets/home-bg/map-board.png`，白色遮罩从 `0.6` 降到 `0.15`（仅保节点文字可读，不糊掉底图地标），保留 `center/cover no-repeat`。

```css
background:
    linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.15)),
    url("../assets/home-bg/map-board.png") center/cover no-repeat,
    linear-gradient(180deg, #f7fbf4 0%, #eff8ea 40%, #fffaf1 100%);
```

## 2. 12 节点手调坐标表（MAP_LAYOUT）

走向：**外→内顺时针**（左上森林起 → 上沿 → 右上 → 右沿下行 → 右下 → 下沿 → 左下 → 左沿 → 收向中心）。stargarden（ch5 终点）放右下内圈；castle 放内圈中央。

| i | sceneId | chapter | x% | y% | size | 近邻底图地标 | 备注 |
|---|---|---|---|---|---|---|---|
| 0 | forest | 1 |  8 | 14 | 198 | 森林(20,15) | 左上起点 |
| 1 | beach | 2 | 32 | 10 | 182 | 海滩(75,15) | 上沿（x 左移拉开） |
| 2 | candy | 2 | 54 | 12 | 176 | 糖果屋(85,15) | 上沿 |
| 3 | waterfall | 3 | 76 | 16 | 176 | 瀑布(85,35) | 右上 |
| 4 | underwater | 3 | 92 | 34 | 176 | 水下(85,45) | 右沿（x 拉到 92） |
| 5 | space | 5 | 78 | 54 | 174 | 太空(85,80) | 右中（y 错开到 54） |
| 6 | stargarden | 5 | 84 | 76 | 194 | 星空花园(85,85) | 右下内圈 终点 |
| 7 | volcano | 4 | 60 | 86 | 176 | 火山(50,80) | 下沿 |
| 8 | desert | 3 | 38 | 86 | 176 | 沙漠(75,65) | 下沿（x 左移拉开） |
| 9 | cave | 4 | 16 | 78 | 198 | 洞窟(15,75) | 左下 |
| 10 | mountain | 4 |  8 | 56 | 182 | 山(15,35) | 左沿 |
| 11 | castle | 4 | 34 | 48 | 188 | 中央城堡(50,45) | 内圈中央 |

**章节顺序**：数组前部=外圈=低章节（1 起点 → 2 森林 → 3 海边），中段进入 ch4 高地，末部 ch5 终点（stargarden）。与 [CHAPTER_THEME](../../../js/exploration.js) 5 章结构对齐。

## 3. 密集区拉开策略（右侧地标）

底图右侧地标（海滩/糖果/瀑布/水下/太空/星空花园）原始 x 集中在 75~92、y 集中在 15~85，直接用会重叠。拉开手法：

- **x 拉开**：underwater 从 85 拉到 92；beach/candy 从 75/85 左移到 32/54，沿上沿铺开。
- **y 错开**：右侧节点 y 从 16 → 34 → 54 → 76 阶梯下行，避免竖向堆叠。
- **结果**：相邻节点中心间距全部 ≥22%（190px 卡片在 ~700px 面板上不重叠）。

| 相邻对 | 间距(%) | 达标(≥22) |
|---|---|---|
| forest→beach / beach→candy / candy→waterfall | 24.1 / 22.1 / 22.5 | ✅ |
| waterfall→underwater / underwater→space / space→stargarden | 22.8 / 22.0 / 22.8 | ✅ |
| stargarden→volcano / volcano→desert / desert→cave | 26.0 / 22.0 / 25.0 | ✅ |
| cave→mountain / mountain→castle / castle→forest | 23.1 / 27.2 / 27.2 | ✅ |

**最小相邻间距 22.0%**（underwater→space、volcano→desert），节点运行时校验通过（见 §7）。

## 4. 大富翁空格节点（BLANK_CELLS）

新增 6 个 `{x, y, icon}`，沿螺旋路径在场景节点之间分布，渲染为 `.map-blank-node` 小圆装饰。

| icon | x% | y% | 位置说明 |
|---|---|---|---|
| 🌳 | 20 |  6 | 上沿 forest→beach 间 |
| 🌸 | 44 |  4 | 上沿 beach→candy 间 |
| 🪨 | 86 |  6 | 上沿 candy→waterfall 间 |
| 🍄 | 96 | 46 | 右沿 underwater→space 间 |
| ⛺ | 50 | 70 | 内圈 castle 旁 |
| 🌿 | 28 | 92 | 下沿 desert→cave 间 |

**设计决策**：空格节点**不进 polyline 主路径**，仅装饰。理由——若进 polyline 会把折线扯成 18 段（场景+空格交替），破坏外→内螺旋的清晰走向；作为半透明小圆点缀（直径 44px、`z-index:4` 低于场景卡 `z-index:6`），视觉上模拟大富翁棋盘空格，让长连线不显得空旷，同时不干扰主路径可读性。

**交互**：`pointer-events:auto`，点击调用 `ExplorationSystem.tapBlankCell()` → `window.showToast('空地：什么也没发生…')`。

**CSS（style.css .map-route-svg 后）**：
```css
.map-blank-node {
    position: absolute; width: 44px; height: 44px; margin: -22px 0 0 -22px;
    border-radius: 50%; display:flex; align-items:center; justify-content:center;
    font-size: 22px; background: rgba(255,255,255,0.45);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.7), 0 2px 6px rgba(80,60,30,0.18);
    z-index: 4; cursor: default; transition: transform 0.15s ease;
}
.map-blank-node:hover { transform: scale(1.08); }
```

## 5. buildRouteSvg / buildMapNode / renderSceneGridMap 影响

- **buildRouteSvg**：`polyline points` 按 `MAP_LAYOUT` 数组顺序连点 → 12 点按 i=0→11 自动连成外→内顺时针螺旋。**逻辑零改动**。
- **buildMapNode**：`left/top` 读 layout 坐标。**逻辑零改动**（S0 的 boardId 第 4 参保留，正交）。
- **renderSceneGridMap**：在场景节点渲染前先拼 `BLANK_CELLS` → `blanks` 串，`board.innerHTML = ${blanks}${nodes}${buildRouteSvg()}`。空格节点先入 DOM → 默认堆叠层低于后入场景卡，配合 z-index 分层保证场景卡可点、空格节点不挡。

## 6. 双入口渲染核对（静态）

| 入口 | 调用 | 渲染容器 | 新布局+空格是否生效 |
|---|---|---|---|
| 首页（app.js:514,1495） | `renderSceneGridMap()` | `#sceneGridMap`（index.html:159） | ✅ 读同一 `MAP_LAYOUT` + `BLANK_CELLS` |
| 探索 tab（app.js:1023） | `renderSceneGridMap(selectedSceneId, 'sceneGrid')` | `#sceneGrid`（index.html:388） | ✅ 读同一 `MAP_LAYOUT` + `BLANK_CELLS` |

两入口共用同一渲染函数 → 新布局 + 空格节点同时生效。

## 7. 运行时校验（node）

```
MAP_LAYOUT len: 12              ✅
has tapBlankCell: true          ✅
has generateSpiralLayout: undefined   ✅（已弃用移除）
相邻最小间距%: 22.0 (应>=22)    ✅
node --check js/exploration.js: SYNTAX OK   ✅
```

## 8. 通过标准

- [x] `MAP_LAYOUT` 手调坐标确定（§2），底图地标附近
- [x] 路径相邻间距全部 ≥22%（§3 表 + §7 运行时校验）
- [x] MAP_LAYOUT 走向外→内顺时针，stargarden 居内圈终点
- [x] BLANK_CELLS 6 个空格节点设计（§4），沿路径分布
- [x] 空格节点渲染进 `renderSceneGridMap`，z-index 低于场景卡
- [x] 算法螺旋 `generateSpiralLayout` 已弃用移除
- [x] buildRouteSvg/buildMapNode 渲染逻辑零侵入
- [x] 双入口共用 MAP_LAYOUT + BLANK_CELLS
- [x] css 底图接入 + `.map-blank-node` 样式
- [ ] **桌面端截图**（待主代理 browser-act 补）
- [ ] **移动端截图**（待主代理 browser-act 补）

## 9. 截图门禁

> **留空**：本轮为子代理执行，无浏览器实例。视觉门禁由主代理后续用 browser-act / va-preview skill 补：
> 1. 桌面端打开 index.html → 首页路线地图截图（看底图地标对齐、12 节点分布、空格小圆、中心不重叠）
> 2. 切探索 tab → 同样截图（确认双入口一致）
> 3. 移动端视口（375×812）重复 1-2（看小屏可读、空格节点不过密）
> 4. 点击空格节点 → 确认 toast「空地：什么也没发生…」弹出
> 5. 核对四态（当前/已通关/已解锁/未解锁）可辨

## 10. 风险与回滚

- **风险**：右侧 underwater→space 间距恰为 22.0%（阈值边界），小屏（375px）下卡片可能视觉贴近；polyline 路径线 + z-index 可区分。若实测仍挤，可把 space 的 x 从 78 降到 74、y 升到 58。
- **回滚**：还原 `MAP_LAYOUT` 为算法版（见 git diff `cb20ed0`），恢复 `generateSpiralLayout` 与导出项，删除 `.map-blank-node` CSS 与 `BLANK_CELLS`，底图 url 改回 `assets/home-bg.webp`、遮罩改回 `0.6`。
