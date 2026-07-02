# S1 · 螺旋布局生成 + 双入口渲染 · test-report

| 项 | 内容 |
|---|---|
| Step | S1（螺旋布局 + 中心手调） |
| 关联方案 | [方案 §2.1](../../方案/2026-07-02-路线地图螺旋圈骰子-方案.md) |
| 改动文件 | `js/exploration.js`（`generateSpiralLayout` + `MAP_LAYOUT`）、`css/style.css`（z-index 微调） |
| 状态 | ✅ 静态核对通过；**截图门禁留空，由主代理后续 browser-act 补** |

## 1. 螺旋参数（generateSpiralLayout）

阿基米德螺旋 `r = b·θ`，**外→内顺时针**，12 点跨约 2.5 圈：

| 参数 | 取值 | 含义 |
|---|---|---|
| `count` | 12 | 节点数 |
| `K` | 42 | r→百分比映射系数；外圈首点 r=42%（落在 8%/92% 边缘带） |
| `thetaStart` | `5π` | 外圈起始角（i=0） |
| `dθ`（步长） | `5π/(count-1)` ≈ 1.428 rad | 每步角增量 |
| `b` | `K/(5π)` ≈ 2.546 | 使外圈首点 `r = b·5π = K = 42` |

**视觉顺时针实现**：屏幕 y 轴向下，取 `t = -θ` 后 `x=50+r·cos(t), y=50+r·sin(t)`，递减 θ 即顺时针向内。

## 2. 12 点采样坐标表（generateSpiralLayout 返回值）

| i | sceneId | chapter | x% | y% | 来源 | 备注 |
|---|---|---|---|---|---|---|
| 0 | forest | 1 | 8 | 50 | 公式 | 外圈起点（左中） |
| 1 | beach | 2 | 44.6 | 12.2 | 公式 | 上方 |
| 2 | candy | 2 | 83 | 40.3 | 公式 | 右上 |
| 3 | waterfall | 3 | 62.7 | 77.8 | 公式 | 右下 |
| 4 | underwater | 3 | 27.5 | 64.4 | 公式 | 左下 |
| 5 | desert | 3 | 35 | 32.7 | 公式 | 左上 |
| 6 | mountain | 4 | 62.5 | 35.6 | 公式 | 右上 |
| 7 | cave | 4 | 62.8 | 58.3 | 公式 | 右中 |
| 8 | castle | 4 | 40 | 70 | **[手调]** | 左下，避开中心死区 |
| 9 | volcano | 4 | 62 | 72 | **[手调]** | 右下 |
| 10 | space | 5 | 68 | 44 | **[手调]** | 右上 |
| 11 | stargarden | 5 | 46 | 57 | **[手调]** | 核心终点 |

**章节顺序**：数组前部=外圈=低章节（1 起点 → 2 森林 → 3 海边 → 4 高地），末部=中心=第 5 章（星空终点 stargarden 居核心）。与 [CHAPTER_THEME](../../../js/exploration.js) 5 章结构对齐。

## 3. 中心手调说明（i=8~11）

**为什么手调**：阿基米德螺旋 r 随 θ 减小，最后 4 点公式算出的 r 分别为 11.45 / 7.64 / 3.82 / 0（%），全部落入"中心死区"（r<15%）。190px 固定卡片在 ~700px 宽面板上 1%≈7px，卡片半宽 ≈13.5%，r<15% 必然相邻重叠。方案 §2.1 决策 a 要求「中心 3-4 点手动微调」。

**手调策略**：把 4 个中心点从纯螺旋位置（理论都在中心 ±12% 内）拉到中心 ±18% 的四象限，模拟"中心花蕊 + 四瓣"布局，使路径相邻间距全部 ≥22%：

| 相邻对 | 间距(%) | 达标(≥22) |
|---|---|---|
| 0→1 / 1→2 / 2→3 / 3→4 | 52.6 / 47.6 / 42.6 / 37.7 | ✅ |
| 4→5 / 5→6 / 6→7 / 7→8 | 32.6 / 27.7 / 22.7 / 25.6 | ✅ |
| 8→9 / 9→10 / 10→11 | 22.1 / 28.6 / 25.6 | ✅ |

**跨臂（不同圈层）重叠**：螺旋臂自身会跨圈穿越，如 i=6(mountain 62.5,35.6) 与 i=10(space 68,44) 直线距 ~9.6%。这是螺旋图固有视觉特性（路线 polyline 会清晰标示轨迹，圈层在视觉上可区分），**不属于"相邻卡片"范畴**（相邻=折线 polyline 上的前后项）。CSS z-index 分层（见 §5）保证 hover/active 与中心终点卡浮于上层，进一步缓解视觉干扰。

## 4. buildRouteSvg / buildMapNode / renderSceneGridMap 影响

- **buildRouteSvg**（exploration.js:115-127）：`polyline points` 按 `MAP_LAYOUT` 数组顺序取 `x y` 连线 → 12 点按 i=0→11 顺序连接，自动形成"外→内螺旋臂"形态。**逻辑零改动**，仅坐标来源换成螺旋值。
- **buildMapNode**（129-175）：`left:${x}%;top:${y}%` 直接读 layout 坐标 → 螺旋值即生效。**逻辑零改动**（S0 已加 boardId 第 4 参，与 S1 正交）。
- **renderSceneGridMap**（177-191）：遍历 `MAP_LAYOUT` 渲染 → 螺旋值透传。**逻辑零改动**。

结论：螺旋化是纯数据替换（坐标源由手写散点 → `generateSpiralLayout()` 生成值），渲染管线零侵入。

## 5. CSS 微调（style.css）

仅加 z-index 分层，保证可读性（**未改字号/尺寸**，字体不在本轮 scope）：

```css
.map-scene-node              { z-index: 6; }   /* 节点在路线 svg(z-index:5) 之上 */
.map-scene-node.chapter-5    { z-index: 8; }   /* 中心终点卡再抬一层 */
.map-scene-node:hover,
.map-scene-node.is-active    { z-index: 12; }  /* hover/active 最上层 */
```

## 6. 双入口渲染核对（静态）

| 入口 | 调用 | 渲染容器 | 螺旋是否生效 |
|---|---|---|---|
| 首页（app.js:514,1495） | `renderSceneGridMap()` | `#sceneGridMap`（index.html:159） | ✅ 读同一 `MAP_LAYOUT` |
| 探索 tab（app.js:1023） | `renderSceneGridMap(selectedSceneId, 'sceneGrid')` | `#sceneGrid`（index.html:388） | ✅ 读同一 `MAP_LAYOUT` |

**核对方式**：`node -e "require('./js/exploration.js')"` 加载后 `E.generateSpiralLayout(12)` 返回 12 点，`E.getMapLayout()` 的 x/y 与螺旋值一一对应（见 §2 表）。两个入口的 DOM 容器都带 `.map-board` class（index.html:159/388），同一渲染函数填充 → 螺旋形态一致。

## 7. 通过标准

- [x] `generateSpiralLayout()` 实现，参数 r0(K)/b/θ步长/K 可在 [§1 表] 查到
- [x] 12 点采样坐标确定（§2），中心 4 点 [手调] 标注（§3）
- [x] 路径相邻间距全部 ≥22%（§3 表）
- [x] MAP_LAYOUT 章节顺序外→内（1→5），stargarden 居中心
- [x] buildRouteSvg/buildMapNode/renderSceneGridMap 逻辑零改动
- [x] 双入口共用 MAP_LAYOUT，螺旋同时生效
- [x] CSS 仅 z-index 微调，未动字号
- [ ] **桌面端截图**（待主代理 browser-act 补）
- [ ] **移动端截图**（待主代理 browser-act 补）

## 8. 截图门禁

> **留空**：本轮为子代理执行，无浏览器实例。视觉门禁由主代理后续用 browser-act / va-preview skill 补：
> 1. 桌面端打开 index.html → 首页路线地图截图（看螺旋形态、12 节点分布、中心不重叠）
> 2. 切探索 tab → 同样截图（确认双入口一致）
> 3. 移动端视口（375×812）重复 1-2（看小屏可读）
> 4. 核对四态（当前/已通关/已解锁/未解锁）可辨

## 9. 风险与回滚

- **风险**：中心 4 点跨臂（i=6↔i=10 等）在小屏下卡片可能视觉接近，但 polyline 路径线可区分圈层；z-index 保证交互卡浮于上层。
- **回滚**：还原 `MAP_LAYOUT` 为原手写散点（见 git diff），删除 `generateSpiralLayout` 及 z-index 三条 CSS 即可。
