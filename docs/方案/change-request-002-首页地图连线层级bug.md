# Change Request 002 — 首页成长地图连线（层级 bug）

> solution-loop 阶段 11 final gate 用 playwright 自动化测试时发现。DeepSeek V4 Pro 独立审查定位根因。已执行修复并验证。

## 问题（测试发现）
首页 `#page-map` 的成长地图，`.map-route-line` polyline 路线连线**完全不可见**。
- 不是语法问题（points 已在 CR-001 前置修复：百分比→数字坐标，console 错误 3→1）
- 不是几何问题（`getTotalLength`=392，`getBoundingClientRect` 有屏幕坐标）
- 不是 stroke 样式问题（强制 `stroke=red stroke-width=8 opacity=1` 仍不可见）

## 根因（DeepSeek V4 Pro 审查裁定）
**SVG 层级被节点覆盖**，非渲染 bug：
1. `.map-scene-node`（style.css:314）有 `transform: translate(-50%,-50%)` → **创建 stacking context**
2. DOM 顺序：`board.innerHTML = buildRouteSvg() + nodes`（exploration.js:178）→ SVG 先插入，12 个节点 button 后插入 → **节点绘制在 SVG 之上**
3. 节点 `--node-size:198px`，在 530×980 的 board 上占比 ~37% 宽，**节点几何覆盖了 polyline**
4. 即便给 SVG `z-index:9999`，因节点 transform 形成独立 stacking context，SVG 的 z-index 提升无法穿透同父级后续兄弟的 transform 层 → **强制红色置顶仍不可见**（这是最反常的现象，正是层级问题的特征）

## 修复方案（B + A，已执行）
- **方案 B（主）**：翻转 DOM 顺序，SVG 后插入 → `board.innerHTML = \`${nodes}${buildRouteSvg()}\``（exploration.js:178）。SVG 作为最后子元素自然绘制在最上层
- **方案 A（兜底）**：`.map-route-svg` 显式 `z-index:5`（style.css:285-293），双保险
- SVG 已有 `pointer-events:none`，置顶不挡节点点击
- 保留 CR-001 的 `vector-effect:non-scaling-stroke` + `stroke-width:6`（防 preserveAspectRatio="none" 非均匀拉伸扭曲）

## 验证（playwright，系统 Chrome，已通过）
1. **强制红色诊断**：JS 注入 `stroke=red stroke-width=8 z-index=9999`，截图 analyze → **红色连线清晰可见，连接多个节点**（修复前为 0 红色像素）
2. **几何回归**：`lineLen=392`、`lineRect` 屏幕坐标有值（不变）
3. **样式断言**：`svgZ="5"`（z-index 生效）
4. **console 错误**：polyline points 错误已消失（CR-001），仅剩 1 个无关 404

## 视觉 trade-off（已知，可接受）
连线现在绘制在节点卡片**之上**（穿过节点中心）。这是地图路线的常见呈现（路线穿过地点图标）。`pointer-events:none` 保证节点仍可点击。若后续设计要求连线在节点之下且露出，需缩小 `--node-size`（方案 C，本期不做）。

## 影响文档
- `docs/路线/差距清单与开发路线图.md` — 新增「首页地图连线层级」条目（已修复）
- `docs/方案/宠物小屋-方案.md` — 无关（首页地图属探索模块，非宠物小屋）

## 涉及文件
- `js/exploration.js:178`（DOM 顺序）、`:107-119`（buildRouteSvg，CR-001 points 修复）
- `css/style.css:285-293`（z-index:5）、`:293-307`（stroke 规范化，CR-001）
