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

## 验证点

- 静态契约：`node prj/url_routing_and_settings_subpages.test.mjs`
- 既有家长区结构：`node prj/parent_settings_sections_contract.test.mjs`
- 隐藏管理接口：`node prj/parent_management_hidden_interfaces.test.mjs`
- 浏览器冒烟：打开 `/settings/account`，应激活 settings 页的“账号与孩子”；点击“家庭云端”后 URL 应变成 `/settings/family`。
