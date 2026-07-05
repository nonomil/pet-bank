# 首页静态站性能收口 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不做大重构的前提下，减少首页首轮请求与执行，修复生产环境配置加载风险。

**Architecture:** 保留现有 IIFE + `window.*` 体系，在 `index.html` 和 `app.js` 之间补一层轻量运行时加载器，按页面首次进入再补载脚本、样式和数据。首页只保留最小可用集合，探索、学习、商店、云端能力全部延后。

**Tech Stack:** Static HTML, Vanilla JS, localStorage, Playwright smoke tests, Python contract tests

---

### Task 1: 写首页加载合同测试

**Files:**
- Modify: `prj/cloud_config_missing_regression.test.mjs`
- Create: `prj/test_static_home_performance_contract.py`

**Step 1: Write the failing tests**

- 增加首页首轮不请求 `data/pets.json`
- 增加首页首轮不请求 `unpkg lucide`
- 断言 `index.html` 不再内联触发 `PetSystem.loadPetDB()`
- 断言 `admin.html` 不再直接引用 `cloud-config.local.js`

**Step 2: Run test to verify it fails**

Run: `python -m pytest prj/test_static_home_performance_contract.py -q`

Expected: FAIL，指出当前 HTML 仍直接引用旧资源。

### Task 2: 加入运行时加载层

**Files:**
- Create: `js/runtime-loader.js`
- Create: `js/lucide-lite.js`
- Modify: `index.html`
- Modify: `admin.html`

**Step 1: Write minimal loader**

- 提供脚本与 CSS 的 `load once` 能力
- 定义按页面的 bundle 映射
- 支持按需加载 `supabase` 和云端脚本

**Step 2: Switch HTML entry points**

- 首页移除非首屏脚本与样式直连
- 首页改用本地 `lucide` 轻量实现
- 管理页改走 `cloud-config-loader.js`

**Step 3: Run contract tests**

Run: `python -m pytest prj/test_static_home_performance_contract.py -q`

Expected: PASS

### Task 3: 收口 app 初始化与页面切换

**Files:**
- Modify: `js/app.js`

**Step 1: Make init homepage-first**

- 保留宠物/背包/宝箱/积分等首页最小能力
- 去掉启动时的探索、学习、卡牌、小屋、云端全量初始化

**Step 2: Add page-level ensure hooks**

- 页面切换时先确保对应 bundle 就绪
- `pet/home/walk/card/explore` 首次进入时再加载 `pets.json`
- `explore` 首次进入时再加载场景和技能表

**Step 3: Keep existing pages working**

- `renderAll()` 不再强制渲染隐藏页的重模块
- 需要时在页面激活后再补渲染

### Task 4: 更新冒烟与回归验证

**Files:**
- Modify: `scripts/smoke.mjs`
- Modify: `prj/cloud_config_missing_regression.test.mjs`

**Step 1: Update smoke flow for lazy bundles**

- 冒烟脚本显式进入对应页面以触发按需加载
- 全局检查改成“可按需获得完整 API”，不再假设所有模块首轮就绪

**Step 2: Run the focused checks**

Run: `python -m pytest prj/test_static_home_performance_contract.py -q`

Run: `node prj/cloud_config_missing_regression.test.mjs`

Expected: PASS，首页首轮不再命中 `cloud-config.local.js` / `pets.json` / `unpkg lucide`

**Step 3: Run the smoke pass**

Run: `node scripts/smoke.mjs`

Expected: PASS，探索 / 战斗 / 商店 / 宝箱 / 全局检查仍正常
