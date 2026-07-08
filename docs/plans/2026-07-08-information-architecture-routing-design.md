# 信息架构与路径化路由实施计划

> **给 Claude:** 后续若继续批量拆页，使用 superpowers:executing-plans 分任务实施。

**目标：** 让“官网 / 孩子主应用 / 家长与设置管理区”逐步拥有清晰页面边界，并先把 settings 做成可直达的路径化子页。

**架构：** 短期不引入框架，不重写现有玩法模块；保留 `index.html + switchPage()` 的静态 SPA 形态，加一层 `URL path <-> page/section` 的薄路由。中期优先拆 `/settings/*`，长期再决定官网、孩子应用、家长区是否独立入口或独立部署。

**技术栈：** Vanilla JS、静态 HTML/CSS、History API、GitHub Pages 404 fallback。

---

## 现状诊断

当前主站仍以 `index.html` 为唯一主入口，页面容器集中写成 `<div class="page" id="page-...">`，由 `js/app.js` 的 `switchPage(page)` 切换 `.active`。这个模式对早期静态原型很快，但现在页面已经扩展到首页、积分、学习、宠物、小屋、探索、游乐场、作品、工具箱、设置、云端家庭等多个产品域，继续只靠内存态切页会让“页面边界”越来越模糊。

已经有一个独立 `admin.html`，说明项目并不排斥多入口；但孩子主站内部仍几乎都塞进一个 HTML。`docs/原始需求/网站--设置--参考.md` 里的班宠乐园结构值得借鉴的不是功能数量，而是它把日常大厅、工具、班级管理、账户设置、家长查看拆成了用户心智明确的区域。当前项目已经把 `成长作品 / 工具箱 / 设置` 收进右上角“家长区”，但 settings 仍是“一个大页里的多个卡片分区”，还没有成为真正可直达、可扩展、可权限化的管理区。

## 问题归因

路径化路由缺失导致的问题：

- 不能直接打开 `/settings`、`/settings/account`、`/learn` 等地址，刷新或分享链接无法稳定回到对应页面。
- 浏览器历史前进/后退不表达产品导航，只表达最初打开的 HTML。
- 页面可观测性差：日志、截图、用户反馈只能说“点到设置页”，不能定位到设置里的具体子域。
- 未来拆官网、孩子端、家长端时，没有现成 URL 合同可迁移。

设置页内容分层错误导致的问题：

- “孩子档案、家长账号、家庭云端、学习题目、规则模板、危险操作”混在同一设置页，会让家长误以为它们是同级高频操作。
- 云端登录、好友码、诊断、数学难度等模块的生命周期不同，但现在都依赖进入 `settings` 时统一触发。
- 高风险操作虽然有隐藏开关，但在信息架构上仍挂在同一个大设置上下文里，后续加权限、备份确认、审计记录时会继续膨胀。
- “家长区”与“设置”概念相互挤压：家长区应该是管理域入口，设置只是其中一类管理任务。

## 分阶段方案

### 第一阶段：SPA 路径化路由

保留现有 `switchPage()`，增加轻量 route map：

- `/` -> `map`
- `/today/*` -> 积分域叶子页
- `/learn/*` -> 学习域叶子页
- `/pet/*` -> 宠物域叶子页
- `/playground/*` -> 游乐场域叶子页
- `/settings/*` -> 设置域与子页

实现方式是 History API 同步路径、`popstate` 恢复页面、初始化时从 `location.pathname` 反推当前 page。静态托管侧要补 fallback，否则深链刷新会 404；当前采用 Pages artifact 自动复制 `index.html` 为 `404.html`。

### 第二阶段：优先拆 `/settings/*`

先把 settings 从“大杂烩”改成“设置首页 + 子页入口”：

- `/settings`：设置首页，只放入口与说明。
- `/settings/account`：孩子账号与档案。
- `/settings/family`：家长账号、家庭同步、好友边界。
- `/settings/learning`：学习单模式、数学 PK 难度。
- `/settings/rules`：积分规则模板，先保留规划态。
- `/settings/advanced`：备份、诊断、覆盖类危险操作。

这样做的好处是最小改动即可建立管理域的信息架构合同，同时不破坏现有 `SettingsPage.render()`、`AuthSystem.render()`、`HouseholdSystem.refresh()` 等挂载点。

### 第三阶段：官网 / 孩子应用 / 家长区边界

等 `/settings/*` 稳定后，再评估更强边界：

- 官网：`/` 可以逐步变成公开介绍、登录、下载与入口选择；当前孩子应用首页迁到 `/app` 或 `/app/map`。
- 孩子主应用：保留游戏化主流程，路径以 `/app/today`、`/app/pet`、`/app/playground` 等为主，避免混入管理页。
- 家长区：迁到 `/parent` 或独立子域，内部包含孩子档案、家庭、规则、数据、报表与权限。
- 后台管理：保留 `admin.html` 或升级为 `/admin`，只给系统维护者使用。

这一步不要现在硬拆。先让 URL 合同、设置子页、fallback 和测试跑稳，再决定是继续静态 SPA、做多 HTML，还是引入路由框架。

## 本轮 MVP

本轮已实施的最小范围：

- `js/app.js`：新增路径解析、History API 同步、`popstate`、settings 子页状态。
- `index.html`：settings 改为首页和五个子页面板，并保留原有功能挂载点。
- `css/style.css`：新增 settings 子页导航、首页入口和响应式规则。
- `scripts/assemble-pages-artifact.mjs`：发布 artifact 自动生成 `404.html` 深链 fallback。
- `prj/url_routing_and_settings_subpages.test.mjs`：新增契约测试覆盖路径映射、子页面板、挂载点和 fallback。

## 第二轮边界 URL 合同

在不拆物理文件、不引入路由框架的前提下，继续把 URL 语义向“官网 / 孩子应用 / 家长区”靠拢：

- 孩子主应用的规范路径迁到 `/app/*`，例如 `/app`、`/app/today`、`/app/learn`、`/app/pet`、`/app/playground/math-pk`。
- 旧路径 `/`、`/today`、`/learn`、`/pet`、`/playground/*` 保留为兼容入口，打开后由 `switchPage()` 写回规范路径。
- settings 保留用户明确提到的 `/settings/*` 直达路径，同时增加 `/parent/settings/*` 作为家长区命名空间别名。
- `/parent/works`、`/parent/tools` 继续作为家长区低频管理页，后续可补真正的 `/parent` 管理首页。

这一轮只建立 URL 合同，不改变页面布局和权限模型。下一步若继续推进，可以把 `settings` 的子页渲染从一个 HTML 面板进一步拆成模块化配置，并把 `/parent` 做成家长管理首页。

## 第三轮 `/parent` 家长管理首页

`/parent` 已从 settings 的别名升级为独立的家长管理首页。它仍然位于当前 SPA 内部，但信息架构上已经成为家长区总览：

- 右上角“家长区”入口进入 `/parent`，不再直接落到 settings。
- `/parent` 展示“设置管理 / 成长作品 / 工具箱”三个管理入口。
- `/parent/works`、`/parent/tools` 继续作为家长区叶子页。
- `/settings/*` 继续保留为用户明确希望的短路径，`/parent/settings/*` 继续作为家长区命名空间别名。
- 孩子主应用仍以 `/app/*` 为规范路径，避免把家长管理入口混入孩子日常导航。

这一轮仍未做物理多页拆分。现在的边界是“路径和页面容器层面的分区”，下一步才适合评估是否拆 `parent.html`、`settings.html` 或引入正式路由框架。

## 第四轮 Route-aware Shell

导航壳开始跟随信息架构切换，而不是所有页面共用同一套顶部大导航：

- `/app/*` 和旧兼容孩子页进入 `shell-app`：隐藏旧顶部大导航和左侧栏，显示孩子端轻量状态条与底部 Dock。
- 孩子端状态条保留“返回孩子首页 / 当前孩子与成长分 / 家长区”三个核心动作，避免沉浸页迷路。
- 底部 Dock 收纳首页、积分、学习、宠物、探索、游乐场六个孩子端主入口，叶子页按父栏目高亮。
- `/parent`、`/parent/works`、`/parent/tools`、`/settings/*` 进入 `shell-parent`：保留管理型顶部，隐藏孩子端主导航，强调家长区管理任务。
- 增加 skip link 和 main 跳转目标，避免新增导航后键盘用户要反复穿过导航。

这一步仍是 SPA 内的壳切换，不是物理多页面。后续可以继续把 `/app/explore`、`/app/playground/*`、`/app/pet/home` 做成更强沉浸页，并把 `/parent/settings/*` 的管理导航整理成更像后台控制台的左侧栏。

## 第五轮家长管理导航

`shell-parent` 继续从“保留旧顶部导航”向管理控制台靠近：

- 增加 `parent-shell-nav`，只在家长管理壳显示。
- 管理导航包含“家长首页 / 设置管理 / 成长作品 / 工具箱 / 进入孩子端”。
- `/settings/*` 和 `/parent/settings/*` 会高亮“设置管理”；`/parent/works` 和 `/parent/tools` 分别高亮对应管理页。
- 孩子端 `shell-app` 明确隐藏这条管理导航，只保留孩子状态条和底部 Dock。
- 管理导航使用本地 `lucide-lite` 图标，避免新增外部依赖或空图标。

这一轮让家长区的导航不再依赖孩子端一级导航。后续如果继续增强，可以把 `parent-shell-nav` 从横向条升级为宽屏左侧栏、移动端顶部 tabs，并把设置子页导航与家长管理导航合并得更像控制台。

## 第六轮孩子端沉浸壳分类

`shell-app` 不再只是“隐藏旧导航 + 展示 Dock”，而是开始输出孩子端页面分类：

- `data-app-page`：当前 Dock 归属页，例如 `playground`、`explore`、`pet`。
- `data-app-route-page`：真实 SPA 页，例如 `mathpk`、`hanzi`、`home`，为后续子游戏或宠物小屋全屏化预留精确钩子。
- `data-app-surface`：页面壳类型，当前分为 `home`、`focus`、`studio`、`scene`、`game`。

这一轮只做壳层和间距：`scene/game` 优先接近全屏舞台，`focus/studio/home` 保持可阅读但占满视口。这样做避免把所有页面粗暴改成同一种全屏，也避免破坏游乐场、探索、宠物等页面内部已经存在的独立样式。后续可以按真实页面逐个推进：先做 `/app/playground/*` 和 `/app/explore` 的舞台化，再做 `/app/pet/home` 的宠物房间沉浸化。

## 验证点

- 静态契约：`node prj/url_routing_and_settings_subpages.test.mjs`
- 导航壳契约：`node prj/route_aware_shell_contract.test.mjs`
- 既有家长区结构：`node prj/parent_settings_sections_contract.test.mjs`
- 隐藏管理接口：`node prj/parent_management_hidden_interfaces.test.mjs`
- 浏览器冒烟：打开 `/settings/account`，应激活 settings 页的“账号与孩子”；点击“家庭云端”后 URL 应变成 `/settings/family`。
