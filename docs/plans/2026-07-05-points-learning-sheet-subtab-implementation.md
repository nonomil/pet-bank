# Points Learning Sheet Subtab Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把学习单从 `积分 -> 今日打卡` 页拆出，做成 `积分` 大 tab 下独立的 `学习单` 子页，同时保持学习页继续只负责入口大厅。

**Architecture:** 在现有 SPA 路由里新增 `learning-sheet` 叶子页，继续归属 `today` 顶级 tab。`LearnCenter.renderDailyCheckin()` 不改数据模型，只改渲染挂载点和积分区子导航。先改冒烟测试定义新行为，再补页面壳和渲染接线。

**Tech Stack:** 静态 HTML、Vanilla JS、现有 `LearnCenter` 模块、Playwright 冒烟脚本

---

### Task 1: 用冒烟测试锁定新的积分区结构

**Files:**
- Modify: `scripts/learning-center-smoke.mjs`

**Step 1: Write the failing test**

新增断言，覆盖：

- `page-learning-sheet` 存在
- `今日打卡` 页不再显示学习单
- `学习单` 页显示模板 A
- 切换模板 A/B/C 后，检查目标页改为 `learning-sheet`

**Step 2: Run test to verify it fails**

Run:

```bash
node scripts/learning-center-smoke.mjs
```

Expected:

- FAIL，因为当前学习单仍挂在 `page-today`

**Step 3: Commit**

等后续任务全部通过后再一起提交。

### Task 2: 新增积分区 `学习单` 页面壳与子导航

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`

**Step 1: Write minimal implementation**

- 在 `index.html` 增加 `#page-learning-sheet`
- 为积分区所有子菜单和 shortcut 加入 `学习单`
- 在 `js/app.js` 的 `PAGE_TO_TAB`、`TOP_HUB_MENU_CONFIG.today`、`switchPage()` 中接入 `learning-sheet`

**Step 2: Run the smoke test**

```bash
node scripts/learning-center-smoke.mjs
```

Expected:

- 仍可能 FAIL，因为学习单还没真正渲染到新页

### Task 3: 把学习单渲染从 `today` 挪到 `learning-sheet`

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`
- Modify: `js/learn-center.js`

**Step 1: Write minimal implementation**

- 从 `page-today` 移除 `today-learning-checkin`
- 在 `page-learning-sheet` 中新增 `points-learning-sheet-container`
- `switchPage('learning-sheet')` 时调用 `LearnCenter.renderDailyCheckin('points-learning-sheet-container')`
- `renderAll()` 和 `setDailySheetMode()` 也同步改为优先刷新新的容器

**Step 2: Run test to verify it passes**

```bash
node scripts/learning-center-smoke.mjs
```

Expected:

- 学习单结构相关断言转绿

### Task 4: 收口文案与设计说明

**Files:**
- Modify: `js/profiles.js`
- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `docs/plans/README.md`
- Modify: `docs/README.md`

**Step 1: Update copy**

- 设置页改成“积分区学习单显示哪种模式”
- README / CHANGELOG 补充“学习单已拆成积分区独立子页”
- 计划索引加入本次设计稿与实施计划

**Step 2: Run targeted verification**

```bash
node --check js/app.js
node --check js/learn-center.js
node --check js/profiles.js
node --check scripts/learning-center-smoke.mjs
node scripts/learning-center-smoke.mjs
```

Expected:

- 语法检查通过
- 冒烟测试全绿

### Task 5: 提交并推送学习相关改动

**Files:**
- Stage only learning-related files touched in this run

**Step 1: Review staged diff**

```bash
git diff --cached --stat
```

**Step 2: Commit**

```bash
git commit -m "feat: split points learning sheet into its own subtab"
```

**Step 3: Push**

```bash
git push -u origin codex/family-account-social
```

