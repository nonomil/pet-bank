# 家庭账号与家长端边界实施计划

> **给 Claude：** 必需子技能：使用 `superpowers:executing-plans` 来逐任务实施此计划。

**目标：** 将当前共用 SPA 壳改造成 `/app/*` 孩子端与 `/parent/*` 家长端的清晰入口，并把新增孩子改成家长端一次完成的向导流程。

**架构：** 保留 Vanilla JS + 静态 SPA + History API，不重写现有宠物、积分、学习和社交业务模块。新增一个很小的家长入口/身份判断模块，负责路径分类、登录回跳和手机号/邮箱识别；`app.js` 只负责把它接到现有 route-aware shell。孩子仍使用现有本地 profile，家长账号继续使用 Supabase session，新增孩子成功后在云端可用时自动同步。

**技术栈：** Vanilla JavaScript、HTML/CSS、Supabase Auth、localStorage、Node.js `.mjs` 合同测试、现有 Playwright 浏览器冒烟脚本。

---

## 实施约束

- 工作区已有大量与本任务无关的修改和未跟踪文件；每个提交只加入本任务明确列出的文件。
- 不把真实手机号、密码、Supabase key 或登录态写入源码、测试夹具、截图或文档。
- 不删除旧 `/settings/*`、`/today`、`/learn` 等路径，先保留兼容映射。
- 先写失败测试，再写最小实现；每个任务完成后单独提交。
- `docs/plans/*` 被 `.gitignore` 忽略，提交计划或后续文档时使用 `git add -f`，不要修改忽略规则。

## 现有实现定位

- 路由和壳：`js/app.js` 中 `ROUTE_TO_PAGE`、`resolveRouteFromLocation()`、`updateBrowserRoute()`、`updateShellState()`、`switchPage()`；`index.html` 顶部导航、`parent-shell-nav`、`app-shell-bar` 和页面容器。
- 家长认证：`js/auth.js` 的 `renderAuthCard()`、`boot()`、`handleSubmit()`、`signOut()`；由 runtime-loader 的 `cloud` bundle 按需加载。
- 本地孩子档案：`js/profiles.js` 的 `ProfileManager`、`ProfileUI`、`SettingsPage`；当前 `SettingsPage.create()` 和 `ProfileUI.create()` 都依赖 `prompt()`。
- 家庭同步：`js/household.js` 的 `ensurePrimaryHousehold()`、`syncActiveChild()`、`syncAllChildren()`；`js/profile-sync.js` 和 `js/cloud-restore.js` 负责映射和恢复。
- 现有相关合同：`prj/route_aware_shell_contract.test.mjs`、`prj/url_routing_and_settings_subpages.test.mjs`、`prj/parent_settings_sections_contract.test.mjs`、`scripts/static-route-runtime-smoke.mjs`。

### 任务 1：先建立家长/孩子边界失败合同

**文件：**
- 创建：`prj/parent_child_account_boundary_contract.test.mjs`
- 参考：`index.html`、`js/app.js`、`js/auth.js`、`js/profiles.js`

**步骤 1：编写失败测试**

加入 Node 内置 `assert` 合同测试，先锁定这些要求：

```js
assert.match(shell, /parent-auth-root/);
assert.match(shell, /parent-children-root/);
assert.match(appSource, /\/parent\/login/);
assert.match(appSource, /\/parent\/children/);
assert.doesNotMatch(profilesSource, /prompt\(/);
assert.match(authSource, /signInWithPassword/);
assert.match(authSource, /phone/);
```

同时检查：

- 家长路径包含 `/parent`、`/parent/login`、`/parent/children`、`/parent/family`、`/parent/records`、`/parent/settings`。
- 页面同时存在孩子壳和家长壳的可识别标记。
- 家长壳有独立认证挂载点，不再只能把认证放进 `/settings/family`。

**步骤 2：运行测试确认失败**

运行：`node prj/parent_child_account_boundary_contract.test.mjs`

预期：FAIL，当前源码没有独立家长登录/孩子档案挂载点，且 `profiles.js` 仍包含 `prompt()`。

**步骤 3：提交测试基线**

```bash
git add prj/parent_child_account_boundary_contract.test.mjs
git commit -m "test: define parent child account boundary"
```

### 任务 2：实现可测试的家长入口判断模块

**文件：**
- 创建：`js/parent-access.js`
- 修改：`index.html:1530-1541`，在 `profiles.js` 之后、`app.js` 之前加载
- 测试：扩展 `prj/parent_child_account_boundary_contract.test.mjs`

**步骤 1：写模块行为测试**

用 `vm.runInNewContext()` 加载 `js/parent-access.js`，覆盖以下纯函数：

- `isParentRoute(path)`：识别 `/parent` 和其子路径。
- `normalizeReturnTo(path)`：只接受站内 `/parent/*` 路径，拒绝外部 URL 和 `javascript:`。
- `getLoginPath(returnTo)`：生成 `/parent/login?returnTo=...`。
- `getAuthProvider(identifier)`：包含 `@` 返回 `email`，否则返回 `phone`。
- `getSurface(path)`：返回 `parent` 或 `app`。

**步骤 2：运行测试确认失败**

运行：`node prj/parent_child_account_boundary_contract.test.mjs`

预期：FAIL，`ParentAccess` 尚未定义。

**步骤 3：实现最小 IIFE 模块**

实现 `window.ParentAccess`，只放路径和身份判断，不在此模块访问 DOM、Supabase 或 localStorage。所有回跳值都经 `normalizeReturnTo()` 限制为站内路径。

**步骤 4：加载并运行测试**

在 `index.html` 增加相对路径脚本后运行：`node prj/parent_child_account_boundary_contract.test.mjs`

预期：入口判断相关断言 PASS；页面壳和 `profiles.js` 断言仍可能 FAIL，继续保留为后续任务的红灯。

**步骤 5：提交**

```bash
git add js/parent-access.js index.html prj/parent_child_account_boundary_contract.test.mjs
git commit -m "feat: add parent access route helper"
```

### 任务 3：建立真正区分的 app/parent shell 与路径合同

**文件：**
- 修改：`index.html:70-165`、`index.html:316-520`、页面脚本区域
- 修改：`js/app.js:2199-2640` 附近路由、壳状态和 `switchPage()` 逻辑
- 修改：`css/style.css:2410-2760` 附近 shell 规则
- 测试：`prj/parent_child_account_boundary_contract.test.mjs`、`prj/route_aware_shell_contract.test.mjs`、`scripts/static-route-runtime-smoke.mjs`

**步骤 1：补充路由和壳失败断言**

增加静态和运行时合同：

- `/parent/login` 映射到家长登录页面。
- `/parent/children` 映射到孩子档案页面。
- `/parent/family`、`/parent/records`、`/parent/tools`、`/parent/settings/*` 映射到家长域页面。
- 家长壳下隐藏完整 `.top-nav`、孩子 profile switcher、`.app-shell-bar` 和孩子 Dock。
- 孩子壳下不显示家长管理导航和家长账号/家庭配置挂载点。
- 家长壳的管理导航 top offset 从孩子顶部导航解耦，宽屏和移动端都能单独布局。

运行：

```bash
node prj/parent_child_account_boundary_contract.test.mjs
node prj/route_aware_shell_contract.test.mjs
```

预期：新断言 FAIL，现有 `shell-parent` 仍保留孩子顶部壳元素，路由表也没有完整家长路径。

**步骤 2：调整 HTML 壳标记和挂载点**

在现有单 HTML 入口内保留业务页面，但增加稳定标记：

- `data-shell-surface="app"` 和 `data-shell-surface="parent"`。
- 独立 `parent-auth-root`。
- 独立 `parent-children-root`，供家长孩子档案页使用。
- 家长壳导航只包含家长首页、孩子档案、家庭、成长记录、工具、设置和退出/回到孩子端。
- 从孩子常驻导航移除 `家长区`、家庭云端和账号管理的可见入口；旧路径仍由直接 URL 兼容。

保留旧 `settings` 页面挂载点，避免现有 `AuthSystem`、`HouseholdSystem`、`SocialSystem` 和诊断模块断裂。

**步骤 3：接入路由分类和壳状态**

在 `ROUTE_TO_PAGE` 增加家长路径，在 `resolveRouteFromLocation()` 中统一兼容旧 `/settings/*`。`updateShellState()` 使用 `ParentAccess.getSurface()` 设置 `body.dataset.routeShell` 和相关 surface 属性；不要让业务模块自己判断家长/孩子壳。

家长页面初始化时先显示认证页或加载态，避免在 session 尚未返回前短暂闪出孩子内容。

**步骤 4：调整 CSS**

在 `body.shell-parent` 下明确隐藏 `.top-nav`，并让 `.parent-shell-nav` 从 `top: 0` 开始；在 `body.shell-app` 下明确隐藏 `.parent-shell-nav` 和所有家长专用模块。为家长登录页和孩子卡片增加独立的响应式布局，避免复用孩子端大导航样式。

**步骤 5：运行合同与静态路由测试**

运行：

```bash
node prj/parent_child_account_boundary_contract.test.mjs
node prj/route_aware_shell_contract.test.mjs
node prj/url_routing_and_settings_subpages.test.mjs
```

预期：三项 PASS。若需要浏览器服务，再运行 `node scripts/static-route-runtime-smoke.mjs`，预期新增家长路由全部返回正确 path/shell。

**步骤 6：提交**

```bash
git add index.html js/app.js css/style.css prj/parent_child_account_boundary_contract.test.mjs prj/route_aware_shell_contract.test.mjs scripts/static-route-runtime-smoke.mjs
git commit -m "feat: separate parent and child navigation shells"
```

### 任务 4：把认证改为手机号主路径并加入家长路由守卫

**文件：**
- 修改：`js/auth.js` 的 `renderAuthCard()`、`handleSubmit()`、`boot()`、`signOut()`
- 修改：`js/app.js` 的家长页面初始化和登录回跳
- 修改：`index.html` 家长登录挂载点
- 测试：创建 `prj/auth-identifier-contract.test.mjs`

**步骤 1：编写失败测试**

静态/VM 测试覆盖：

- 登录表单默认有手机号输入和密码输入。
- 仍能识别包含 `@` 的旧邮箱账号。
- 注册邀请码字段继续保留。
- 未登录家长路径会生成带 `returnTo` 的 `/parent/login`。
- 登录成功后只允许回到受 `ParentAccess.normalizeReturnTo()` 保护的站内路径。
- 错误文案不直接输出 token、堆栈或 Supabase 原始响应对象。

运行：`node prj/auth-identifier-contract.test.mjs`

预期：FAIL，当前 `auth.js` 只读取 `email`，没有手机号分支和路由守卫合同。

**步骤 2：实现标识符归一化**

在 `auth.js` 内增加小型内部函数：

- 清理手机号空格、短横线和前后空白。
- 保留邮箱原样的小写归一化。
- 按 `ParentAccess.getAuthProvider()` 选择 `signInWithPassword({ phone, password })` 或 `{ email, password }`。
- 注册时把 `parent_name`、注册邀请码元数据传给对应 provider。

不要把用户输入或密钥写入 localStorage 之外的持久化位置；沿用 Supabase SDK 的 session 管理。

**步骤 3：实现家长路由守卫**

在 `app.js` 的初始化/切页路径上：

- `/parent/login` 无需 session。
- 其他 `/parent/*` 在 session 未准备好时显示加载态，确认未登录后跳转登录页。
- 保存并恢复 `returnTo`，登录成功进入原目标。
- `signOut()` 后回到 `/parent/login`，不把当前家长页面留在可见 DOM 状态。

守卫只控制 UI 路由，不绕过 Supabase RLS。

**步骤 4：运行认证合同测试**

运行：`node prj/auth-identifier-contract.test.mjs`

预期：PASS。

**步骤 5：提交**

```bash
git add js/auth.js js/app.js index.html prj/auth-identifier-contract.test.mjs
git commit -m "feat: add parent auth guard and phone login"
```

### 任务 5：用家长端向导替换 prompt 加孩子

**文件：**
- 修改：`js/profiles.js` 的 `ProfileUI`、`SettingsPage`
- 修改：`index.html` 家长孩子档案容器和对话框挂载点
- 修改：`css/style.css` 增加家长孩子卡片、创建向导和操作菜单样式
- 测试：创建 `prj/child_creation_wizard_contract.test.mjs`

**步骤 1：编写失败测试**

测试要求：

- `profiles.js` 不再调用 `prompt()`。
- 暴露 `ProfileUI.openCreateDialog()`、`ProfileUI.closeCreateDialog()`、`ProfileUI.submitCreateDialog()`。
- 创建输入包含昵称和头像选择。
- 创建成功结果默认激活新 profile，不再弹出“是否切换”。
- 删除仍需要确认，且不能删除唯一的默认档案。

运行：`node prj/child_creation_wizard_contract.test.mjs`

预期：FAIL，当前 `ProfileUI.create()` 和 `SettingsPage.create()` 都使用 `prompt()`。

**步骤 2：实现最小向导状态**

在 `ProfileUI` 内维护 `createDialogOpen`、`draftName`、`draftEmoji`，使用事件监听提交；不要再把用户输入拼进内联 `onclick`。提交时：

1. 校验昵称非空且长度在合理范围内。
2. 调用现有 `ProfileManager.create(name, emoji)`。
3. 写入一次性 `petbank_pending_child_sync` 标记。
4. 调用现有 `ProfileManager.switchTo(profile.id)`，沿用当前 reload 机制确保所有业务模块重新加载。

如果未来取消 reload，可以再单独改造 profile 事件；本次不扩大范围。

**步骤 3：重做孩子卡片**

`SettingsPage.render()` 输出头像、昵称、当前状态、同步状态和“进入孩子端”按钮；改名/删除进入卡片操作菜单。家长端的添加按钮只出现一次，普通孩子端不输出该区域。

**步骤 4：运行向导合同测试**

运行：`node prj/child_creation_wizard_contract.test.mjs`

预期：PASS，并确认既有 `scripts/test-english-vocab-profile-scope.mjs` 和 `prj/profile_isolation_journey_simulation.mjs` 不回归。

**步骤 5：提交**

```bash
git add js/profiles.js index.html css/style.css prj/child_creation_wizard_contract.test.mjs
git commit -m "feat: add guided parent child creation"
```

### 任务 6：让新孩子在云端可用时自动同步

**文件：**
- 修改：`js/household.js` 的 `syncActiveChild()`、`ensurePrimaryHousehold()` 和公开状态
- 修改：`js/auth.js` 的 session ready/restore 流程
- 修改：`js/cloud-restore.js` 或 `js/profile-sync.js` 的启动恢复钩子
- 修改：`js/profiles.js` 的一次性 pending sync 标记
- 测试：创建 `prj/parent_child_sync_after_create.test.mjs`

**步骤 1：编写失败测试**

用假的 `ProfileManager`、`CloudClient` 和 `HouseholdSystem` 验证：

- 云端配置和 session 都存在时，新 profile 标记最终调用 `ensurePrimaryHousehold()` 再调用 `syncActiveChild()`。
- 云端不可用时，新 profile 不被删除，pending 标记保留或转为可重试状态。
- 同步完成后 pending 标记清除。
- 同步异常不会覆盖本地 profile 数据。

运行：`node prj/parent_child_sync_after_create.test.mjs`

预期：FAIL，当前新增 profile 没有自动同步合同。

**步骤 2：实现一次性同步协调**

增加小型 `consumePendingChildSync()` 流程，优先在 Auth session ready 且 HouseholdSystem 已加载后执行：

1. 读取 pending profile id。
2. 确认该 profile 仍存在并切换状态有效。
3. 确认云端 client/session 可用。
4. `await ensurePrimaryHousehold()`。
5. `await syncActiveChild()`。
6. 成功清除 pending；失败记录用户可见的重试状态，不清除本地档案。

避免在 cloud bundle 尚未加载时直接引用未定义模块；沿用现有按需加载和防御式 `typeof` 检查。

**步骤 3：运行同步测试和既有家庭模拟**

运行：

```bash
node prj/parent_child_sync_after_create.test.mjs
node prj/profile_isolation_journey_simulation.mjs
node prj/cloud_family_social_pk_simulation.mjs
```

预期：新增同步合同 PASS，既有 profile 隔离和 Fake Supabase 家庭社交模拟不回归。

**步骤 4：提交**

```bash
git add js/household.js js/auth.js js/cloud-restore.js js/profile-sync.js js/profiles.js prj/parent_child_sync_after_create.test.mjs
git commit -m "feat: sync newly created children when cloud is ready"
```

### 任务 7：补齐家长页面文案、文档索引和兼容说明

**文件：**
- 修改：`docs_project/ARCHITECTURE.md`
- 修改：`docs_project/modules/social-household.md`
- 修改：`docs_project/runbooks/account-auth-supabase-deploy.md`
- 修改：`docs/家长区与管理接口/00-方案总览.md`
- 修改：`docs/家长区与管理接口/02-当前项目入口说明.md`
- 修改：`docs/家长区与管理接口/03-隐藏接口与权限边界.md`
- 修改：`docs/家长区与管理接口/04-实施与验收清单.md`

**步骤 1：更新架构合同**

记录 `/app/*` 与 `/parent/*` 的边界、手机号/邮箱兼容、孩子档案不是独立登录账号、前端守卫不替代 RLS。

**步骤 2：更新家长入口说明**

把“家长区是右上角入口、账号在 settings/family”的旧描述改为 `/parent/login`、`/parent/children`、`/parent/family` 等规范路径；标注旧 `/settings/*` 为兼容路径。

**步骤 3：更新验收清单**

加入本次新增的未登录守卫、家长壳不显示孩子导航、添加孩子一次完成、云端失败保留本地档案等验收项。

**步骤 4：提交文档**

```bash
git add docs_project/ARCHITECTURE.md docs_project/modules/social-household.md docs_project/runbooks/account-auth-supabase-deploy.md docs/家长区与管理接口
git commit -m "docs: update parent child account boundaries"
```

### 任务 8：浏览器验证与回归

**文件：**
- 修改：`scripts/static-route-runtime-smoke.mjs`（只在新增路由需要时）
- 测试：任务 1、4、5、6 新增合同和现有回归脚本

**步骤 1：启动静态服务器**

运行现有启动方式或：

```powershell
python -m http.server 8765
```

使用未占用端口；不要复用已被其他进程占用的端口。

**步骤 2：运行静态路由冒烟**

运行：`node scripts/static-route-runtime-smoke.mjs`

预期：所有 app/parent/settings 路径的 URL、页面和壳状态符合合同。

**步骤 3：运行浏览器流程**

覆盖：

1. `/app`：孩子端不显示家长账号/家庭配置入口。
2. `/parent`：未登录进入 `/parent/login`。
3. 登录后打开 `/parent/children`：显示孩子卡片和添加向导。
4. 新建孩子：一次提交后新 profile 成为当前 profile，页面进入孩子端。
5. 云端不可用：新档案仍存在本地，显示可理解的同步提示。
6. 退出登录：家长域回登录页，孩子端本地玩法仍能打开。

真实 Supabase 联调需要用户在 Chrome 开启远程调试并提供已登录测试环境；未具备该条件时使用现有 Fake Supabase 模拟，不把真实账号密码写入测试。

**步骤 4：运行回归集合**

至少运行：

```bash
node prj/parent_child_account_boundary_contract.test.mjs
node prj/auth_identifier_contract.test.mjs
node prj/child_creation_wizard_contract.test.mjs
node prj/parent_child_sync_after_create.test.mjs
node prj/route_aware_shell_contract.test.mjs
node prj/url_routing_and_settings_subpages.test.mjs
node prj/parent_settings_sections_contract.test.mjs
node prj/parent_management_hidden_interfaces.test.mjs
node scripts/run-full-regression.mjs
```

预期：新增合同与既有回归全部 PASS；任何既有失败都单独记录，不用本任务改动掩盖。

**步骤 5：提交验证记录**

如新增验证报告，创建 `docs/releases/2026-07-12-parent-child-account-validation.md`，写明命令、结果、环境和未完成的真实 Supabase 项；该报告与本次功能代码分开提交。

## 完成定义

- `/app/*` 和 `/parent/*` 的壳、路径和登录守卫合同通过。
- 家长端不再复用孩子端顶部主导航，不再把账号和家庭配置暴露在孩子主流程。
- 添加孩子不再依赖 `prompt()`，一次向导完成创建和切换。
- 云端可用时新孩子自动同步；云端不可用时本地数据不丢失。
- 现有旧路径、旧邮箱账号、本地 profile 数据和家庭社交合同保持兼容。
- 合同测试、现有回归和浏览器冒烟均有可复核输出。
