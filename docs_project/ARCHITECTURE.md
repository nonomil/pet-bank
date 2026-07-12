# 宠物积分系统（成长伙伴·萌宠冒险岛）—— 架构总览

> 本文档由全仓库扫描生成，后续所有 AI（含 Codex）基于此文档理解项目。
> 任何代码修改需同步更新本文档及相关模块文档。

---

## 一、项目定位

儿童益智类 H5 单页应用（SPA），面向 4-12 岁儿童及其家长。核心理念：

- **学习不是任务清单，是可进入的世界**
- **游戏化不是加动画，是重写思考动作**
- **失败是复盘，不是惩罚**
- **奖励是脚手架，不是拐杖**

---

## 二、技术栈

```
类型:     Vanilla JS SPA（无框架、无打包、无转译）
入口:     index.html（主应用）
后端:     VPS 自托管 Node.js API（当前仅健康检查）
存储:     localStorage 主力；SQLite 账号与快照 API 分阶段接入
音频:     ZzFX（程序化音效）+ Web Speech API（TTS 语音）
图像:     大量 WebP 素材（GPT 生图管线产出）
代码量:   ~41,520 行（JS ~25K + CSS ~15K + HTML ~1.5K）
```

## 三、目录结构

```
宠物积分系统/
├── index.html              # SPA 主入口，所有页面容器和顶级导航
│
├── js/                     # 40 个 JS 文件（核心业务逻辑）
│   ├── app.js              # 主编排器（任务/积分/页面路由/渲染）── 4747行 ⚠️
│   ├── runtime-loader.js   # 自定义按需加载（JS+CSS bundle 管理）
│   ├── pet.js              # 宠物养成核心（261物种 × 5阶段 × HP/ATK/DEF/SPD）
│   ├── home.js             # 宠物小屋（家具摆放+5维状态条+背景主题）
│   ├── battle-engine.js    # 通用战斗纯计算引擎（探索+卡牌对战共用）
│   ├── card-arena.js       # 卡牌对战（2v2 PvE，宝可梦式回合制）
│   ├── card-arena-ui.js    # 卡牌对战 UI 层
│   ├── card-collection.js  # 卡牌收集（多系列图册/分馆视图）
│   ├── math-pk.js          # 数学 PK 竞技台（4难度 × 机器人对手）
│   ├── learn-center.js     # 学习中心（学习包+每日打卡+英语词汇）── 3863行 ⚠️
│   ├── exploration.js      # 探索冒险（12场景螺旋地图+章节叙事+战斗）
│   ├── exploration-detail.js # 探索场景详情页
│   ├── profiles.js         # 多孩子 Profile 管理（localStorage 热切换）
│   ├── walk.js             # 宠物遛弯（路线选择+场景切换+气泡互动）
│   ├── shop.js             # 积分商城（兑换+盲盒+战斗道具）
│   ├── inventory.js        # 道具背包（堆叠+装备）
│   ├── treasure.js         # 宝箱系统（日常/探索/里程碑）
│   ├── voice.js            # 语音系统（Web Speech TTS）
│   ├── tools.js            # 家长工具（番茄钟+数据导出）
│   ├── leaderboard.js      # 排行榜
│   ├── hanzi-game.js       # 汉字答题游戏
│   ├── hanzi-progress.js   # 汉字学习进度
│   ├── english-vocab-progress.js # 英语词汇进度
│   ├── sfx.js              # 音效管理
│   ├── zzfx.js             # ZzFX 音效引擎
│   ├── lucide-lite.js      # 图标库精简版
│   ├── showcase.js         # 作品展示
│   ├── family-review.js    # 本机成长复盘（卡点聚合+下一步建议）
│   └── profiles.js         # 多孩子 Profile 管理（localStorage 热切换）
│
├── css/                    # 12 个 CSS 文件
│   ├── style.css           # 全局样式 ── 6992行 ⚠️
│   ├── learn-center.css    # 学习中心专属样式 ── 4240行 ⚠️
│   ├── walk.css            # 遛弯页样式
│   ├── card-collection.css # 卡牌收集样式
│   ├── arena.css           # 竞技场样式
│   ├── animations.css      # 全局动画
│   ├── playground.css      # 游乐场样式
│   ├── leaderboard.css     # 排行榜样式
│   ├── hanzi-game.css      # 汉字游戏样式
│   ├── showcase.css        # 作品展示样式
│   ├── treasure.css        # 宝箱样式
│   └── vendor/
│       └── tailwind-lite.css # Tailwind 精简版
│
├── data/                   # JSON 数据文件
│   ├── pets.json           # 261 种宠物数据库（6个来源合并）
│   ├── scenes.json         # 探索场景配置
│   ├── skills.json         # 技能定义
│   ├── furniture.json      # 家具目录
│   ├── combat.json         # 战斗配置
│   ├── items.json          # 物品定义
│   ├── point-items.json    # 积分兑换物品
│   ├── hanzi-hsk.json      # HSK 汉字数据集
│   ├── math-cmath.json     # 数学题库
│   ├── arena-stages.json   # 竞技场关卡
│   ├── pokedex-lore-draft.json # 宠物图鉴文案
│   ├── learn/              # 学习包（课程目录+模块定义）
│   │   ├── catalog.json
│   │   └── packs/          # 3个学习包：
│   │       ├── summer-chinese-bridge-2026/  # 暑期语文衔接
│   │       ├── english-mc-hybrid-2026/      # 英语 MC 混合
│   │       └── learning-sites-gateway-2026/ # 学习站点导航
│   ├── stories/            # 12 场景叙事 JSON（每场景独立文件）
│   └── source-snapshots/   # 上游数据源快照
│
├── assets/                 # 图片/动画素材
│   ├── arena/              # 竞技场素材（含 math-rivals/ 机器人对手）
│   ├── background/         # 背景图（8个主题场景）
│   ├── banchong/           # 班宠宠物图片（7个种族 × 6阶段）
│   ├── battle-fx/          # 战斗特效（Lottie JSON + SVG/CSS）
│   ├── cards/              # 卡牌素材
│   ├── learn/              # 学习相关素材
│   ├── pokedex-halls/      # 图鉴大厅素材
│   ├── walk-scenes/        # 遛弯场景图
│   ├── ui/                 # UI 相关素材（points-exchange 等）
│   └── voice/              # 语音素材
│
├── docs/                   # 271 个 Markdown 文档（方案/需求/进度）
├── docs_project/           # 本目录 —— 结构化工程文档
├── prj/                    # ⚠️ 本地原型/参考/临时工程区（远端仅保留少量发布内容）
├── .claude/                # Claude Code 配置（rules/skills/workflows）
└── .github/workflows/      # GitHub Actions 部署
```

---

## 四、14 个核心业务模块

### 模块全景

```
┌─────────────────────────────────────────────────────────────┐
│                     index.html (SPA)                         │
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐        │
│  │ 首页  │ 积分  │ 学习  │ 宠物  │ 探索  │游乐场│家长区│        │
│  │ map  │today │learn │ pet  │explore│playgr│settings│      │
│  └──────┴──────┴──────┴──────┴──────┴──────┴──────┘        │
└─────────────────────────────────────────────────────────────┘

模块清单:
 1. 任务积分系统  → app.js (DIMENSIONS + toggleTask + 积分持久化)
 2. 宠物养成     → pet.js (261物种 × 5阶段 × STATS + decay)
 3. 宠物小屋     → home.js (5槽位家具 + 8主题 + 5维状态条)
 4. 探索冒险     → exploration.js (12场景螺旋地图 + 章节叙事 + PvE)
 5. 卡牌收集     → card-collection.js (多系列图册/分馆/套票奖励)
 6. 卡牌对战     → card-arena.js + card-arena-ui.js (2v2 PvE)
 7. 数学PK      → math-pk.js (4难度 × 机器人对手 × 计时计分)
 8. 学习中心     → learn-center.js (学习包 + 每日学习单 + 英语词汇)
 9. 积分商城     → shop.js (积分兑换 + 盲盒 + 战斗道具)
10. 宠物遛弯     → walk.js (5条路线 × 场景切换 × 气泡互动)
11. 宝箱系统     → treasure.js (日常/探索/里程碑 3 类宝箱)
12. 道具背包     → inventory.js (物品堆叠 + 装备栏)
13. 语音系统     → voice.js (Web Speech API TTS)
14. 家长工具     → tools.js (番茄钟 + 数据导入/导出)
```

### 模块依赖关系

```
                         ┌─────────────┐
                         │  app.js     │ ← 主编排器
                         └──┬──────┬───┘
                            │      │
               ┌────────────┼──────┼───────────────┐
               ▼            ▼      ▼               ▼
         ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
         │ pet.js   │ │ profiles │ │ runtime- │ │ SQLite   │
         │ (宠物核心)│ │ (多孩子) │ │ loader   │ │ (待接入) │
         └────┬─────┘ └──────────┘ └──────────┘ └──────────┘
              │
    ┌────┬────┼────────┬───────────┐
    ▼    ▼    ▼        ▼           ▼
 ┌────┐┌────┐┌──────┐┌────────┐┌──────────┐
 │home││walk││explor││card-   ││battle-   │
 │小屋││遛弯││探索  ││arena   ││engine    │
 └────┘└────┘└──┬───┘└──┬─────┘└────┬─────┘
                │        │           │
                ▼        ▼           ▼
           ┌────────┐┌──────┐┌──────────┐
           │battle- ││card- ││math-pk   │
           │fx      ││collec││hanzi-game│
           └────────┘└──────┘└──────────┘

独立模块: shop, inventory, treasure, voice, tools, showcase
          learn-center, leaderboard, family-review
```

---

## 五、核心层规矩

### 5.1 数据持久化

```
本地主存储:  localStorage (key 前缀 "petbank_")
账号后端:    VPS Node.js API -> SQLite（当前仅健康检查，账号 API 待实现）
Profile:     ProfileManager 热切换（全量快照 + location.reload()）
```

**关键共享 key 清单** → 详见 [data-contracts/localstorage-keys.md](data-contracts/localstorage-keys.md)

### 5.2 模块间通信

```
方式:        window 全局挂载（window.ModuleName.method()）
类型检查:    typeof window.Xxx === 'function' 防御式检查
依赖加载:    runtime-loader.js 按 BUNDLE 定义强制串行加载
事件系统:    无（无 EventEmitter/CustomEvent/pub-sub）
```

### 5.3 错误处理（5 种模式，不一致）

| 模式 | 代码特征 | 使用场景 |
|------|---------|---------|
| A 静默吞错 | `try { ... } catch (e) {}` | 最常见，各模块通用 |
| B console.warn | `console.warn('[module] ...', error)` | runtime-loader 偏好 |
| C 返回 fallback | `try { return JSON.parse(raw); } catch { return fallback; }` | 数据加载偏好 |
| D showToast | `if (window.showToast) window.showToast('...')` | UI 层用户可见 |
| E 不处理 | 直接调用无 try-catch | 大量存在 |

### 5.4 JS 模块模式

```javascript
// 模式A: IIFE（大多数云端模块）
(function () { 'use strict'; /* ... */ })();

// 模式B: 命名空间（核心业务模块）
const ModuleName = (function () { /* ... return publicAPI; */ })();

// 模式C: window 直接挂载（主编排器）
window.switchPage = switchPage;
```

### 5.5 页面路由

```
路由实现:    switchPage(pageName) 函数（约 120 行 if/else）
页面注册:    index.html 中 <div class="page" id="page-{name}">
按需加载:    runtime-loader.js 的 ensurePage() → BUNDLE 映射
路由参数:    options.settingsSection / options.replace / options.updateHistory
浏览器同步:  updateBrowserRoute() 更新 URL hash
```

---

## 六、技术债清单

### 🔴 严重（影响可维护性）

| # | 问题 | 位置 | 说明 |
|---|------|------|------|
| 1 | **app.js 上帝对象** | [js/app.js](../js/app.js) (4747行) | 任务定义+页面路由+UI渲染+事件处理+持久化混在一起 |
| 2 | **无模块系统** | 全部 JS | 40 文件通过 `window.Xxx` 通信，无命名冲突保护 |
| 3 | **localStorage 无 DAO** | 16+ 处直接读写 | 同 key 被多模块操作，无版本/迁移/类型校验 |
| 4 | **Profile 切换脆弱** | [js/profiles.js](../js/profiles.js) | 全量快照+reload，新 key 遗漏无提示 |

### 🟡 中等（影响开发效率）

| # | 问题 | 位置 | 说明 |
|---|------|------|------|
| 5 | **超大 CSS** | [css/style.css](../css/style.css) (6992行), [css/learn-center.css](../css/learn-center.css) (4240行) | 无变量/组件化/层级 |
| 6 | **JS 内嵌 CSS** | [js/app.js#L7-L34](../js/app.js#L7-L34) | 运行时注入 style 标签 |
| 7 | **注释死代码** | [js/app.js#L1032-L1108](../js/app.js#L1032-L1108) | 77 行注释掉的旧路由逻辑 |
| 8 | **prj/ 目录混乱** | [prj/](../prj/) | 旧快照+测试+原型混放 |
| 9 | **.bak 临时文件** | [data/](../data/) | pets.json.bak, hanzi-hsk.json.bak/bak2, 多个 report |
| 10 | **错误处理不一致** | 全局 | 5 种模式随意切换 |

### 🟢 轻度（影响一致性）

| # | 问题 | 位置 |
|---|------|------|
| 11 | 无 package.json/依赖管理 | 根目录 |
| 12 | 中英文混用 | 全局 |
| 13 | 无类型/JSDoc | 全局 |
| 14 | 无 lint/format | 根目录 |
| 15 | 账号与家庭 API 尚未接入 | `prj/petbank-server/` 目前只有健康检查 |

---

## 七、代码修改流程

1. 查阅 [modules/](modules/) 相关模块文档，确认函数位置
2. 修改前检查 [docs/changes/](../docs/changes/) 或相关方案/进度文档，避免重复已废弃方案
3. 修改后同步更新对应的模块实现文档（函数→行号）
4. 涉及 localStorage key 变更 → 更新 [data-contracts/localstorage-keys.md](data-contracts/localstorage-keys.md)
5. 一个版本周期后全量扫描验证文档准确性
