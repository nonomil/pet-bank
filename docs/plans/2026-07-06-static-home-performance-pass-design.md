# 首页静态站性能收口设计稿

> **日期**：2026-07-06
>
> **范围**：按已确认的 `B` 档执行首页性能收口，不做数据结构大改，不拆 `pets.json` 摘要/详情分片。

## 目标

在不重写现有全局脚本体系的前提下，先把首页最明显的首屏负担和线上配置风险收掉：

- 生产环境不再直接依赖 `cloud-config.local.js`
- 首页启动时不再主动请求 `data/pets.json`
- 非首页功能脚本和样式按页面首次进入再加载
- 降低首页对第三方运行时的首轮依赖

## 现状问题

1. `index.html` 和 `admin.html` 仍有生产环境不友好的配置入口。
2. 首页启动阶段会主动触发 `PetSystem.loadPetDB()`，导致首轮请求完整宠物库。
3. 多个只在二级页面使用的脚本和 CSS 仍然首轮加载。
4. `lucide` 依赖外部运行时脚本，首页首屏会额外走第三方域名。
5. `app.js` 的初始化流程默认把探索、学习、社交、卡牌、小屋等能力都按“首屏必需”处理。

## 设计原则

1. 小步收口，优先减少首页请求和执行量。
2. 不把现有 IIFE + `window.*` 模式整体改成模块化重构。
3. 用“运行时按需补载”兼容旧页面和旧全局 API。
4. 首页保留当前可见内容，但把隐藏页依赖尽量延后。

## 方案

### 1. 配置与部署收口

- `admin.html` 不再直接引用 `cloud-config.local.js`
- 统一走 `js/cloud-config-loader.js` 的“公共配置 + localhost 本地覆盖”策略

### 2. 运行时加载层

新增一个轻量运行时加载器，负责：

- 首次进入指定页面时补载对应 JS
- 首次进入指定页面时补载对应 CSS
- 需要时再触发：
  - `PetSystem.loadPetDB()`
  - `PetSystem.loadSkills()`
  - `ExplorationSystem.loadScenes()`
  - `LearnCenter.init()`
  - `HomeSystem.init()/loadCatalog()`
  - 云端能力 boot

### 3. 首页首轮最小集合

首页只保留这些首轮能力：

- `pet.js`
- `inventory.js`
- `treasure.js`
- `profiles.js`
- `app.js`
- 本地 `lucide` 轻量替代

其余能力按页面补载。

### 4. 延后加载策略

- `pets.json`：进入 `pet / home / walk / card / explore` 后再加载
- 探索链路：进入 `explore` 后再加载探索/战斗脚本与 `scenes.json`
- 游乐场链路：进入 `playground / mathpk / hanzi / leaderboard` 后再加载
- 学习中心：进入 `learn* / learning-sheet` 后再加载
- 商店/家具：进入 `shop` 后再加载
- 家庭/云端：进入 `settings / review / home-visit`，或确实需要社交能力时再加载
- `walk`：进入遛弯页时再加载

### 5. 第三方依赖处理

- 去掉 `unpkg` 的 `lucide` 运行时，改成本地轻量实现
- `Supabase` 不再首页首轮加载，改为云端能力首次使用时再加载
- `Tailwind CDN` 暂不在本轮移除，作为后续构建化改造项保留

## 影响文件

- `index.html`
- `admin.html`
- `js/app.js`
- `js/cloud-config-loader.js`
- `js/runtime-loader.js`（新增）
- `js/lucide-lite.js`（新增）
- `scripts/smoke.mjs`
- `prj/cloud_config_missing_regression.test.mjs`
- `prj/test_static_home_performance_contract.py`（新增）

## 验收

1. 首页首轮不再请求 `cloud-config.local.js`
2. 首页首轮不再请求 `data/pets.json`
3. 首页不再首轮加载 `lucide` 外链
4. `pet / explore / shop / learn / settings` 首次进入时仍能正常渲染
5. 现有综合冒烟和新增合同测试通过
