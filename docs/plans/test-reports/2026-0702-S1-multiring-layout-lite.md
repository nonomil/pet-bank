# S1 · 多圈层静态重排（轻量版）· test-report

| 项 | 内容 |
|---|---|
| Step | S1 |
| 目标 | 在不引入骰子、逐格走动、地图积分循环的前提下，把路线地图重排成更清晰的多圈层导航结构 |
| 状态 | ✅ 通过（自动化检查 + 本地截图核对） |
| 改动文件 | `js/exploration.js`、`css/style.css`、`prj/route_map_s1_multiring.test.mjs` |

## 1. 本轮实际落地

- `MAP_LAYOUT` 不再使用算法螺旋；当前改为**手工多圈层重排**，路线按外→内推进。
- 实际圈层表达采用 `ring` 元数据落地，并在当前实现里用 `min_level` 串起解锁梯度；`chapter` 仍保留给章节主题色、文案和现有逻辑使用。
- `BLANK_CELLS` 保留为**纯装饰节点**，移除了点击反馈，不再暗示额外玩法。
- `buildRouteSvg()` 增加 `RING_GUIDES` 圈层引导线，并保留主路线高亮。
- `buildMapNode()` 为节点补 `ring-*` 类，方便首页 / 探索页共用一套圈层样式。
- 移动端继续压缩地图卡尺寸，本轮进一步把窄屏节点宽度收至 `34vw`，缩略图区高度收至 `92px`。

## 2. 自动化验证

执行：

```powershell
node --check .\js\exploration.js
$env:PETBANK_BASE_URL='http://127.0.0.1:8765'
$env:PW_CHROME='C:\Program Files\Google\Chrome\Application\chrome.exe'
node .\prj\route_map_s1_multiring.test.mjs
```

结果：

- `js/exploration.js` 语法检查通过
- `route_map_s1_multiring.test.mjs` 8/8 通过
- 已确认：
  - 12 个场景节点仍全部保留
  - 至少 3 层以上 ring 元数据存在
  - 首页路线地图节点都带 `ring-*` 类
  - 圈层引导线已渲染
  - `BLANK_CELLS` 仅为装饰，不再可交互
  - 无新增 console error

## 3. 本地截图核对

本地产物目录：

- `.tmp/map-s1-shots/map-desktop.png`
- `.tmp/map-s1-shots/explore-desktop.png`
- `.tmp/map-s1-shots/map-mobile.png`
- `.tmp/map-s1-shots/explore-mobile.png`

结论：

- 桌面端：首页与探索页都能看出由外向内的路线推进，探索页观感更清楚。
- 移动端：整体仍可读、可点，最上沿第一圈卡片仍然偏密，但在 `34vw` 收缩后没有出现整片遮挡。
- 当前更像“成长路线导航图”，不再把装饰点误导成小游戏节点。

## 4. 风险与后续

- S1 只完成了静态圈层与路线表达，**章节可理解性增强仍建议放到 S2** 继续做（章节标签、章节分区、当前章强调）。
- 移动端最上沿仍是本轮最紧区域，若后续实机点击反馈不理想，优先继续微调顶部节点 `x/y`，而不是回退到玩法化方案。
- 本轮未触碰 `goExplore()` / `tryUnlock()` / `startExploration()` 主链路语义。
