# 运行时加载器 (PetBankRuntime)

> 核心文件: [js/runtime-loader.js](../../js/runtime-loader.js) (约 450 行)

---

## 原理

### 设计目标
SPA 无打包工具，40 个 JS 文件和 12 个 CSS 文件不能首屏全量加载。runtime-loader 提供按需加载机制：页面首次访问时才加载对应的 JS+CSS bundle，后续访问复用缓存。

### 核心模型

```
Bundle 映射:
  STYLE_BUNDLES:  { page → [css文件列表] }
  SCRIPT_BUNDLES: { page → [js文件列表] }

页面→Bundle 路由 (ensurePage):
  map → ensureMapFeature()             → exploration.js + 场景数据（首页森林路线）
  today/reward/inventory/works → 无额外加载（核心已预加载）
  playground → ensurePlaygroundFeature()  → math-pk + leaderboard + hanzi + tools
  pet → ensurePetCatalog()               → pet.js
  home → ensureHomeFeature()             → home.js + 本地成长数据
  walk → ensureWalkFeature()             → walk.js
  card → ensureCardFeature()             → card-collection.js
  explore → ensureExploreFeature()       → voice + battle-engine + exploration + pixel-story-map + pixel-story-engine
  shop → ensureShopFeature()             → shop.js
  mathpk/hanzi/leaderboard/tools → ensurePlaygroundFeature()
  learn/* → ensureLearnFeature()         → learn-center.js
  review → ensureReviewFeature()         → family-review.js（本机复盘）
  settings → ensureLearnFeature()（学习设置样式与模式服务，本地-only 边界）
```

---

## 实现

### 关键函数

| 函数 | 行号 | 说明 |
|------|------|------|
| `loadScript(src)` | :66-90 | 动态插入 `<script>` 标签（async=false, 去重） |
| `loadStyle(href)` | :92-116 | 动态插入 `<link rel="stylesheet">` 标签（去重） |
| `loadSeries(items, loader)` | :118-122 | 串行加载一组资源 |
| `once(key, factory)` | :124-129 | 确保工厂函数只执行一次（Promise 缓存） |
| `ensurePage(page)` | :331-391 | 页面→bundle 路由分发 |
| `ensurePetCatalog()` | :131-138 | 确保宠物数据库已加载 |
| `ensurePetSkills()` | :140-151 | 确保技能定义已加载 |
| `ensureAudioFeature()` | :153-158 | 加载音效系统 |
| `ensureMapFeature()` | :249-260 | 加载首页森林路线与场景数据 |
| `ensureHomeFeature()` | :160-175 | 加载宠物小屋（含 catalog 初始化） |
| `ensureWalkFeature()` | :178-185 | 加载遛弯功能 |
| `ensureCardFeature()` | :187-200 | 加载卡牌收集（含 CardCollection.init） |
| `ensureCardArenaFeature()` | :202-212 | 加载卡牌对战（含音效+竞技场CSS） |
| `ensureExploreFeature()` | :214-225 | 加载探索冒险（含 catalog+skills+audio+scenes） |
| `ensurePlaygroundFeature()` | :227-245 | 加载游乐场（含竞技场预加载 400ms 延迟） |
| `ensureLearnFeature()` | :247-257 | 加载学习中心（含 init） |
| `ensureShopFeature()` | :259-265 | 加载商城（依赖 home） |
| `ensureReviewFeature()` | :331-336 | 加载本机成长复盘 |
| `prefetch(page, delayMs)` | :393-400 | 预加载页面（延迟执行） |
| `openCardArenaEntry()` | :402-420 | 卡牌对战入口（含 toast 提示） |

### 公共 API

| 属性/方法 | 说明 |
|----------|------|
| `window.PetBankRuntime.ensurePage(page)` | 确保页面依赖已加载 |
| `window.PetBankRuntime.ensurePetCatalog()` | 确保宠物数据库已加载 |
| `window.PetBankRuntime.ensureAudioFeature()` | 确保音效系统已加载 |
| `window.PetBankRuntime.ensurePage('review')` | 确保本机复盘模块已加载 |
| `window.PetBankRuntime.ensureCardArenaFeature()` | 确保卡牌对战已加载 |
| `window.PetBankRuntime.prefetch(page, delayMs)` | 预加载页面 |
| `window.openCardArenaEntry()` | 打开卡牌对战入口 |

---

## 注意事项

- Script 加载使用 `async=false` 确保依赖顺序
- `once()` 保证每个 feature 的初始化只执行一次（即使多次调用 ensurePage）
- 脚本、样式或 feature 加载失败会清理失败节点和 Promise 缓存；用户再次进入页面时允许重试，不会把一次网络抖动永久缓存为失败。
- `initFlags` 对象追踪哪些模块的 init() 已被调用
- ensurePlaygroundFeature 中 400ms 后自动预加载卡牌对战（增强体验）
- 账号/家庭模块不是 runtime-loader 的玩法 bundle：`index.html` 直接加载 `self-hosted-api.js`、`parent-account.js`，由家长设置页按需显示；runtime-loader 仍不加载 Supabase、旧社交或第三方云端 bundle
- 样式通过 `data-petbank-src` / `data-petbank-href` 属性追踪已加载资源
