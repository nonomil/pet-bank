# 首页 Tab 重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rework the top navigation into 5 primary tabs so the homepage prioritizes `积分 / 宠物 / 探索`, while preserving every existing leaf page behind consolidated hub pages.

**Architecture:** Keep the underlying modules and leaf pages intact. Add a thin navigation layer in `index.html` and `js/app.js` that maps five primary tabs to their hub pages, then use the hub pages to expose the existing secondary pages as cards or buttons.

**Tech Stack:** Static HTML, Vanilla JS, CSS, localStorage, existing `switchPage` routing, manual browser smoke testing.

---

### Task 1: Define the new navigation map

**Files:**
- Modify: `js/app.js`
- Test: `js/app.js`

**Step 1: Write the failing assertion**

```javascript
console.assert(getHomeTabMap().积分 === 'map');
console.assert(getHomeTabMap().宠物 === 'pet');
console.assert(getHomeTabMap().探索 === 'explore');
console.assert(getHomeTabMap().兑换 === 'reward');
console.assert(getHomeTabMap().更多 === 'works');
```

**Step 2: Run the check**

Expected: fail because `getHomeTabMap()` does not exist yet.

**Step 3: Implement**

Add a single source of truth mapping in `app.js`:

```javascript
const HOME_TAB_MAP = {
  '积分': 'map',
  '宠物': 'pet',
  '探索': 'explore',
  '兑换': 'reward',
  '更多': 'works'
};
```

Expose a small helper for the tab renderer if needed.

**Step 4: Verify**

Expected: assertions pass in console.

---

### Task 2: Rebuild the top nav in `index.html`

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`
- Test: browser UI

**Step 1: Write the failing UI expectation**

Manual checklist:

```text
Top nav should show only 5 primary tabs:
积分 / 宠物 / 探索 / 兑换 / 更多
```

**Step 2: Implement**

Replace the current 11-tab strip with 5 primary tabs.

Primary tab labels:

- `积分`
- `宠物`
- `探索`
- `兑换`
- `更多`

Keep styling for the `active` state and mobile horizontal scrolling.

**Step 3: Verify**

Open the page and confirm only 5 primary tabs render.

---

### Task 3: Add hub-page content for each primary tab

**Files:**
- Modify: `index.html`
- Modify: `js/app.js`

**Step 1: Write the failing checklist**

```text
积分 hub exposes: 成长地图 / 今日打卡 / 每周复盘 / 数学PK
宠物 hub exposes: 宠物养成 / 宠物小屋 / 卡片图鉴 / 遛弯
兑换 hub exposes: 奖励兑换 / 兑换商店 / 背包
更多 hub exposes: 成长作品 / 工具箱
```

**Step 2: Implement**

Keep the existing page bodies, but add visible hub cards or buttons inside the parent pages:

- `page-map` becomes the `积分` hub
- `page-pet` becomes the `宠物` hub
- `page-reward` becomes the `兑换` hub
- `page-works` becomes the `更多` hub

Add a small button cluster on each hub page to jump to the leaf pages.

**Step 3: Verify**

Use the top tab and confirm each hub page still reaches its leaf pages.

---

### Task 4: Preserve secondary pages and route behavior

**Files:**
- Modify: `js/app.js`
- Test: browser navigation

**Step 1: Write the failing navigation checks**

```javascript
switchPage('pet');
switchPage('home');
switchPage('card');
switchPage('walk');
switchPage('shop');
switchPage('inventory');
switchPage('tools');
```

**Step 2: Implement**

Do not remove any existing `switchPage()` branches.

If needed, add a helper that maps the new primary tabs to their default landing pages, but keep all leaf page IDs valid.

**Step 3: Verify**

Every existing page ID still opens directly.

---

### Task 5: Align homepage CTA cards and mobile layout

**Files:**
- Modify: `index.html`
- Modify: `css/style.css`

**Step 1: Write the failing visual checklist**

```text
Homepage should show 3 primary cards:
1. 今日打卡
2. 宠物
3. 探索
Secondary cards:
兑换 / 更多
```

**Step 2: Implement**

Reorder the homepage quick-entry cards so the visible order matches the product priority:

1. 今日打卡
2. 宠物
3. 探索
4. 兑换
5. 更多

Make sure the layout still wraps cleanly on mobile.

**Step 3: Verify**

Check both desktop and narrow viewport.

---

### Task 6: Docs, smoke test, and release note

**Files:**
- Modify: `docs/plans/README.md`
- Modify: `docs/项目现状总览.md`
- Modify: `docs/路线/差距清单与开发路线图.md`
- Modify: `CHANGELOG.md`

**Step 1: Write the regression checklist**

```text
1. 只显示 5 个一级 tab
2. 主序为 积分 / 宠物 / 探索 / 兑换 / 更多
3. 所有 leaf 页面仍可直达
4. 手机端可用
5. 首页首屏优先显示三条主线
```

**Step 2: Run the smoke pass**

Open the app and manually verify the checklist above.

**Step 3: Update docs**

Record:

- new 5-tab IA
- hub/leaf split
- no functional deletion, only navigation consolidation

**Step 4: Commit**

```bash
git add index.html js/app.js css/style.css docs/plans/README.md docs/项目现状总览.md docs/路线/差距清单与开发路线图.md CHANGELOG.md
git commit -m "feat: consolidate homepage navigation into five primary tabs"
```

