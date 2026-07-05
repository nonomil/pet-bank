# 方案 B：积分页打卡总控 + 学习页入口大厅 实施计划

> **给 Codex:** 必需子技能：使用 superpowers:executing-plans 来逐任务实施此计划。

**目标：** 把“今日学习打卡”从学习页迁到积分页，把学习页重构成更轻的入口大厅，让中文、英语、汉字、学习网站、打印讲义等入口更直接。

**架构：** 复用现有 `LearnCenter` 的学习单数据和 lesson 完成逻辑，在积分页新增学习打卡容器，调用 `LearnCenter` 渲染“今日学习打卡总控”；学习页则改成大卡片入口，不再承担打卡总控。`renderHub()` 负责入口大厅，`renderDailyCheckin()` 负责积分页学习打卡。

**技术栈：** Vanilla JS、现有 `index.html` / `js/app.js` / `js/learn-center.js` / `css/learn-center.css` / `scripts/learning-center-smoke.mjs`

---

### 任务 1：编写失败测试

**文件：**
- 修改：`scripts/learning-center-smoke.mjs`

**步骤：**

1. 断言学习页出现至少 5 张入口大厅卡片
2. 断言学习页首屏可见汉字入口
3. 断言积分页出现今日学习打卡总控
4. 断言在积分页完成晨读后，学习打卡同步显示已完成

### 任务 2：在积分页预留学习打卡容器

**文件：**
- 修改：`index.html`

**步骤：**

1. 在 `page-today` 中插入学习打卡容器
2. 放在今日成长任务卡上方，形成“学习打卡总控 + 积分任务”的顺序

### 任务 3：新增 LearnCenter 积分页学习打卡渲染函数

**文件：**
- 修改：`js/learn-center.js`

**步骤：**

1. 新增 `renderDailyCheckin(containerId)` 或等价函数
2. 复用模板 A 的 4 项轻量学习单
3. 保证与 lesson 打勾状态同步

### 任务 4：学习页重构为入口大厅

**文件：**
- 修改：`js/learn-center.js`
- 修改：`css/learn-center.css`

**步骤：**

1. 移除学习页中的打卡总控
2. 将默认面板改为入口大厅
3. 首屏加入中文、英语、汉字、学习网站、打印讲义至少 5 张卡片
4. 卡片增加更明显的视觉块或图片感

### 任务 5：在切页与总渲染中接线

**文件：**
- 修改：`js/app.js`

**步骤：**

1. 切到 `today` 页时调用学习打卡渲染
2. `renderAll()` 时若相关容器存在，保持学习打卡同步

### 任务 6：验证

**文件：**
- 修改：`scripts/learning-center-smoke.mjs`

**步骤：**

1. 运行 `node --check js/learn-center.js`
2. 运行 `node scripts/learning-center-smoke.mjs`
3. 确认新旧学习链路同时通过

