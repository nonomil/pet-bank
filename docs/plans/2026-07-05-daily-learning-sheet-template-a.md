# 幼小衔接今日学习单（模板 A）实施计划

> **给 Codex:** 必需子技能：使用 superpowers:executing-plans 来逐任务实施此计划。

**目标：** 在现有学习中心里落地“幼小衔接超轻量版”今日学习单第一版，让孩子和家长每天能看到 4 项核心任务、完成勾选、总时长和睡前复盘入口。

**架构：** 复用现有 `LearnCenter` 资料包与 lesson 完成逻辑，不新增一级页面，而是在 `今日学习` tab 内新增按日期聚合的“每日学习单”卡。学习单只做组织层，lesson 发分逻辑保持不变，学习单状态走新的 `petbank_learning_daily_*` 本地存储。

**技术栈：** Vanilla JS、localStorage、现有 `js/learn-center.js` / `css/learn-center.css` / `scripts/learning-center-smoke.mjs`

---

### 任务 1：为模板 A 补失败的冒烟测试

**文件：**
- 修改：`scripts/learning-center-smoke.mjs`

**步骤 1：编写失败的测试**

- 在学习首页断言出现“今日学习单 / 晨读 / 今日古诗 / 识字 / 睡前复盘”
- 在完成晨读 lesson 后断言学习单对应任务变为已完成

**步骤 2：运行测试以验证它失败**

运行：`node scripts/learning-center-smoke.mjs`
预期：新增断言失败，因为当前没有每日学习单模块。

### 任务 2：在 LearnCenter 中新增每日学习单状态与聚合函数

**文件：**
- 修改：`js/learn-center.js`

**步骤：**

1. 新增 daily sheet 本地存储键
2. 新增按日期生成模板 A 默认任务的函数
3. 新增从 lesson 完成状态反推任务完成状态的聚合逻辑
4. 新增保存轻量复盘与总时长的状态函数

### 任务 3：在“今日学习”页渲染模板 A 卡片

**文件：**
- 修改：`js/learn-center.js`
- 修改：`css/learn-center.css`

**步骤：**

1. 在 `今日学习` tab 顶部插入“今日学习单”卡
2. 显示 4 个轻量任务：晨读、今日古诗、识字、睡前复盘
3. 显示总时长建议和“今天卡住的点 / 家长一句话”轻量输入
4. 提供打开 lesson 的快捷按钮

### 任务 4：让 lesson 完成与学习单自动同步

**文件：**
- 修改：`js/learn-center.js`

**步骤：**

1. 在 `completeLesson()` 后刷新 daily sheet 聚合状态
2. 保证晨读与识字完成后，学习单行显示已完成
3. 睡前复盘行独立记录，不干扰 lesson 发分

### 任务 5：补充样式与移动端布局

**文件：**
- 修改：`css/learn-center.css`

**步骤：**

1. 让模板 A 卡片轻量、清楚、适合幼小衔接
2. 优先保证移动端与窄屏不拥挤
3. 不做重表格，维持卡片式结构

### 任务 6：跑验证并收口

**文件：**
- 修改：`scripts/learning-center-smoke.mjs`

**步骤：**

1. 运行 `node --check js/learn-center.js`
2. 运行 `node scripts/learning-center-smoke.mjs`
3. 根据结果修正并确保全绿

