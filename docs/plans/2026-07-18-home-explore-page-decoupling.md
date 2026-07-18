# 首页与探索地图页面解耦实施计划

> 状态：已被 `2026-07-18-home-carousel-implementation.md` 的首页轮播方案取代。当前首页不嵌入森林地图；森林地图仅由 `/app/explore/forest` 独立页面承载。本文保留为历史实施记录，不作为当前架构契约。

> **给 Claude:** 必需子技能：使用 superpowers:executing-plans 来逐任务实施此计划。

**目标（历史版本）：** 在保留首页森林螺旋路线和探索 Tab 三世界卡片地图的前提下，消除新旧首页嵌套、探索容器整页覆写和隐式返回状态。

**架构：** 为首页摘要、森林路线、像素故事地图和森林场景舞台建立四个固定宿主，每个宿主只有一个渲染模块。`switchPage()` 继续负责顶级页面，探索内部视图由显式状态和返回目标管理，不再根据 DOM 是否存在推断状态。

**技术栈：** Vanilla JavaScript、静态 HTML、CSS、Playwright、Node.js 契约测试、现有 `PetBankRuntime` 和 `PetBankPageRouter`。

---

## 执行前约束

- 当前工作树原本有大量未提交修改。执行者必须先运行 `git status --short`，只编辑本计划列出的文件，不得清理或回滚其他改动。
- 本地服务统一使用 `http://127.0.0.1:7000/`；不要启动或引用 `8766`，不要把 `tmp/pixel-home-template-demo/` 接入正式入口。
- 首页继续保持磨砂半透明圆角美术；本计划只拆结构和所有权，不重做美术方向。
- 首页森林路线和探索故事地图保持两个独立产品入口：前者是 12 节点螺旋路线，后者是三世界每世界 20 节点加 20 个侦探环节。
- 每个任务单独提交，提交前只暂存该任务文件。若工作树重叠导致无法安全分离，停止提交并报告，不得带入无关修改。

### 任务 1：建立 DOM 所有权失败测试

**文件：**

- 创建：`scripts/test-home-explore-dom-ownership.mjs`
- 修改：`scripts/run-full-regression.mjs`

**步骤 1：编写失败的静态契约测试**

测试读取 `index.html`、`js/app.js` 和探索模块，至少断言：

```js
assert.match(index, /id="homeForestRouteHost"/);
assert.match(index, /id="pixelStoryMapHost"/);
assert.match(index, /id="explorationStageRoot"/);
assert.doesNotMatch(app, /pageExplore\.innerHTML\s*=/);
assert.doesNotMatch(index, /home-demo-original-content/);
```

同时断言 `#homePixelWorldMapSlot` 和 `[data-home-explore-mode]` 不再出现在正式 HTML。

**步骤 2：运行测试以验证它失败**

运行：

```powershell
node scripts/test-home-explore-dom-ownership.mjs
```

预期：失败，提示固定宿主尚未建立，且 `app.js` 仍在改写 `pageExplore.innerHTML`。

**步骤 3：接入回归清单**

把测试加入 `scripts/run-full-regression.mjs` 的静态契约阶段，放在浏览器首页测试之前。

**步骤 4：提交**

```powershell
git add scripts/test-home-explore-dom-ownership.mjs scripts/run-full-regression.mjs
git commit -m "test: define home explore dom ownership"
```

### 任务 2：建立固定页面宿主

**文件：**

- 修改：`index.html`
- 修改：`scripts/test-home-explore-dom-ownership.mjs`
- 修改：`scripts/test-explore-mode-contract.mjs`

**步骤 1：把首页旧内容包装拆开**

删除 `.home-demo-original-content` 这一整页兼容包装。保留原森林地图，但只以一个独立区块放入首页中栏：

```html
<section id="homeForestRouteHost" class="home-forest-route-host" aria-labelledby="homeForestRouteTitle">
  <header class="home-forest-route-heading">
    <p>森林探险</p>
    <h2 id="homeForestRouteTitle">沿着螺旋路线继续冒险</h2>
  </header>
  <div id="sceneGridMap" class="map-board" aria-label="森林探险场景路线"></div>
</section>
```

原 `childJourneyHero`、`child-journey-launcher`、`showcase`、`childJourneyFeedback` 和 `treasureWarehouseCard` 不得继续整体嵌入首页中栏。仍被其他业务使用的节点先移动到语义正确的固定位置或保留隐藏兼容宿主，并在测试中登记；不得直接删除业务入口。

**步骤 2：为探索页声明稳定结构**

把空 `#page-explore` 改成：

```html
<div class="page" id="page-explore">
  <section id="exploreLoadingState" class="explore-loading-state" aria-live="polite">正在打开故事地图…</section>
  <section id="pixelStoryMapHost" aria-label="三世界故事地图" hidden></section>
  <section id="pixelStoryChapterHost" aria-label="故事章节" hidden></section>
</div>
<div id="explorationStageRoot" hidden></div>
```

**步骤 3：运行契约测试**

运行：

```powershell
node scripts/test-home-explore-dom-ownership.mjs
node scripts/test-explore-mode-contract.mjs
```

预期：固定宿主断言通过；`pageExplore.innerHTML` 禁止项仍失败，留给后续任务。

**步骤 4：提交**

```powershell
git add index.html scripts/test-home-explore-dom-ownership.mjs scripts/test-explore-mode-contract.mjs
git commit -m "refactor: add stable home explore hosts"
```

### 任务 3：提取首页编排器

**文件：**

- 创建：`js/home-dashboard.js`
- 创建：`css/home-dashboard.css`
- 修改：`js/runtime-loader.js`
- 修改：`index.html`
- 修改：`js/app.js`
- 修改：`scripts/test-home-browser.mjs`

**步骤 1：扩展浏览器测试使其先失败**

在 `scripts/test-home-browser.mjs` 增加：

- 首页只存在一个可见“今日任务”标题。
- 首页只存在一个可见“我的成长”面板。
- `#homeForestRouteHost` 位于中栏且不在兼容包装中。
- 首屏没有 `home-demo-original-content`。
- 1280×900 和 390×844 均无横向溢出。

运行：

```powershell
node scripts/test-home-browser.mjs
```

预期：重复信息或兼容包装断言失败。

**步骤 2：实现 `HomeDashboard` 命名空间**

`js/home-dashboard.js` 只暴露一个命名空间：

```js
window.HomeDashboard = {
  renderSummary,
  renderTasks,
  activate,
  deactivate
};
```

把 `renderHomeDemoTaskMirror()`、`updateHomeDemoSummary()` 及对应 DOM 查询迁移到该模块。`app.js` 只调用 `HomeDashboard.activate()`，不再直接了解首页内部元素。

**步骤 3：迁移首页专属 CSS**

把 `.home-demo-*` 与 `body.map-page-bg.shell-home #page-map ...` 中确属新首页的规则移动到 `css/home-dashboard.css`。通过 `runtime-loader.js` 的 `map` bundle 加载，不在 `index.html` 额外散落 `<link>`。

**步骤 4：运行验证**

```powershell
node --check js/home-dashboard.js
node --check js/app.js
node scripts/test-home-browser.mjs
node scripts/test-child-journey-home.mjs
```

预期：全部通过，首页只保留一套信息层级。

**步骤 5：提交**

```powershell
git add js/home-dashboard.js css/home-dashboard.css js/runtime-loader.js index.html js/app.js scripts/test-home-browser.mjs
git commit -m "refactor: isolate home dashboard renderer"
```

### 任务 4：隔离森林螺旋路线组件

**文件：**

- 创建：`js/forest-route-map.js`
- 创建：`css/forest-route-map.css`
- 修改：`js/runtime-loader.js`
- 修改：`js/app.js`
- 修改：`scripts/test-home-explore-layout.mjs`
- 修改：`scripts/test-exploration-entry-browser.mjs`

**步骤 1：编写失败的所有权与点击测试**

测试断言：

- `#homeForestRouteHost #sceneGridMap` 恰好一个。
- 首页森林节点恰好 12 个。
- `#page-explore .map-scene-node` 始终为 0。
- 点击首页第一个森林节点后，`#explorationStageRoot` 可见。
- `#page-explore` 的故事地图 DOM 仍然存在且未被删除。

**步骤 2：运行测试以验证它失败**

```powershell
node scripts/test-home-explore-layout.mjs
node scripts/test-exploration-entry-browser.mjs
```

预期：独立舞台和故事地图保留断言失败。

**步骤 3：实现 `ForestRouteMap` 适配器**

`js/forest-route-map.js` 负责：

```js
window.ForestRouteMap = {
  async mount(hostId),
  unmount(),
  refresh(),
  openScene(sceneId)
};
```

内部继续复用 `ExplorationSystem.loadScenes()` 和 `renderSceneGridMap()`，但固定渲染到 `sceneGridMap`。点击节点把 `{ sceneId, returnTarget: 'home-forest-route' }` 交给场景舞台，不调用 `renderExplorePage(sceneId)`。

**步骤 4：迁移森林地图 CSS**

把地图板、SVG 路线、节点、锁定态和移动端尺寸迁到 `css/forest-route-map.css`，所有规则以 `.home-forest-route-host` 为根作用域。

**步骤 5：运行验证**

```powershell
node --check js/forest-route-map.js
node scripts/test-home-explore-layout.mjs
node scripts/test-exploration-entry-browser.mjs
```

预期：12 节点、点击进入、故事页不被污染均通过。

**步骤 6：提交**

```powershell
git add js/forest-route-map.js css/forest-route-map.css js/runtime-loader.js js/app.js scripts/test-home-explore-layout.mjs scripts/test-exploration-entry-browser.mjs
git commit -m "refactor: isolate forest route map"
```

### 任务 5：建立故事探索页编排器

**文件：**

- 创建：`js/pixel-story-page.js`
- 修改：`js/runtime-loader.js`
- 修改：`js/app.js`
- 修改：`js/pixel-story-map.js`
- 修改：`scripts/test-home-explore-dom-ownership.mjs`
- 修改：`scripts/test-pixel-story-map-layout-browser.mjs`

**步骤 1：编写失败测试**

断言 `PixelStoryPage` 使用既有 `#pixelStoryMapHost` 和 `#pixelStoryChapterHost`，并且：

```js
assert.doesNotMatch(appSource, /pageExplore\.innerHTML\s*=/);
assert.doesNotMatch(appSource, /ensureExploreMapShell/);
```

浏览器测试断言切换科幻、森林、方块和侦探时，`#pixelStoryMapHost` 本身不被替换。

**步骤 2：运行测试以验证它失败**

```powershell
node scripts/test-home-explore-dom-ownership.mjs
node scripts/test-pixel-story-map-layout-browser.mjs
```

预期：`pageExplore.innerHTML` 和宿主稳定性断言失败。

**步骤 3：实现 `PixelStoryPage`**

模块接口：

```js
window.PixelStoryPage = {
  async activate(options = {}),
  deactivate(),
  showMap(options = {}),
  showChapter(chapterId, options = {}),
  getViewState()
};
```

`activate()` 只切换固定宿主的 `hidden` 和 `aria-hidden`，不创建顶级壳。`PixelStoryMap.render()` 继续负责地图内部内容，但不能操作首页宿主或 `#page-explore`。

**步骤 4：删除旧探索壳函数**

从 `app.js` 删除：

- `getExploreMapShellHTML()`；
- `ensureExploreMapShell()`；
- `renderPixelStoryExplorePage()` 中整页 `innerHTML`；
- 已不再使用的 `switchExploreToAdventure()` 旧模式壳。

`runPageActivation('explore')` 改为等待 `PixelStoryPage.activate()`。

**步骤 5：运行验证**

```powershell
node --check js/pixel-story-page.js
node --check js/app.js
node scripts/test-home-explore-dom-ownership.mjs
node scripts/test-pixel-worlds-contract.mjs
node scripts/test-pixel-story-map-layout-browser.mjs
```

预期：全部通过，代码中不存在探索顶级容器整页改写。

**步骤 6：提交**

```powershell
git add js/pixel-story-page.js js/runtime-loader.js js/app.js js/pixel-story-map.js scripts/test-home-explore-dom-ownership.mjs scripts/test-pixel-story-map-layout-browser.mjs
git commit -m "refactor: give pixel story page stable hosts"
```

### 任务 6：把森林场景移入独立舞台

**文件：**

- 修改：`js/exploration-detail.js`
- 修改：`js/app.js`
- 创建：`css/exploration-stage.css`
- 修改：`js/runtime-loader.js`
- 创建：`scripts/test-exploration-return-target-browser.mjs`
- 修改：`scripts/run-full-regression.mjs`

**步骤 1：编写失败的返回目标测试**

覆盖两条路径：

```text
首页森林节点 → 森林对话舞台 → 返回首页森林路线
探索故事节点 → 像素章节舞台 → 返回原世界和原分页
```

森林场景打开时断言：

- `#explorationStageRoot .galgame-stage` 恰好一个。
- `#page-map` 和 `#page-explore` 的固定宿主均未被删除。
- 返回后 `#explorationStageRoot` 清空并隐藏。
- 语音停止，旧定时器不再继续更新舞台。

**步骤 2：运行测试以验证它失败**

```powershell
node scripts/test-exploration-return-target-browser.mjs
```

预期：当前 `ExplorationDetail.show()` 仍覆写 `#page-explore`，测试失败。

**步骤 3：修改 `ExplorationDetail` 接口**

把调用改为：

```js
ExplorationDetail.show(sceneId, {
  hostId: 'explorationStageRoot',
  returnTarget: 'home-forest-route'
});
```

`exit()` 不再调用模糊的 `renderExplorePage()`，而是发出一个命名空间事件或调用显式回调：

```js
window.dispatchEvent(new CustomEvent('petbank:exploration-stage-exit', {
  detail: { returnTarget, sceneId }
}));
```

`app.js` 根据 `returnTarget` 激活首页森林路线或故事地图。事件处理器必须在模块生命周期内只注册一次。

**步骤 4：迁移舞台样式并清理生命周期**

把 `.galgame-*` 规则迁到 `css/exploration-stage.css`。`deactivate()`/`exit()` 必须停止 `VoiceSystem`、清理计时器和移除舞台内容。

**步骤 5：运行验证**

```powershell
node --check js/exploration-detail.js
node scripts/test-exploration-return-target-browser.mjs
node scripts/test-short-travel-chapter-browser.mjs
node scripts/test-pixel-worlds-story-audio-browser.mjs
```

预期：两种返回路径和语音生命周期全部通过。

**步骤 6：提交**

```powershell
git add js/exploration-detail.js js/app.js css/exploration-stage.css js/runtime-loader.js scripts/test-exploration-return-target-browser.mjs scripts/run-full-regression.mjs
git commit -m "refactor: isolate exploration dialogue stage"
```

### 任务 7：修复深层入口加载空白

**文件：**

- 创建：`scripts/test-explore-deep-route-browser.mjs`
- 修改：`js/app.js`
- 修改：`js/pixel-story-page.js`
- 修改：`css/pixel-story.css`
- 修改：`scripts/run-full-regression.mjs`

**步骤 1：编写失败的深层入口测试**

直接访问 `http://127.0.0.1:7000/app/explore`，在 `DOMContentLoaded` 后立即断言以下二者至少一个可见：

- `#exploreLoadingState`；
- `#pixelStoryMapHost .pixel-story-map`。

随后等待 `document.body.classList.contains('app-ready')`，断言三世界 Tab 恰好 3 个、加载骨架隐藏、控制台错误为 0。

**步骤 2：运行测试以验证它失败**

```powershell
node scripts/test-explore-deep-route-browser.mjs
```

预期：当前页面在初始化窗口只显示背景，首个可见状态断言失败。

**步骤 3：实现路由级加载状态**

`index.html` 中的加载骨架默认可见。`PixelStoryPage.activate()` 完成地图首屏渲染后才隐藏骨架。初始化失败时将骨架改为带重试按钮的错误态，不得留下空容器。

`app-ready` 只代表当前首屏页面已经完成 `preparePage()` 和首屏渲染，不代表仅完成了顶级路由类切换。

**步骤 4：运行验证**

```powershell
node scripts/test-explore-deep-route-browser.mjs
node scripts/test-static-route-entries.mjs
node prj/route_aware_shell_contract.test.mjs
```

预期：深层入口全程有可见反馈，最终故事地图加载完成。

**步骤 5：提交**

```powershell
git add scripts/test-explore-deep-route-browser.mjs js/app.js js/pixel-story-page.js css/pixel-story.css scripts/run-full-regression.mjs
git commit -m "fix: render explore deep route loading state"
```

### 任务 8：删除无主 CSS 和旧入口代码

**文件：**

- 修改：`css/style.css`
- 修改：`css/pixel-story.css`
- 修改：`index.html`
- 修改：`js/app.js`
- 修改：`scripts/test-home-explore-dom-ownership.mjs`

**步骤 1：扩展失败测试**

禁止以下遗留符号：

```text
homePixelWorldMapSlot
home-pixel-world-map-shell
home-explore-modebar
data-home-explore-mode
openHomeExploreMode
ensureExploreMapShell
home-demo-original-content
```

**步骤 2：运行测试并确认失败**

```powershell
node scripts/test-home-explore-dom-ownership.mjs
```

预期：仍有遗留选择器或函数时失败。

**步骤 3：按引用证据删除**

使用 `rg` 确认每个符号只剩定义、没有运行时 DOM 或调用者后，再从 CSS/JS 删除。不要顺手清理其他页面样式。

**步骤 4：运行聚焦回归**

```powershell
node scripts/test-home-explore-dom-ownership.mjs
node scripts/test-home-browser.mjs
node scripts/test-home-explore-layout.mjs
node scripts/test-exploration-entry-browser.mjs
node scripts/test-pixel-story-map-layout-browser.mjs
```

预期：全部通过。

**步骤 5：提交**

```powershell
git add css/style.css css/pixel-story.css index.html js/app.js scripts/test-home-explore-dom-ownership.mjs
git commit -m "chore: remove legacy home explore shells"
```

### 任务 9：全量验证、制品与文档回写

**文件：**

- 修改：`docs_project/modules/exploration.md`
- 修改：`docs_project/runbooks/testing-and-release.md`
- 修改：`docs/方案/2026-07-18-首页与探索地图解耦分析方案.md`
- 创建：`docs/变更/2026-07-18-首页与探索地图解耦验证记录.md`

**步骤 1：运行语法和聚焦测试**

```powershell
node --check js/app.js
node --check js/home-dashboard.js
node --check js/forest-route-map.js
node --check js/pixel-story-page.js
node --check js/exploration-detail.js
node scripts/test-home-explore-dom-ownership.mjs
node scripts/test-explore-deep-route-browser.mjs
node scripts/test-exploration-return-target-browser.mjs
```

预期：全部通过。

**步骤 2：运行全量回归**

```powershell
$env:PETBANK_BASE_URL='http://127.0.0.1:7000/'
node scripts/run-full-regression.mjs
```

预期：runner 全部任务通过；若失败，只修复与本计划改动直接相关的问题。

**步骤 3：验证 Pages 制品**

```powershell
node scripts/test-pages-fast-gate-contract.mjs
node scripts/test-static-route-entries.mjs
node scripts/assemble-pages-artifact.mjs _site_verify
```

预期：制品组装成功，`/app` 和 `/app/explore` 深层入口所需 JS/CSS 均在白名单内。

**步骤 4：人工截图验收**

在 1280×900、390×844 两种尺寸分别截图：

```text
首页首屏
首页森林螺旋路线
探索三世界卡片地图
森林场景对话舞台
像素章节对话舞台
两类场景退出后的返回页
```

截图写入 `tmp/test-artifacts/`，不提交 Git。验证记录只登记命令、结果和截图文件名。

**步骤 5：同步工程事实**

更新 `docs_project/modules/exploration.md`：明确四个宿主、模块所有权、返回状态和生命周期。更新 `docs_project/runbooks/testing-and-release.md`：登记三个新测试及适用范围。回写分析方案的完成项，不把未实施能力写成已完成。

**步骤 6：提交**

```powershell
git add docs_project/modules/exploration.md docs_project/runbooks/testing-and-release.md docs/方案/2026-07-18-首页与探索地图解耦分析方案.md docs/变更/2026-07-18-首页与探索地图解耦验证记录.md
git commit -m "docs: record home explore decoupling verification"
```

## 最终验收矩阵

| 场景 | DOM 断言 | 交互断言 | 视觉断言 |
| --- | --- | --- | --- |
| 首页 | 单一任务/进度层；12 个森林节点 | 节点可进入森林场景 | 三栏磨砂布局，无第二套首页 |
| 探索 Tab | 三世界 Tab；森林路线节点为 0 | 世界、分页、侦探入口可点击 | 卡片地图不与螺旋地图叠加 |
| 森林场景 | 只写独立舞台宿主 | 退出回首页森林路线 | 对话栏位于图片下方 |
| 像素章节 | 地图宿主保留，章节宿主切换 | 退出回原世界和原分页 | 章节图、角色和对白布局稳定 |
| 深层 URL | 首帧加载态存在 | 初始化后进入故事地图 | 不出现纯背景空白页 |
| 页面离开 | 舞台清空，地图 DOM 不丢失 | 音频、计时器停止 | 无残留遮罩或跳变 |
