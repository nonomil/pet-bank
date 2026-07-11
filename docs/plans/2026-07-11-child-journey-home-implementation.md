# 儿童主线首页 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将孩子端首页从六个等权入口改为“今天先做一件事 + 今天/伙伴/冒险三入口 + 更多入口”的渐进主线。

**Architecture:** 仅调整 `page-map` 的 HTML/CSS 入口层，复用既有 `switchPage` 和今日任务数据；不引入新存储，不改变任何游戏、词库或积分逻辑。

**Tech Stack:** HTML、CSS、Vanilla JavaScript 既有路由、Node.js 静态契约测试。

---

### Task 1: 首页主线结构契约

**Files:**
- Create: `scripts/test-child-journey-home.mjs`
- Modify: `index.html`

**Step 1: Write the failing test**

断言首页存在 `childJourneyHero`、`childJourneyToday`、`childJourneyPet`、`childJourneyAdventure`、`childJourneyMore`，并验证 CTA 分别调用既有 `switchPage('today')`、`switchPage('pet')`、`switchPage('playground')`、`switchPage('explore')` 与 `switchPage('shop')`。

**Step 2: Run test to verify it fails**

Run: `node scripts/test-child-journey-home.mjs`

Expected: FAIL，因为主线首页结构尚不存在。

**Step 3: Write minimal implementation**

在 `page-map` 的轮播前新增主线行动卡；把快捷入口改成三条主线和一个次级更多区域。保留全部旧目的地，不改导航函数。

**Step 4: Run test to verify it passes**

Run: `node scripts/test-child-journey-home.mjs`

Expected: PASS。

### Task 2: 主线首页视觉与小屏布局

**Files:**
- Modify: `css/style.css`
- Test: `scripts/test-child-journey-home.mjs`

**Step 1: Extend the failing test**

断言样式包含主线卡、三入口网格、焦点态和移动端布局规则。

**Step 2: Run test to verify it fails**

Run: `node scripts/test-child-journey-home.mjs`

Expected: FAIL，因为样式尚不存在。

**Step 3: Write minimal implementation**

添加局部 CSS：主线卡突出 CTA、入口卡保持可点击边界、小屏改为单列或双列；使用 `:focus-visible`，并在 `prefers-reduced-motion` 下移除非必要动效。

**Step 4: Run test to verify it passes**

Run: `node scripts/test-child-journey-home.mjs; node scripts/test-static-route-entries.mjs`

Expected: PASS。

### Task 3: 发布前验证与提交

**Files:**
- Modify: `README.md`
- Modify: `CHANGELOG.md`

**Step 1: Update release notes**

记录儿童首页主线、保留的路由边界和验证命令。

**Step 2: Run verification**

Run:

```powershell
node scripts/test-child-journey-home.mjs
node scripts/test-pages-fast-gate-contract.mjs
node --check js/app.js
node scripts/test-static-route-entries.mjs
git diff --check
```

Expected: all PASS.

**Step 3: Commit**

```powershell
git add index.html css/style.css scripts/test-child-journey-home.mjs README.md CHANGELOG.md
git commit -m "feat: guide children through the home journey"
```
