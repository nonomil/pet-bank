# Shop Furniture Linkage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a pure-decoration shop-to-home furniture loop so players can buy furniture in the shop, own it permanently, place it in fixed home slots, and keep the result after refresh.

**Architecture:** Introduce a shared `data/furniture.json` catalog as the single source of truth for furniture metadata. Keep persistence on existing `petbank_home_furniture` and `petbank_home_state`, wire shop purchases through `HomeSystem.addFurniture()`, and avoid touching `InventorySystem` or adding buff logic.

**Tech Stack:** Static HTML, Vanilla JS IIFE modules, localStorage, JSON data files, manual browser smoke validation through a local static server.

---

### Task 1: Add the shared furniture catalog

**Files:**
- Create: `data/furniture.json`
- Test: `data/furniture.json`

**Step 1: Write the failing data-contract check**

```python
import json
from pathlib import Path

path = Path(r"G:\StudyCode\宠物积分系统\data\furniture.json")
data = json.loads(path.read_text(encoding="utf-8"))

assert data["version"] == "1.0"
assert len(data["defaults"]) == 2
assert len(data["furniture"]) == 8
assert any(item["id"] == "cozy_rug" for item in data["furniture"])
```

**Step 2: Run the check to verify it fails**

Run:

```bash
@'
import json
from pathlib import Path
path = Path(r"G:\StudyCode\宠物积分系统\data\furniture.json")
data = json.loads(path.read_text(encoding="utf-8"))
assert data["version"] == "1.0"
assert len(data["defaults"]) == 2
assert len(data["furniture"]) == 8
assert any(item["id"] == "cozy_rug" for item in data["furniture"])
print("ok")
'@ | python -
```

Expected: FAIL with `FileNotFoundError`

**Step 3: Write the minimal implementation**

```json
{
  "version": "1.0",
  "defaults": ["food_bowl", "bath_tub"],
  "furniture": [
    { "id": "food_bowl", "name": "食盆", "icon": "🥣", "price": 0, "slotType": "floor", "defaultOwned": true, "description": "默认家具" },
    { "id": "bath_tub", "name": "浴缸", "icon": "🛁", "price": 0, "slotType": "corner", "defaultOwned": true, "description": "默认家具" },
    { "id": "cozy_rug", "name": "温暖地毯", "icon": "🧶", "price": 35, "slotType": "floor", "defaultOwned": false, "description": "地面装饰" },
    { "id": "soft_cushion", "name": "软垫", "icon": "🛋️", "price": 45, "slotType": "floor", "defaultOwned": false, "description": "地面装饰" },
    { "id": "toy_box", "name": "玩具箱", "icon": "🧸", "price": 55, "slotType": "floor", "defaultOwned": false, "description": "地面装饰" },
    { "id": "night_lamp", "name": "夜灯", "icon": "🪔", "price": 60, "slotType": "corner", "defaultOwned": false, "description": "角落装饰" },
    { "id": "wall_frame", "name": "墙饰相框", "icon": "🖼️", "price": 40, "slotType": "backdrop", "defaultOwned": false, "description": "背景装饰" },
    { "id": "star_mobile", "name": "星星挂饰", "icon": "✨", "price": 70, "slotType": "backdrop", "defaultOwned": false, "description": "背景装饰" }
  ]
}
```

**Step 4: Run the check to verify it passes**

Run the same command from Step 2.

Expected: PASS and print `ok`

**Step 5: Commit**

```bash
git add data/furniture.json
git commit -m "feat: add shared furniture catalog"
```

### Task 2: Load the furniture catalog and normalize home ownership

**Files:**
- Modify: `js/home.js` (`DEFAULT_FURNITURE`, ownership load/save, render helpers)
- Modify: `js/app.js` (startup preload only if needed)
- Test: `js/home.js`

**Step 1: Write the failing browser smoke check**

```javascript
await HomeSystem.loadCatalog();
console.assert(HomeSystem.getFurnitureCatalog().length === 8, "catalog missing");
console.assert(HomeSystem.getFurniture().includes("food_bowl"), "default furniture missing");
console.assert(HomeSystem.getFurniture().includes("bath_tub"), "default bathtub missing");
```

**Step 2: Run the smoke check to verify it fails**

Run:

```bash
python -m http.server 4173
```

Expected: `Serving HTTP on ... port 4173`

Then open `http://127.0.0.1:4173/index.html`, run the Step 1 snippet in DevTools Console.

Expected: FAIL because `loadCatalog` / `getFurnitureCatalog` does not exist yet

**Step 3: Write minimal implementation**

```javascript
let furnitureCatalog = [];

async function loadCatalog() {
  const res = await fetch("data/furniture.json");
  const data = await res.json();
  furnitureCatalog = data.furniture || [];
  normalizeOwnedFurniture(data.defaults || []);
}

function getFurnitureCatalog() {
  return furnitureCatalog.slice();
}
```

Also add:

- ownership normalization to force `food_bowl` / `bath_tub`
- slot metadata for `center_left`, `center_right`, `corner_left`, `corner_right`, `back`
- a derived helper for `getUnplacedFurniture()`

**Step 4: Run the smoke check to verify it passes**

Use the same server and browser flow from Step 2.

Expected:

- `HomeSystem.getFurnitureCatalog().length === 8`
- `HomeSystem.getFurniture()` contains default furniture
- page loads without console errors

**Step 5: Commit**

```bash
git add js/home.js js/app.js
git commit -m "feat: load furniture catalog in home system"
```

### Task 3: Add the shop furniture category and ownership purchase flow

**Files:**
- Modify: `js/shop.js`
- Modify: `js/home.js` (`addFurniture` duplicate guard if not already present)
- Test: `js/shop.js`

**Step 1: Write the failing browser smoke check**

```javascript
localStorage.setItem("petbank_points", "200");
ShopSystem.buyFurniture("cozy_rug");
const owned = JSON.parse(localStorage.getItem("petbank_home_furniture") || "[]");
console.assert(owned.includes("cozy_rug"), "purchase did not reach home ownership");
```

**Step 2: Run the smoke check to verify it fails**

With the local server still running, reload the page and run the Step 1 snippet.

Expected: FAIL because `ShopSystem.buyFurniture` does not exist yet

**Step 3: Write minimal implementation**

```javascript
function buyFurniture(itemId) {
  const item = furnitureCatalog.find(x => x.id === itemId);
  if (!item) return;
  if (HomeSystem.getFurniture().includes(itemId)) return;
  if (getCurrentPoints() < item.price) return;

  adjustGrowthPoints(-item.price);
  HomeSystem.addFurniture(itemId);
  saveHistory("petbank_shop_history", { name: item.name, price: item.price, type: "furniture" });
  renderUI("shop-ui");
}
```

Also add:

- a new “家园装饰” section in `renderUI`
- button state rendering for `购买` / `已拥有`
- slot type badge display

**Step 4: Run the smoke check to verify it passes**

Use the same browser console flow, then additionally run:

```javascript
const before = JSON.parse(localStorage.getItem("petbank_home_furniture") || "[]").length;
ShopSystem.buyFurniture("cozy_rug");
const after = JSON.parse(localStorage.getItem("petbank_home_furniture") || "[]").length;
console.assert(after === before, "duplicate purchase should be blocked");
```

Expected:

- first purchase succeeds
- second purchase is blocked
- points decrease only once

**Step 5: Commit**

```bash
git add js/shop.js js/home.js
git commit -m "feat: link shop furniture purchases to home ownership"
```

### Task 4: Render unplaced furniture in home and enforce fixed-slot compatibility

**Files:**
- Modify: `js/home.js`
- Test: `js/home.js`

**Step 1: Write the failing browser smoke checks**

```javascript
HomeSystem.placeFurniture("wall_frame", "center_left");
let state = JSON.parse(localStorage.getItem("petbank_home_state"));
console.assert(state.slots.center_left !== "wall_frame", "incompatible backdrop item should not enter floor slot");
```

```javascript
HomeSystem.placeFurniture("cozy_rug", "center_left");
HomeSystem.placeFurniture("soft_cushion", "center_left");
state = JSON.parse(localStorage.getItem("petbank_home_state"));
const owned = JSON.parse(localStorage.getItem("petbank_home_furniture"));
console.assert(state.slots.center_left === "soft_cushion", "replacement should win");
console.assert(owned.includes("cozy_rug"), "replaced furniture should stay owned");
```

**Step 2: Run the smoke checks to verify they fail**

Reload the page and run both snippets in DevTools Console.

Expected: FAIL because slot compatibility and replacement semantics are not complete yet

**Step 3: Write minimal implementation**

```javascript
const SLOT_TYPES = {
  center_left: "floor",
  center_right: "floor",
  corner_left: "corner",
  corner_right: "corner",
  back: "backdrop"
};

function canPlace(furnId, slotId) {
  const item = furnitureCatalogById[furnId];
  return item && SLOT_TYPES[slotId] === item.slotType;
}
```

Also add:

- unplaced furniture tray rendering
- selected-furniture state
- incompatible slot disabled state
- replace-in-slot behavior that only updates `petbank_home_state.slots`

**Step 4: Run the smoke checks to verify they pass**

Expected:

- incompatible item cannot enter wrong slot
- replacement works
- replaced item remains owned
- refresh keeps the same layout

**Step 5: Commit**

```bash
git add js/home.js
git commit -m "feat: add home furniture tray and slot rules"
```

### Task 5: Regression sweep, docs, and release note

**Files:**
- Modify: `docs/设计/模块清单与接口.md`
- Modify: `docs/路线/差距清单与开发路线图.md`
- Modify: `docs/项目现状总览.md`
- Modify: `CHANGELOG.md`

**Step 1: Write the regression checklist**

```text
1. 默认拥有 food_bowl / bath_tub
2. 商店能购买 6 个新家具
3. 已拥有家具不可重复购买
4. 购买后切到小屋能看到未摆放家具
5. 兼容槽位可摆放，不兼容槽位不能摆放
6. 替换槽位后旧家具不丢失
7. 刷新后 ownership 和 slots 都保留
8. 不经过 InventorySystem，不出现 buff 文案
```

**Step 2: Run the full smoke pass**

Run:

```bash
python -m http.server 4173
```

Then execute the checklist manually on `http://127.0.0.1:4173/index.html`.

Expected: 8/8 PASS, console no new errors

**Step 3: Update docs and changelog**

Document:

- shared furniture catalog introduced
- shop-home pure-decoration loop landed
- no buff / no drag-drop / no inventory merge

**Step 4: Commit**

```bash
git add docs/设计/模块清单与接口.md docs/路线/差距清单与开发路线图.md docs/项目现状总览.md CHANGELOG.md
git commit -m "docs: record shop furniture linkage rollout"
```

**Step 5: Tag or release if the rollout is user-visible**

```bash
git tag v0.3.2
git push origin main --tags
```

Expected: tag pushed only after smoke validation passes
