# 内容/代码分离审查报告

> 审查日期: 2026-07-08
> 审查原则: 知识点/教育内容应与游戏代码分离，内容进 data/ JSON，代码只负责加载和渲染

---

## 一、总体评估：分离程度 ~55%，处于"半分离"状态

核心数据文件（pets, scenes, stories, skills, hanzi, math-cmath, learn packs）已较好分离，但大量**用户可见的中文文案、任务定义、配置常量**仍散落在 JS 源码中。

---

## 二、已正确分离（✅ 合格）

| 内容类型 | 数据文件 | 加载方式 | 评价 |
|---------|---------|---------|------|
| 261 宠物物种 | [data/pets.json](../../data/pets.json) | PetSystem.loadPetDB() fetch JSON | ✅ 完全分离 |
| 12 场景叙事 | [data/stories/](../../data/stories/) 12个JSON | exploration-detail.js fetch | ✅ 完全分离 |
| 场景配置 | [data/scenes.json](../../data/scenes.json) | ExplorationSystem.loadScenes() | ✅ 完全分离 |
| HSK 汉字库 | [data/hanzi-hsk.json](../../data/hanzi-hsk.json) | hanzi-game.js fetch | ✅ 完全分离 |
| 汉字题目 | [data/hanzi-questions.json](../../data/hanzi-questions.json) | hanzi-game.js fetch | ✅ 完全分离 |
| 数学应用题 | [data/math-cmath.json](../../data/math-cmath.json) | math-pk.js fetch | ✅ 完全分离 |
| 技能定义 | [data/skills.json](../../data/skills.json) | PetSystem.loadSkills() | ✅ 完全分离 |
| 物品定义 | [data/items.json](../../data/items.json) | InventorySystem + TreasureChest fetch | ✅ 完全分离 |
| 家具目录 | [data/furniture.json](../../data/furniture.json) | HomeSystem.loadCatalog() | ✅ 完全分离 |
| 学习课程包 | [data/learn/](../../data/learn/) catalog + packs/ | LearnCenter fetch | ✅ 完全分离 |
| 竞技场关卡 | [data/arena-stages.json](../../data/arena-stages.json) | card-arena-ui.js fetch | ✅ 完全分离 |
| 战斗配置 | [data/combat.json](../../data/combat.json) | 战斗模块 fetch | ✅ 完全分离 |

---

## 三、仍混在代码中的内容（❌ 需改造）

### 🔴 严重（大规模教育内容硬编码）

| # | 文件 | 内容 | 估算行数 | 改造建议 |
|---|------|------|---------|---------|
| 1 | [js/learn-center.js](../../js/learn-center.js) | 每日学习单 3 套模板（模板A/B/C）的**全部中文文案**：任务名称、描述、提示语、按钮文案、字段标签、每日引导语、统计口径 | ~1500行 | 抽到 `data/learn/daily-sheet-templates.json`，JS 只做模板引擎 |
| 2 | [js/learn-center.js](../../js/learn-center.js) | 学习入口卡片文案（kicker/title/desc/cta/metadata） | ~300行 | 合并到 `data/learn/catalog.json` 或独立 `learn-entry-cards.json` |
| 3 | [js/learn-center.js](../../js/learn-center.js) | 打印讲义模板文案（章节标记、页面引导、模式描述） | ~200行 | 抽到 `data/learn/print-templates.json` |
| 4 | [js/learn-center.js](../../js/learn-center.js) | 拼音->英文映射表（短句/唐诗/古诗/弟子规…共12条） | ~12行 | 移到数据文件或删除（仅在打印功能用） |

### 🟡 中等（配置型内容混入代码）

| # | 文件 | 内容 | 估算行数 | 改造建议 |
|---|------|------|---------|---------|
| 5 | [js/app.js](../../js/app.js) | 6 维度 37 个任务定义（名称+积分，含 petcare 守护力） | ~80行 | 抽到 `data/tasks.json` |
| 6 | [js/app.js](../../js/app.js) | 首页 3 个优先任务 + 提示文案 | ~3行 | 合并到 `data/tasks.json` |
| 7 | [js/app.js](../../js/app.js) | 积分任务配图映射（10个 kidstar URL） | ~12行 | 合并到 `data/point-items.json` |
| 8 | [js/app.js](../../js/app.js) | 配图文本匹配规则（getPointTaskArt） | ~12行 | 改为按维度 key 精确映射，非文本正则 |
| 9 | [js/walk.js](../../js/walk.js) | 5 条遛弯路线定义：路线名、描述、场景标题、气泡文案×3、生图提示词 | ~60行 | 抽到 `data/walk-routes.json` |
| 10 | [js/shop.js](../../js/shop.js) | 8 个兑换物品 + 2 个盲盒 + 5 个战斗道具 + 5 种随机物品 + 4 种稀有物品 + 各种史诗物品 | ~80行 | 合并到 `data/items.json` 和 `data/point-items.json` |
| 11 | [js/exploration-detail.js](../../js/exploration-detail.js) | 数学题生成算法（加减乘除+逻辑题） | ~50行 | 算法可留 JS，但难度参数应抽到 `data/combat.json` |
| 12 | [js/hanzi-game.js](../../js/hanzi-game.js) | 等级卡片定义、模式标签 | ~10行 | 合并到 `data/hanzi-questions.json` 的 meta 段 |
| 13 | [js/math-pk.js](../../js/math-pk.js) | 机器人对手定义（5种，含名称+属性） | ~30行 | 抽到 `data/math-rivals.json` |
| 14 | [js/math-pk.js](../../js/math-pk.js) | 辅助卡牌定义（含中文描述） | ~20行 | 抽到 `data/math-support-cards.json` |
| 15 | [js/math-pk.js](../../js/math-pk.js) | 难度配置（easy20/easy100/mix/hard/mul）的标签和描述 | ~10行 | 合并到 `data/math-config.json` |

### 🟢 轻度（文案碎片）

| # | 文件 | 内容 | 改造建议 |
|---|------|------|---------|
| 16 | [js/profiles.js](../../js/profiles.js) | 3 套学习单模板定义（与 learn-center.js 中的重复） | 统一到一个数据源 |
| 17 | [js/card-collection.js](../../js/card-collection.js) | 图鉴馆/系列描述文案（SOURCE_DETAIL_LABELS + GALLERY 描述） | 合并到 `data/pets.json` 的 series 段或独立 `data/pokedex-lore-draft.json` |
| 18 | [js/card-collection.js](../../js/card-collection.js) | 宠物故事兜底文案模板 | 可保留（仅兜底），但主故事应来自数据 |
| 19 | SQLite API 快照同步 | 同步理由和冲突提示文案 | 基础 Profile 同步已接入；后续补 outbox、重试、合并状态和更细的用户反馈 |
| 20 | [js/app.js](../../js/app.js) | HOME_TAB_MAP 导航标签中文 | 低优先级（导航结构非教育内容） |

---

## 四、改造优先级

### 第一期（ROI 最高，影响最大）

```
1. learn-center.js 学习单模板 → data/learn/daily-sheet-templates.json
   影响: ~1500行中文文案从代码中移出
   好处: 后续改模板A/B/C的文案不需要动代码

2. walk.js 遛弯路线 → data/walk-routes.json
   影响: 5条路线的所有气泡文案和场景配置
   好处: 新增路线不需要改 JS

3. app.js 任务定义 → data/tasks.json
   影响: 所有37个任务可配置
   好处: 家长可自定义任务（当前只能自定义积分兑换）
```

### 第二期

```
4. shop.js 商品定义 → 合并到现有 data/items.json
5. math-pk.js 机器人+辅助卡牌 → data/math-rivals.json + data/math-support-cards.json
6. card-collection.js 图鉴文案 → data/pokedex-lore-draft.json
```

### 第三期（低优先级）

```
7. learn-center.js 打印模板文案
8. hanzi-game.js 等级卡片
9. exploration-detail.js 难度参数
10. profiles.js vs learn-center.js 重复模板统一
```

---

## 五、判断标准（后续新增功能参照）

开发新功能时走这个决策树：

```
新增教育内容（题目/文案/任务/路线/配置）
  │
  ├─ 会频繁修改？          → 必须进 data/ JSON
  ├─ 家长可能要自定义？    → 必须进 data/ JSON
  ├─ 纯程序逻辑/算法？     → 可留在 JS
  ├─ UI 脚手架/布局？      → 可留在 JS
  ├─ 兜底/fallback 文案？  → 可留在 JS（但不超过 5 行）
  └─ 不确定？              → 默认进 data/ JSON
```
