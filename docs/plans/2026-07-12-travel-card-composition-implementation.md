# 旅行宠物卡牌组合展示实施计划

> **给 Codex：** 按任务逐项实施；每个任务完成后先运行对应验证，再进入下一个任务。

**目标：** 将已生成的旅行卡框真正组合到旅行记忆收藏卡中，并保存完成探索时的宠物展示快照。

**架构：** `TravelMemory` 负责快照归一化和兼容回退；`exploration-detail.js` 在完成时传入当前宠物展示信息；`card-collection.js` 只渲染组合卡面。所有字段均为展示数据，旅行卡不接入对战或奖励计算。

**技术栈：** 原生 JavaScript、CSS、JSON、Node 契约测试、Playwright 浏览器 smoke。

---

### 任务 1：扩展旅行记忆宠物快照契约

**状态：** 已完成

**文件：**
- 修改：`scripts/test-travel-memory-assets.mjs`
- 修改：`js/travel-memory.js`

**步骤：**

1. 在测试中先断言 `record({ pet })` 保存 `speciesId/name/emoji/image/stage`。
2. 断言旧记录没有 `pet` 时仍返回合法对象，并允许 emoji 回退。
3. 运行 `node scripts/test-travel-memory-assets.mjs`，确认新增断言先失败。
4. 实现快照字段的字符串归一化、长度限制和可选值回退。
5. 重新运行旅行资产契约测试和 `node --check js/travel-memory.js`。

### 任务 2：完成探索时保存宠物快照

**状态：** 已完成

**文件：**
- 修改：`js/exploration-detail.js`
- 修改：`scripts/test-travel-memory-assets.mjs`

**步骤：**

1. 从 `PetSystem.getState()`、当前物种和当前阶段图取得展示字段。
2. 调用 `TravelMemory.record({ sceneId, pet })`；没有宠物时保持原流程。
3. 断言完成页源码包含快照传递和旧 emoji 回退路径。
4. 运行旅行资产、宠物冒险契约和相关 JS 语法检查。

### 任务 3：渲染组合旅行卡

**状态：** 已完成

**文件：**
- 修改：`js/card-collection.js`
- 修改：`css/card-collection.css`
- 修改：`css/travel-memory.css`
- 修改：`scripts/test-travel-memory-assets.mjs`

**步骤：**

1. 先增加源码契约，要求卡片同时引用 `cardAsset`、`petCardAsset` 和宠物图片/emoji 回退。
2. 实现三层卡面 DOM：底图、卡框、宠物主体；全部图片使用 `onerror` 回退。
3. 增加地点、宠物名和阶段的短文案样式；移动端改为单列。
4. 运行 Node 契约和 JS 语法检查。

### 任务 4：真实浏览器验收与发布

**状态：** 已完成

**文件：**
- 修改：`scripts/test-travel-memory-browser.mjs`
- 修改：`docs/发布/2026-07-12-travel-memory-assets.md`
- 创建：`docs/发布/travel-card-composition-desktop.png`
- 创建：`docs/发布/travel-card-composition-mobile.png`

**步骤：**

1. 在浏览器上下文中为三个场景写入同一只测试宠物的快照。
2. 从根入口进入小屋和图鉴，检查三张组合卡、卡框图片、宠物图片或 emoji 回退。
3. 在 `1280x720` 和 `390x844` 检查 `naturalWidth`、CSS 加载、无横向溢出和无页面错误。
4. 保存截图和命令输出到发布记录，明确旧记录回退和不接入战斗的边界。
5. 只暂存本阶段文件，运行 `git diff --cached --check` 后提交。
