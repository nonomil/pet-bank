# 孩子端三栏工作台

> 核心文件：`js/child-workbench-shell.js`、`css/child-workbench-shell.css`、`index.html`
> 浏览器契约：`scripts/test-child-workbench-shell-browser.mjs`

## 信息架构

孩子端内容页使用统一的三栏工作台：

```text
左侧一级分类  →  中间当前页面与二级入口  →  右侧个人成长进度
```

左侧固定 7 个一级入口：首页、今日、学习、绘本、宠物、探索、游乐场。绘本是独立一级入口，不再依赖学习页顶部横向导航。

孩子端工作台隐藏顶部导航栏和底部一级 Dock，避免多层导航重复。品牌和路由信息保留为页面状态，不再承担导航；孩子切换、家长区入口迁移到左侧一级栏下方，成长分和下一步操作集中在右侧进度栏。

## 路由边界

`ChildWorkbenchShell.sync(page)` 根据 `PetBankPageRouter.getRouteShell(page)` 决定是否启用：

- `home` 壳层的内容页启用工作台，并按 `getPageToTab(page)` 高亮父级一级分类。
- `app` 壳层的全屏游戏、森林/故事对话舞台保留专用界面，不挂工作台。
- `parent` 壳层的家长区、设置、作品和工具不挂孩子端工作台。

首页内部原有的任务侧栏和成长右栏不再作为第二套全局导航显示；学习页只有在 `learn` 工作台显示中间内容顶部的二级横向导航。首页、绘本、宠物、探索等默认页面隐藏二级栏并使用完整中间内容区域。森林探险路线由探索下的 `forest-map` 子页面负责，故事地图由 `explore` 页面负责，首页不嵌入任何地图宿主。

## 数据边界

右侧进度只读取现有 `PetBankPoints`、`petbank_tasks_completed_today`、`PetSystem` 和 `ProfileManager` 状态，不新增业务存储键，也不直接修改积分账本。新的入口点击继续调用 `switchPage()`，保持现有路由、runtime-loader 和 Profile 生命周期契约。

## 响应式

- 桌面：`224px / minmax(0, 1fr) / 264px`。
- 中等屏幕：进度栏移到内容区域下方。
- 移动端：一级分类变成横向滚动栏，内容单列，右侧进度堆叠到最后；不允许横向溢出。

## 结构与溢出修复记录（2026-07-18）

- 首页 `.page-shell` 的右侧进度栏必须与 `#childPrimarySidebar`、`#mainContent` 保持同级；首页宝箱区末尾多余的闭合标签会使浏览器提前结束工作台，导致进度栏被解析到 `body`。
- 窄屏工作台使用 `align-items: stretch`，并将三个直接子项限制为 `width/max-width: 100%`；这样学习页内部的大卡片不会把 `#mainContent` 撑出视口。
- 回归入口：`scripts/test-child-workbench-shell-browser.mjs`，覆盖桌面三栏边界、移动端总宽度、一级入口切换和非工作台页面隐藏状态。
- 顶部栏收敛回归同时覆盖左侧切换孩子面板和家长区入口，确保隐藏顶部后功能入口仍可用。
