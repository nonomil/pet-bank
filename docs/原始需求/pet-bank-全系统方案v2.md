# 🏦 Pet Bank — 全系统设计方案 v2.0

> 目标仓库：`nonomil/pet-bank` → `nonomil.github.io/pet-bank/`
> 受众：6–12 岁儿童
> 交付对象：CC / 独立开发者
> 日期：2026-06-28

---

## 零、项目全貌（一张图）

```
┌─────────────────────────────────────────────────────────┐
│                    PET BANK 系统图                       │
│                                                         │
│  ┌──────────┐    积分    ┌──────────────────────────┐   │
│  │ 任务系统  │ ─────────▶│       宠物养成核心        │   │
│  │打卡/数学PK│◀─────────│  16角色×5阶段=80张图      │   │
│  └──────────┘  成就奖励 │  状态值/进化/互动         │   │
│                         └──────────┬─────────────────┘  │
│  ┌──────────┐                      │                    │
│  │ 探索系统  │◀─────────────────── │ 宠物出发           │
│  │5场景/事件 │──────────────────▶  │ 道具/战利品        │
│  └──────────┘                      │                    │
│  ┌──────────┐                      │                    │
│  │ 背包系统  │◀─────────────────── │ 获得/使用道具      │
│  │26种道具   │──────────────────▶  │ 喂食/玩耍/强化     │
│  └──────────┘                      │                    │
│  ┌──────────┐                      │                    │
│  │ 战斗系统  │◀─────────────────── │ 遭遇敌人           │
│  │回合制自动 │──────────────────▶  │ 奖励积分/EXP       │
│  └──────────┘                      │                    │
│  ┌──────────┐                      │                    │
│  │ 商店系统  │◀─── 积分消费 ────── │ 购买道具/解锁角色  │
│  └──────────┘                      │                    │
└─────────────────────────────────────────────────────────┘
```

---

## 一、角色库（80张图，2大系列）

### 1.1 系列 A：PVZ 植物大战僵尸（8角色 × 5阶段 = 40张）

每个角色从"种子/蛋"阶段进化到"终极形态"。

| # | 角色 | 中文名 | 类型 | 特长 | 关键视觉特征 |
|---|------|--------|------|------|------------|
| 1 | Peashooter | 豌豆射手 ✅ | 攻击型 | 远程连射 | 绿色管状嘴，圆脑袋 |
| 2 | Sunflower | 向日葵 | 治疗型 | 回复HP | 大黄脸+花瓣光环 |
| 3 | Wall-nut | 坚果墙 | 防御型 | 高HP吸伤 | 棕色裂纹外壳，忧郁眼 |
| 4 | Cherry Bomb | 樱桃炸弹 | 爆破型 | 范围伤害 | 双樱桃+导火线+笑脸 |
| 5 | Snow Pea | 寒冰射手 | 减速型 | 冻结敌人 | 蓝色豌豆射手+冰霜 |
| 6 | Chomper | 大嘴花 | 近战型 | 整口吞敌 | 巨嘴紫花，唾液闪光 |
| 7 | Sunflower (Twin) | 双子向日葵 | 超级治疗 | 双倍回复 | 两个花头并排 |
| 8 | Cactus | 仙人掌 | 对空型 | 击落飞行 | 绿色方块身体+尖刺 |

#### PVZ 5阶段进化命名

| 阶段 | 名称 | 视觉描述 | 解锁亲密值 |
|------|------|---------|-----------|
| Stage 1 | 🌱 种子 | 土里的芽，几乎看不出角色 | 0 |
| Stage 2 | 🌿 幼苗 | 长出来了，但很小，表情懵懵 | 50 |
| Stage 3 | 🌸 成长期 | 完整形态但尺寸小，有基本能力 | 150 |
| Stage 4 | 🌳 成熟体 | 标准大小，能力全开 | 300 |
| Stage 5 | ⚡ 传说级 | 发光特效+专属武装（如豌豆射手有金属炮管）| 600 |

#### PVZ 图像生成 Prompt 模板（豌豆射手 Stage 5 示例）

```
Pixel art Peashooter from Plants vs Zombies, LEGENDARY Stage 5 evolution,
golden metallic cannon barrel, glowing green aura, star burst effects,
original PVZ style with bold black 2px outline, huge expressive eyes,
bright saturated colors, celebrating victory pose, transparent background,
128x128px, 8-color palette max, chibi cartoon style
```

---

### 1.2 系列 B：Minecraft（8角色 × 5阶段 = 40张）

| # | 角色 | 中文名 | 类型 | 特长 | 关键视觉特征 |
|---|------|--------|------|------|------------|
| 1 | Wolf | 狼 | 战斗型 | 高攻击 | 灰色方块头，红眼→驯化后橙眼 |
| 2 | Cat | 猫 | 侦察型 | 发现稀有物 | 白/橘色，方脸，长胡须 |
| 3 | Rabbit | 兔子 | 速度型 | 探索更快 | 方块头+大耳，多色变种 |
| 4 | Parrot | 鹦鹉 | 情报型 | 复制敌方技能 | 彩色像素方块羽毛 |
| 5 | Turtle | 海龟 | 防御型 | 水下无敌 | 绿色几何龟壳 |
| 6 | Axolotl | 美西螈 | 回复型 | 战斗后HP+50% | 粉色/蓝色蝾螈，腮冠 |
| 7 | Enderman | 末影人 | 传送型 | 可传送场景 | 细长黑色，紫眼，拿方块 |
| 8 | Allay | 悦灵 | 收集型 | 自动拾取道具 | 蓝色精灵，大眼，飘动 |

#### Minecraft 5阶段进化命名

| 阶段 | 名称 | 视觉描述 | 解锁亲密值 |
|------|------|---------|-----------|
| Stage 1 | 🥚 生成蛋 | 像素彩蛋，角色图案印在蛋上 | 0 |
| Stage 2 | 🐣 幼体 | 1-pixel 眼睛，超圆润方块体 | 50 |
| Stage 3 | 🔧 普通 | 原版 Minecraft mob 外观 | 150 |
| Stage 4 | 💎 钻石装备 | 身上有钻石纹路装饰 | 300 |
| Stage 5 | 🌌 下界之主 | 熔岩/星空纹理，发光粒子效果 | 600 |

#### Minecraft 图像生成 Prompt 模板（悦灵 Stage 5 示例）

```
Pixel art Allay from Minecraft, LEGENDARY Stage 5, cosmic nebula texture body,
glowing purple-blue aura, star particle effects floating around,
blocky Minecraft mob style, square proportions, 2px black outline,
transparent background, 128x128px, 8 color palette, magical dancing pose
```

---

### 1.3 图片生成工作流（35张待生成）

**批次安排（建议 CC 分批调用 GPT-IMAGE-2）：**

```
批次 1（优先）：PVZ 向日葵 5阶段 + Minecraft 狼 5阶段 = 10张
批次 2：PVZ 坚果墙 5阶段 + Minecraft 猫 5阶段 = 10张
批次 3：PVZ 樱桃炸弹 5阶段 + Minecraft 兔子 5阶段 = 10张
批次 4：其余 4PVZ + 5MC 角色剩余阶段 = 15张
总计：45张（加上已有豌豆射手5张 = 50张，剩30张补完到80张）
```

**命名规范：**
```
assets/chars/
├── pvz/
│   ├── peashooter_s1.png  ← stage1
│   ├── peashooter_s2.png
│   ├── peashooter_s3.png
│   ├── peashooter_s4.png
│   ├── peashooter_s5.png
│   ├── sunflower_s1.png
│   └── ...（共 40 文件）
└── mc/
    ├── wolf_s1.png
    └── ...（共 40 文件）
```

---

## 二、网页系统设计

### 2.1 整体架构（单页应用 SPA）

```
index.html
├── 界面 A：角色选择屏（首次进入）
│   ├── 系列选择：PVZ / Minecraft
│   └── 8格角色卡片（含稀有度、类型标签）
│
├── 界面 B：宠物主屏（核心）
│   ├── 宠物展示区（动画 + 阶段展示）
│   ├── 五维状态条
│   ├── 四个快捷互动按钮
│   └── 底部 Tab：[主页][探索][背包][任务][商店]
│
├── 界面 C：探索屏
│   ├── 场景地图（5个区域）
│   └── 探索过程动画
│
├── 界面 D：背包屏
│   ├── 道具网格（6列）
│   └── 道具使用确认弹窗
│
├── 界面 E：任务屏
│   ├── 今日任务列表
│   ├── 数学PK游戏
│   └── 打卡历史
│
└── 界面 F：商店屏
    ├── 道具商店
    └── 角色解锁商店
```

### 2.2 界面 A：角色选择屏

```
┌──────────────────────────────────────────┐
│  🐾 选择你的伙伴                          │
│                                          │
│  [🌻 植物大战僵尸]  [⛏️ 我的世界]         │  ← 系列切换 Tab
│  ───────────────────────────────         │
│                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │[图]  │ │[图]  │ │[图]  │ │[图]  │   │
│  │豌豆  │ │向日葵│ │坚果墙│ │樱桃弹│   │
│  │攻击型│ │治疗型│ │防御型│ │爆破型│   │
│  │⭐⭐⭐│ │⭐⭐⭐│ │⭐⭐  │ │⭐⭐⭐│   │
│  └──────┘ └──────┘ └──────┘ └──────┘   │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐   │
│  │[图]  │ │[图]  │ │[图]  │ │[图]🔒│   │
│  │寒冰  │ │大嘴花│ │双向葵│ │仙人掌│   │
│  │减速型│ │近战型│ │超治疗│ │500⭐锁│   │
│  └──────┘ └──────┘ └──────┘ └──────┘   │
│                                          │
│  ✨ 点击角色预览  ·  积分不足的显示锁     │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │ 向日葵                             │  │  ← 选中角色详情
│  │ 治疗型 · 推荐新手                  │  │
│  │ 特技：每5分钟自动回复10 HP          │  │
│  │ 最终形态：双子向日葵 ✨             │  │
│  │              [选择 Ta！]           │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### 2.3 界面 B：宠物主屏（核心界面）

```
┌──────────────────────────────────────────┐
│  小豆豆  Lv.7  ⭐1,280分  [商店🛒]        │  ← 顶栏
├──────────────────────────────────────────┤
│                                          │
│         ┌─────────────────┐             │
│         │                 │             │
│         │   [宠物动画]    │  ← 160×160  │
│         │   🌱→🌿→🌸     │    阶段动态  │
│         │   Stage 3       │             │
│         └─────────────────┘             │
│         💬 "我有点饿了～"               │  ← 宠物心情气泡
│                                          │
│  ❤️ HP   [████████░░] 78/100            │
│  🍖 饱食  [████░░░░░░] 42/100  ⚠️饿了   │
│  😊 快乐  [██████░░░░] 60/100           │
│  💕 亲密  [▓▓▓░░░░░░░] 140/300→Stg4    │
│  ⭐ 经验  [████████░░] 320/400 → Lv.8  │
│                                          │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌───┐ │
│  │🍎喂食  │ │🎾玩耍  │ │🛁洗澡  │ │💊 │ │
│  │-10分   │ │免费    │ │-5分    │ │治疗│ │
│  └────────┘ └────────┘ └────────┘ └───┘ │
├──────────────────────────────────────────┤
│  [🏠主页] [🗺️探索] [🎒背包] [📋任务] [🏪商店] │
└──────────────────────────────────────────┘
```

**宠物心情气泡触发规则：**
| 条件 | 气泡文案 |
|------|---------|
| 饱食<30 | "我有点饿了呜呜…" |
| 快乐<30 | "好无聊，陪我玩嘛！" |
| HP<40 | "好难受…需要治疗" |
| 互动后 | "谢谢！开心❤️" |
| 升级 | "我进化啦！！！🎉" |
| 探索回来 | "我带宝贝回来了！" |

### 2.4 界面 C：探索屏

```
┌──────────────────────────────────────────┐
│  🗺️ 选择探索场景                          │
│  小豆豆 HP:78  准备好了！                 │
├──────────────────────────────────────────┤
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  🌲 神秘森林           [已解锁]    │  │
│  │  普通难度 · 掉落：浆果/树叶/蘑菇  │  │
│  │  预计30秒  风险：低               │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  🏖️ 阳光海滩           [亲密≥50]  │  │
│  │  中等难度 · 掉落：贝壳/珍珠/椰子  │  │
│  │  预计45秒  风险：中               │  │
│  └────────────────────────────────────┘  │
│                                          │
│  ┌────────────────────────────────────┐  │
│  │  ⛰️ 雪山秘境      🔒 亲密≥200    │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  🍭 糖果王国      🔒 亲密≥350    │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  🚀 星际空间      🔒 Stage 5      │  │
│  └────────────────────────────────────┘  │
│                                          │
│           [出发探索！]                   │
└──────────────────────────────────────────┘
```

**探索动画流程（30秒沉浸式）：**
```
[出发] → 宠物走路动画(右移出屏) →
背景切换到场景 → 随机事件文字逐字显示 →
(道具/战斗/剧情) → 结果展示3秒 →
宠物走路回来 → 背包更新 → 返回主屏
```

### 2.5 界面 D：背包屏

```
┌──────────────────────────────────────────┐
│  🎒 背包   [食物] [玩具] [道具] [材料]   │
├──────────────────────────────────────────┤
│                                          │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│  │🍎×3│ │🦴×1│ │🎂×0│ │🍓×5│ │🥥×2│   │
│  │苹果│ │骨头│ │蛋糕│ │浆果│ │椰子│   │
│  └────┘ └────┘ └────┘ └────┘ └────┘   │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐   │
│  │🧶×2│ │🥏×0│ │🧩×1│ │💊×3│ │💎×1│   │
│  │毛线│ │飞盘│ │拼图│ │药水│ │水晶│   │
│  └────┘ └────┘ └────┘ └────┘ └────┘   │
│  ...更多...                             │
│                                          │
│  ── 选中：🍎 苹果 ──────────────────    │
│  喂食后：饱食 +25，经验 +10             │
│  库存：3个          [使用 🍎]           │
└──────────────────────────────────────────┘
```

### 2.6 界面 E：任务屏

```
┌──────────────────────────────────────────┐
│  📋 今日任务   [任务] [数学PK] [历史]    │
├──────────────────────────────────────────┤
│  今日积分：+85 / 目标 120                │
│  [■■■■■■░░░░] 71%                      │
│                                          │
│  ✅ 早起打卡           +20分  已完成     │
│  ✅ 完成一项学习任务   +30分  已完成     │
│  ⬜ 完成运动打卡       +20分  [打卡]     │
│  ⬜ 数学PK 答对5题     +25分  [去PK]     │
│  ⬜ 连续打卡奖励       +50分  已连5天🔥  │
│                                          │
│  ── 数学PK ─────────────────────────    │
│                                          │
│         🧮 23 + 47 = ?                  │
│                                          │
│    ┌──────────────────┐  [确认]         │
│    │       70         │                 │
│    └──────────────────┘                 │
│                                          │
│    ⏱ 倒计时：8秒    连击：×2 🔥        │
│    题目：3/5    正确：3    得分：+45分  │
└──────────────────────────────────────────┘
```

**数学PK详细规则：**
- 100以内加减乘除（难度随等级调整）
- 每题10秒倒计时
- 答对 +15分，连对5题触发连击（分数×2）
- 连击中答错，连击重置
- 每日最多做 20题（=300分上限）
- 答题时宠物在屏幕角落加油助威（跳动动画）

### 2.7 界面 F：商店屏

```
┌──────────────────────────────────────────┐
│  🏪 商店    我的积分：⭐ 1,280          │
│  [道具] [角色解锁] [宠物小屋]           │
├──────────────────────────────────────────┤
│                                          │
│  ── 热卖道具 ───────────────────────    │
│  🍎 苹果          10分  [购买]          │
│  🦴 大骨头        20分  [购买]          │
│  🎂 生日蛋糕      50分  [购买]          │
│  💊 治疗药水      35分  [购买]          │
│  ✨ 传说水晶     200分  [购买]          │
│                                          │
│  ── 解锁角色 ───────────────────────    │
│  🌵 仙人掌       500分  [解锁]  🔒      │
│  🐺 末影人       800分  [解锁]  🔒      │
│  💙 悦灵        1000分  [解锁]  🔒      │
│                                          │
│  ── 宠物小屋装饰（即将上线）──────────   │
│  🛋️ 豪华地毯      ??? 敬请期待          │
└──────────────────────────────────────────┘
```

---

## 三、技术实现方案

### 3.1 文件结构

```
pet-bank/
├── index.html                  # 唯一入口，SPA
├── css/
│   ├── reset.css               # 基础重置
│   ├── variables.css           # CSS 变量（颜色/字体/间距）
│   ├── layout.css              # 页面布局/Tab 切换
│   ├── components.css          # 按钮/状态条/卡片 组件
│   ├── animations.css          # 所有 @keyframes
│   └── screens.css             # 各界面专属样式
├── js/
│   ├── config.js               # 所有静态数据（角色/道具/场景定义）
│   ├── state.js                # 全局状态管理（类 Redux，纯对象）
│   ├── save.js                 # localStorage 读写
│   ├── pet.js                  # 宠物逻辑（喂食/玩耍/进化判断）
│   ├── scene.js                # 探索逻辑（随机事件/战斗）
│   ├── inventory.js            # 背包逻辑
│   ├── tasks.js                # 任务/数学PK 逻辑
│   ├── shop.js                 # 商店逻辑
│   ├── ui.js                   # UI 渲染函数（更新 DOM）
│   └── main.js                 # 入口，绑定事件
└── assets/
    ├── chars/
    │   ├── pvz/                # 40张 PVZ 图（8角色×5阶段）
    │   └── mc/                 # 40张 MC 图（8角色×5阶段）
    ├── items/                  # 26种道具图标（32×32 PNG）
    ├── scenes/                 # 5个场景背景图
    └── ui/                     # UI 图标（按钮/标签等）
```

### 3.2 状态数据结构

```javascript
// js/state.js — 全局状态，单一数据源
const STATE = {
  meta: {
    version: "2.0",
    totalScore: 1280,
    lastLogin: 1719532800,
    loginStreak: 5,          // 连续登录天数
  },

  activePet: "peashooter",   // 当前激活角色 ID

  pets: {
    peashooter: {
      unlocked: true,
      series: "pvz",         // "pvz" | "mc"
      nickname: "小豆豆",
      stage: 3,              // 1-5
      level: 7,
      hp: 78,   maxHp: 100,
      hunger: 42,
      happiness: 60,
      intimacy: 140,         // 亲密度决定进化阶段
      exp: 320,  expToNext: 400,
      lastFed: 1719532800,   // Unix 时间戳（用于自然衰减）
      totalCareTime: 18000,  // 累计互动秒数
    },
    sunflower: { unlocked: false, ... },
    wallnut:   { unlocked: false, ... },
    // ... 共 16 个角色对象
  },

  inventory: {
    // 食物
    apple: 3, bone: 1, cake: 0, berry: 5, coconut: 2,
    candy: 0, sushi: 0, milk: 1,
    // 玩具
    yarn: 2, frisbee: 0, puzzle: 1, mirror: 0,
    // 道具
    potion: 3, crystal: 1, megaPotion: 0,
    // 稀有材料
    starDust: 2, cosmicRock: 0, iceGem: 1, pearl: 0,
    rainbowFeather: 0, dragonCrystal: 0,
  },

  scenes: {
    unlockedScenes: ["forest"],
    lastExplored: null,
  },

  tasks: {
    today: {
      date: "2026-06-28",
      morningCheckin: true,
      studyTask: true,
      sportsTask: false,
      mathPK: { done: false, correct: 0, target: 5 },
      streakBonus: false,
    },
    history: [],             // 每日任务记录数组
  },

  achievements: [],          // 解锁成就 ID 列表
};
```

### 3.3 宠物进化判断逻辑

```javascript
// js/pet.js
const STAGE_THRESHOLDS = {
  pvz: [0, 50, 150, 300, 600],
  mc:  [0, 50, 150, 300, 600],
};

function checkEvolution(pet) {
  const thresholds = STAGE_THRESHOLDS[pet.series];
  let newStage = 1;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (pet.intimacy >= thresholds[i]) {
      newStage = i + 1;
      break;
    }
  }
  if (newStage > pet.stage) {
    pet.stage = newStage;
    triggerEvolutionAnimation(pet);  // 播放进化动画
    showEvolutionModal(pet);         // 弹出进化庆祝弹窗
  }
}

// 自然衰减（每小时触发）
function naturalDecay(pet) {
  const now = Date.now() / 1000;
  const hoursPassed = (now - pet.lastFed) / 3600;
  pet.hunger    = Math.max(0, pet.hunger    - 2 * hoursPassed);
  pet.happiness = Math.max(0, pet.happiness - 1 * hoursPassed);
  if (pet.hunger <= 0) {
    pet.hp = Math.max(0, pet.hp - 5 * hoursPassed);  // 饿到掉血
  }
  pet.lastFed = now;
}
```

### 3.4 探索随机事件系统

```javascript
// js/scene.js
const SCENES = {
  forest: {
    name: "神秘森林", emoji: "🌲",
    unlockIntimacy: 0,
    duration: 30000,        // 毫秒
    events: [
      { weight: 40, type: "item", pool: ["berry","berry","mushroom","leaf"] },
      { weight: 30, type: "combat", enemy: "treeSpirit" },
      { weight: 20, type: "rare",  pool: ["rainbowFeather"] },
      { weight: 10, type: "story", texts: [
        "小豆豆发现了一棵会唱歌的树！",
        "森林深处传来神秘的呼唤...",
        "一只小松鼠冲过来抢走了你的帽子！"
      ]}
    ],
  },
  // ... 其余 4 个场景
};

function runExploration(sceneId, pet) {
  const scene = SCENES[sceneId];
  const roll = Math.random() * 100;
  let cumWeight = 0;

  for (const event of scene.events) {
    cumWeight += event.weight;
    if (roll < cumWeight) {
      return resolveEvent(event, pet);
    }
  }
}
```

### 3.5 数学 PK 游戏逻辑

```javascript
// js/tasks.js
const MATH_CONFIG = {
  timePerQuestion: 10,       // 秒
  questionsPerSession: 5,
  scorePerCorrect: 15,
  comboThreshold: 3,         // 连对几题触发连击
  comboMultiplier: 2,
  maxDailyQuestions: 20,

  // 难度随宠物等级调整
  getDifficulty(petLevel) {
    if (petLevel <= 3)  return { ops: ['+','-'], range: 20 };
    if (petLevel <= 6)  return { ops: ['+','-'], range: 50 };
    if (petLevel <= 9)  return { ops: ['+','-','×'], range: 100 };
    return { ops: ['+','-','×','÷'], range: 100 };
  },

  generateQuestion(difficulty) {
    const op = difficulty.ops[Math.floor(Math.random() * difficulty.ops.length)];
    let a, b, answer;
    // ... 确保除法整除，答案为正整数
    return { display: `${a} ${op} ${b} = ?`, answer };
  }
};
```

### 3.6 战斗系统（回合制自动）

```javascript
// js/scene.js — combat resolver
const ENEMIES = {
  treeSpirit: { name:"树精灵", hp:30, atk:8,  reward:{exp:20, items:["leaf"]} },
  crab:       { name:"螃蟹怪", hp:25, atk:10, reward:{exp:15, items:["shell"]} },
  snowMonster:{ name:"雪怪",   hp:50, atk:15, reward:{exp:35, items:["iceGem"]} },
  candyMan:   { name:"糖人",   hp:40, atk:12, reward:{exp:28, items:["candy","candy"]} },
  alienSlime: { name:"外星史莱姆", hp:60, atk:18, reward:{exp:50, items:["starDust"]} },
};

function autoCombat(pet, enemyId) {
  const enemy = { ...ENEMIES[enemyId] };
  const petAtk = pet.level * 5 + Math.floor(Math.random() * 10);
  const petDef = Math.floor(pet.intimacy / 20);
  const log = [];
  let round = 1;

  while (pet.hp > 0 && enemy.hp > 0) {
    // 宠物攻击
    enemy.hp -= petAtk;
    log.push(`第${round}回合：${pet.nickname}攻击 ${petAtk}！`);
    if (enemy.hp <= 0) break;
    // 敌方反击
    const dmg = Math.max(1, enemy.atk - petDef);
    pet.hp -= dmg;
    log.push(`${enemy.name}反击 ${dmg}！`);
    round++;
  }

  return { win: pet.hp > 0, log, reward: pet.hp > 0 ? enemy.reward : null };
}
```

---

## 四、视觉设计规范

### 4.1 颜色系统（深夜游戏主题）

```css
:root {
  /* === 背景层 === */
  --bg-deep:      #0F1A2E;   /* 最深背景，星空感 */
  --bg-main:      #1A2744;   /* 主背景 */
  --bg-card:      #243356;   /* 卡片/面板背景 */
  --bg-card2:     #2E4070;   /* 次级卡片 */
  --bg-highlight: #3A5090;   /* 高亮/悬停 */

  /* === 主色调 === */
  --color-pvz:    #7BC950;   /* PVZ 绿（向日葵/豌豆） */
  --color-mc:     #5B8DD9;   /* MC 蓝（钻石/末影） */
  --color-gold:   #FFD93D;   /* 积分/星星/等级 */
  --color-orange: #FF8C42;   /* 暖强调/按钮 */
  --color-pink:   #FF6B9D;   /* 快乐/爱心 */

  /* === 状态条颜色 === */
  --stat-hp:      #FF4444;
  --stat-hunger:  #FF9800;
  --stat-happy:   #E91E63;
  --stat-intimacy:#9C27B0;
  --stat-exp:     #2196F3;

  /* === 文字 === */
  --text-primary: #F0F4FF;
  --text-sub:     #9DAAC8;
  --text-muted:   #5A6A8A;

  /* === 边框 === */
  --border:       #3A4F7A;
  --border-glow:  rgba(91,141,217,0.4);

  /* === 像素阴影 === */
  --pixel-shadow: 3px 3px 0 #000;
  --pixel-shadow-lg: 4px 4px 0 #000;
}
```

### 4.2 字体规范

```css
/* Google Fonts 引入 */
@import url('https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Press+Start+2P&display=swap');

/* 角色/任务/对话 — 温暖手写感 */
.font-story  { font-family: 'Ma Shan Zheng', cursive; }

/* 数字/等级/积分 — 像素游戏感 */
.font-pixel  { font-family: 'Press Start 2P', monospace;
               font-size: 0.75rem; line-height: 1.6; }

/* 正文/按钮 */
.font-body   { font-family: 'Ma Shan Zheng', system-ui, sans-serif;
               font-size: 1rem; }
```

### 4.3 像素按钮规范

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 18px;
  border: 3px solid #000;
  border-radius: 6px;
  box-shadow: var(--pixel-shadow);
  font-family: 'Ma Shan Zheng', cursive;
  font-size: 1rem;
  cursor: pointer;
  transition: transform 0.08s, box-shadow 0.08s;
  user-select: none;
}
.btn:active {
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 #000;
}

/* 类型变体 */
.btn-primary  { background: var(--color-orange); color: #fff; }
.btn-pvz      { background: var(--color-pvz);    color: #1A2744; }
.btn-mc       { background: var(--color-mc);     color: #fff; }
.btn-danger   { background: var(--stat-hp);      color: #fff; }
.btn-ghost    { background: transparent; color: var(--text-primary);
                border-color: var(--border); box-shadow: none; }
```

### 4.4 状态条组件

```css
.stat-bar-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0;
}
.stat-label { width: 24px; font-size: 1.1rem; }
.stat-bar {
  flex: 1;
  height: 14px;
  background: var(--bg-deep);
  border: 2px solid #000;
  border-radius: 3px;
  overflow: hidden;
}
.stat-bar-fill {
  height: 100%;
  border-radius: 1px;
  transition: width 0.4s ease;
  /* 像素条纹 */
  background-image: repeating-linear-gradient(
    90deg,
    transparent 0 6px,
    rgba(255,255,255,0.12) 6px 7px
  );
}
.stat-value { font-family: 'Press Start 2P'; font-size: 0.6rem;
              color: var(--text-sub); min-width: 48px; text-align: right; }
```

### 4.5 进化动画（CSS Keyframes）

```css
/* 进化闪光 */
@keyframes evolve-flash {
  0%   { filter: brightness(1); }
  25%  { filter: brightness(3) saturate(2); }
  50%  { filter: brightness(1); transform: scale(1.2); }
  75%  { filter: brightness(3) saturate(2); }
  100% { filter: brightness(1); transform: scale(1); }
}

/* 升级粒子效果（用 ::before/::after 模拟） */
@keyframes level-up-burst {
  0%   { transform: scale(0) rotate(0deg); opacity: 1; }
  100% { transform: scale(2) rotate(360deg); opacity: 0; }
}

/* 宠物待机浮动 */
@keyframes idle-float {
  0%, 100% { transform: translateY(0) rotate(-1deg); }
  50%       { transform: translateY(-8px) rotate(1deg); }
}

/* 数学PK 答对庆祝 */
@keyframes celebrate-bounce {
  0%, 100% { transform: translateY(0) scale(1); }
  30%       { transform: translateY(-16px) scale(1.1); }
  60%       { transform: translateY(-8px) scale(1.05); }
}
```

---

## 五、图片资产生成全清单

### 5.1 PVZ 系列（40张）

| 角色 | Stage1 | Stage2 | Stage3 | Stage4 | Stage5 |
|------|--------|--------|--------|--------|--------|
| 豌豆射手 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 向日葵 | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 坚果墙 | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 樱桃炸弹 | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 寒冰射手 | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 大嘴花 | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 双子向日葵 | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 仙人掌 | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

### 5.2 Minecraft 系列（40张）

| 角色 | Stage1 | Stage2 | Stage3 | Stage4 | Stage5 |
|------|--------|--------|--------|--------|--------|
| 狼 Wolf | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 猫 Cat | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 兔子 Rabbit | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 鹦鹉 Parrot | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 海龟 Turtle | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 美西螈 Axolotl | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 末影人 Enderman | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |
| 悦灵 Allay | ⏳ | ⏳ | ⏳ | ⏳ | ⏳ |

### 5.3 GPT-IMAGE-2 Prompt 批量模板

**PVZ 向日葵 Stage 1–5（示例）：**
```
S1: Tiny Sunflower seed from Plants vs Zombies, PVZ art style,
    just a yellow seed with tiny eyes peeking out, bold black outline,
    transparent background, 128x128px, pixel art, 8 colors max

S2: Baby Sunflower sprout from PVZ, small round yellow face with
    2 tiny petals, big expressive eyes, cute seedling stem,
    PVZ cartoon style, bold outline, transparent bg, 128x128px

S3: Sunflower from PVZ stage 3, medium size, 8 petals, big happy eyes,
    bouncing pose, classic PVZ art style, black outline, 128x128px

S4: Mature Sunflower from PVZ, full bloom, 12 golden petals,
    glowing center, confident smile, PVZ art style, 128x128px

S5: LEGENDARY Sunflower PVZ, twin heads, rainbow petals,
    divine golden aura, star burst effects, epic pose, 128x128px
```

---

## 六、实现路线图

### Phase 1 — 核心框架（2-3天）
**优先级：能跑起来，能看宠物，能互动**

- [ ] HTML 骨架 + Tab 导航
- [ ] CSS 变量系统 + 字体加载
- [ ] 宠物主屏（使用已有豌豆射手图片）
- [ ] 五维状态条（静态展示）
- [ ] 4个互动按钮（喂食/玩耍/洗澡/治疗）
- [ ] localStorage 存档基础版
- [ ] 部署到 GitHub Pages

### Phase 2 — 角色系统（3-5天）
**批量生成图片后集成**

- [ ] 角色选择屏（PVZ/MC 双系列）
- [ ] 5阶段进化系统 + 进化动画
- [ ] 图片动态切换（stage1.png → stage5.png）
- [ ] 心情气泡系统
- [ ] 自然衰减逻辑（定时器）

### Phase 3 — 任务闭环（5-7天）
**让"学习→积分→养宠"跑通**

- [ ] 任务屏（打卡系统）
- [ ] 数学PK游戏（完整逻辑）
- [ ] 积分系统联动
- [ ] 今日任务面板

### Phase 4 — 探索与战斗（7-10天）
**加深游戏性**

- [ ] 探索屏（5个场景）
- [ ] 随机事件系统
- [ ] 自动战斗系统
- [ ] 背包系统

### Phase 5 — 商店与成就（10天+）
**完整体验**

- [ ] 商店（道具购买/角色解锁）
- [ ] 宠物宝箱（随机开箱）
- [ ] 成就系统
- [ ] 宠物对战（本地双人）
- [ ] 宠物小屋装饰

---

## 七、交付检查清单（CC 验收标准）

### 最低可交付（Phase 1 完成）
- [ ] 访问 `nonomil.github.io/pet-bank/` 正常加载
- [ ] 豌豆射手图片正常显示，有 idle 动画
- [ ] 五维状态条正确显示颜色
- [ ] 喂食按钮点击 → 饱食值 +25 → 积分 -10
- [ ] 数值变化有过渡动画
- [ ] 手机 375px 宽正常显示
- [ ] 刷新后数据不丢失

### 完整交付（Phase 5 完成）
- [ ] 80张图片全部生成并集成
- [ ] 16个角色均可解锁/切换
- [ ] 5阶段进化流程完整
- [ ] 探索5个场景均可进入
- [ ] 数学PK游戏完整可玩
- [ ] 商店购买/解锁正常
- [ ] 背包显示/使用道具正常

---

*版本：v2.0 | 日期：2026-06-28*
*下次更新：Phase 1 完成后，更新图片进度至 Phase 2*
