# 首页探索地图布局实施计划

> **给 Claude:** 必需子技能：使用 superpowers:executing-plans 来逐任务实施此计划。

**目标：** 重整首页探索地图的信息层级，让“森林探险、星港科技区、方块地下城”成为地图画布上方唯一的主地图选择器，同时保留第一版森林 12 节点和独立侦探小游戏入口。

**架构：** 保留现有 `openHomeExploreMode()`、`renderHomeExploreMap()` 和 `PixelStoryMap.render()` 作为状态与渲染边界，只调整首页宿主 HTML、首页样式，以及像素地图在首页嵌入时的显示模式。独立 `/app/explore` 继续使用同一个地图组件的完整世界 Tab。

**技术栈：** Vanilla HTML、CSS、IIFE JavaScript、Playwright、Node.js 脚本测试。

---

### 任务 1：首页探索布局契约测试

**文件：**
- 创建：`scripts/test-home-explore-layout.mjs`
- 参考：`index.html`、`js/app.js`、`js/pixel-story-map.js`

**步骤 1：编写失败的测试**

新增 Node/Playwright 测试，启动或复用 `127.0.0.1:8765`，访问 `/app`，断言：

- `#homeExplorePanel` 内只有三个 `[data-home-explore-mode]`，顺序为 `forest,sci-fi,block`。
- `.home-explore-modebar` 位于 `#homeExploreView` 之前。
- 三个入口的主名称分别为“森林探险”“星港科技区”“方块地下城”。
- 森林状态显示 `#sceneGridMap`，并渲染 12 个 `.map-scene-node`。
- 森林标题只使用“森林探险”，不出现“森林探险地图”“原有探索路线”等旧长标题。
- 科幻和方块状态显示 `#homePixelWorldMapSlot`，首页嵌入地图没有 `.pixel-story-world-tabs`。
- `/app/explore` 仍有 3 个 `.pixel-story-world-tab`。
- 390px 视口没有页面级横向溢出。

**步骤 2：运行测试以验证它失败**

运行：`node scripts/test-home-explore-layout.mjs`

预期：失败，至少命中旧森林标题、首页嵌入世界 Tab 或旧外层结构断言。

**步骤 3：提交测试**

```powershell
git add -- scripts/test-home-explore-layout.mjs
git commit -m "test: define home exploration map layout contract"
```

### 任务 2：首页宿主结构与地图嵌入模式

**文件：**
- 修改：`index.html:298-352`
- 修改：`js/pixel-story-map.js:90-180`
- 修改：`js/app.js:2623-2710`（如需传递首页嵌入标记）

**步骤 1：实施最小 HTML 结构**

- 保留三张主地图按钮并放在地图视图之前。
- 将森林地图标题精简为“森林探险”，移除路线说明和“刷新路线”。
- 移除首页探索状态卡及重复的大段说明。
- 保留 `#homePixelWorldMapSlot` 和侦探小游戏辅助入口，但不把侦探加入主地图 Tab。

**步骤 2：实施首页嵌入标记**

- `PixelStoryMap.renderTrack()` 根据容器是否为 `homePixelWorldMapSlot` 增加首页宿主标记，或通过容器祖先的明确 `data-home-embedded` 标记判断。
- 首页嵌入时不生成 `.pixel-story-world-tabs`；独立故事地图仍生成完整三世界 Tab。
- 保留地图分页、节点进入、侦探 bonus 和完成状态。

**步骤 3：运行目标测试**

运行：`node scripts/test-home-explore-layout.mjs`

预期：结构、名称、首页隐藏 Tab、独立页保留 Tab、12 节点和手机无溢出全部通过；若失败只修复本任务范围内的宿主或渲染契约。

**步骤 4：提交**

```powershell
git add -- index.html js/app.js js/pixel-story-map.js scripts/test-home-explore-layout.mjs
git commit -m "feat: simplify home exploration map host"
```

### 任务 3：首页探索视觉层级与响应式样式

**文件：**
- 修改：`css/style.css:8164-8392`

**步骤 1：收敛桌面布局**

- 保留探索区域标题和唯一地图选择器。
- 将地图选择器作为地图画布上方的稳定工具栏。
- 让地图画布成为主要视觉区域，标题条紧凑，不使用重复状态卡或长说明。
- 首页像素地图容器继续使用稳定高度和既有像素故事视觉 token。

**步骤 2：收敛移动布局**

- 390px 下三张按钮可以整齐堆叠或换行，但不造成页面横向滚动。
- 删除的标题/按钮不通过 CSS 仅隐藏，避免无障碍树和布局残留。
- 森林地图节点及标签保持可点击、可读，不因标题压缩而溢出。

**步骤 3：运行测试与截图**

运行：`node scripts/test-home-explore-layout.mjs`

预期：自动化布局断言通过。

使用 Playwright 生成并检查：

- `tmp/home-explore-forest.png`
- `tmp/home-explore-sci-fi.png`
- `tmp/home-explore-block.png`
- `tmp/home-explore-mobile.png`

### 任务 4：故事地图回归与发布前验证

**文件：**
- 可能修改：`docs_project/runbooks/testing-and-release.md`（仅在测试入口或用户可见结构发生变化时同步）

**步骤 1：运行相关回归**

```powershell
node scripts/test-home-explore-layout.mjs
node scripts/test-pixel-story-browser.mjs
node scripts/test-pixel-story-pagination-browser.mjs
node scripts/test-pixel-story-stage-shell.mjs
node scripts/test-pixel-worlds-entry.mjs
node scripts/test-pixel-worlds-contract.mjs
node scripts/test-local-server-route.mjs
```

**步骤 2：运行基础检查**

```powershell
node scripts/smoke.mjs
node scripts/test-static-route-entries.mjs
```

**步骤 3：核对变更边界**

运行：`git diff --check` 和 `git status --short`，确认提交/工作树没有带入与本任务无关的用户改动。

**步骤 4：提交验证记录**

若新增或修订测试运行入口，更新对应 runbook；最终提交只包含首页布局、像素地图宿主、测试和必要文档变更。
