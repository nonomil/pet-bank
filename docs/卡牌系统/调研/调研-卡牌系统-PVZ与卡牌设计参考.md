# 调研：卡牌系统设计参考（PVZ 与主流卡牌）

> 调研日期：2026-07-01
> 调研目的：为「宠物积分系统」卡牌呈现层提供边框设计、稀有度配色、图层叠加方案、数值布局的设计依据。
> 来源：WebSearch 综合 PvZ Wiki、Hearthstone Wiki、MTG 官方、Warcraft Wiki、阴阳师百闻牌资料等。

---

## 目录

1. [PVZ 卡牌核心设计要素](#1-pvz-卡牌核心设计要素)
2. [主流卡牌游戏对比](#2-主流卡牌游戏对比)
3. [稀有度配色规范](#3-稀有度配色规范)
4. [图层叠加方案](#4-图层叠加方案)
5. [战力数值布局建议](#5-战力数值布局建议)
6. [落地推荐方案](#6-落地推荐方案)
7. [关键参考链接](#7-关键参考链接)

---

## 1. PVZ 卡牌核心设计要素

### 1.1 种子包（Seed Packet）结构

PVZ 的「种子包/卡槽卡」是塔防场景下植物选择的核心 UI，其结构高度可复用到本项目的宠物卡牌。

```
┌───────────────────────────┐
│  ╔═════════════════════╗  │  ← 外框（border，按等级/稀有度变化）
│  ║                     ║  │
│  ║   [植物/角色立绘]    ║  │  ← 中央图区（illustration）
│  ║                     ║  │
│  ║                     ║  │
│  ╠═════════════════════╣  │
│  ║      名称栏          ║  │  ← 名称区（name bar，底部或顶部）
│  ╚═════════════════════╝  │
│  ┌─────┐                  │
│  │ 阳光 │ ← 角标（cost）   │  ← 资源值角标（sun cost，左上或底部）
│  │  75 │                  │
│  └─────┘                  │
└───────────────────────────┘
   ▓▓▓▓▓░░░░░░░░░░          ← 冷却条（cooldown bar，底部覆盖层）
```

**核心要素拆解：**

| 要素 | PVZ 实现 | 本项目复用建议 |
|------|---------|---------------|
| **外形** | 竖向矩形（卡槽）/ 横向矩形（图鉴） | 宠物卡统一竖向矩形，比例 3:4 |
| **边框（border）** | 实木质感外框，PvZ2 中按植物等级（Level 1-5）变化边框样式与颜色 | 按稀有度（N/R/SR/SSR）变化边框色 + 光效 |
| **图区（illustration）** | 中央，占卡面 60-70%，植物半身/全身立绘 | 角色立绘透明 PNG，占中央 65% |
| **阳光值角标（cost）** | 底部居中或左上，太阳图标 + 数字 | 战力/等级角标，左上角 |
| **名称栏（name bar）** | 底部条带，深色底白字 | 底部半透明黑底白字条 |
| **冷却条（cooldown）** | 使用后覆盖一层从左到右/从下到上消退的深色蒙版 | 战斗中可复用为「技能冷却」覆盖层 |
| **底纹（texture）** | 卡槽有种子袋/木纹质感底纹 | 不同稀有度用不同底纹（普通纯色 / SSR 镭射） |

### 1.2 僵尸图鉴卡（Almanac Card）

- 更接近传统收集卡：上方大图 + 下方文字描述区（描述、韧性、速度、特色）。
- 描述区采用「字段：值」的列表式布局（如「韧性：低」「速度：普通」）。
- **可复用**：宠物图鉴/详情卡采用同样布局——大图 + 属性行（HP/ATK/DEF/SPD）+ 描述。

### 1.3 PvZ2 植物等级卡

PvZ2 的等级系统（Level 1 → Mastery）边框演变：
- **Level 1-4**：基础边框，渐变颜色（绿→蓝→紫→金）。
- **Level 5+（Mastery）**：金色/彩虹边框 + 特殊光效。
- 对应本项目：稀有度梯度直接借鉴此「边框颜色随等级跃迁」的设计语言。

---

## 2. 主流卡牌游戏对比

### 2.1 对比表

| 维度 | 炉石传说 Hearthstone | 万智牌 MTG | 阴阳师百闻牌 | PVZ 种子包 |
|------|---------------------|-----------|-------------|-----------|
| **外形比例** | 竖卡 ~3:4.3 | 标准扑克比例 ~2.5:3.5 | 竖卡 ~3:4 | 竖/横矩形 |
| **稀有度体系** | 普通/稀有/史诗/传说（+免费） | 普通/非普通/稀有/秘稀 | N/R/SR/SSR（+SP/UR） | 植物等级 1-5 |
| **稀有度标识** | 卡牌中央宝石颜色 | 扩展符号颜色 | 卡框配色 + 字样 | 边框样式 |
| **数值位置** | 攻击左下 / 生命右下 / 法力左上 | 力量/防御右下角标 | 底部属性条 | 阳光值底部/角标 |
| **名称栏** | 顶部拱形 | 顶部平直栏 | 顶部/底部条 | 底部条 |
| **传说级特殊** | 顶部龙形边框缠绕 | 秘稀标志 + 特殊纹饰 | SSR 金边 + 镭射 | 金/彩虹边框 |
| **金卡版本** | 全金边框 + 动画 | 无（有 promo 版） | 二级卡镭射+UV | 无 |

### 2.2 各家设计要点

#### 炉石传说（Hearthstone）
- **稀有度宝石**：卡牌**中央正下方**嵌入一颗宝石，颜色即稀有度（灰/蓝/紫/橙）。
- **传说级边框**：独特「龙形边框」从卡顶向两侧缠绕，是行业最强的稀有度视觉锚点。
- **数值布局（行业标杆）**：
  - 法力消耗（mana cost）：**左上角**蓝色水晶图标 + 数字
  - 攻击（attack）：**左下角**黄/橙色尖刺圆形 + 数字
  - 生命（health）：**右下角**红色血滴形 + 数字
- **金卡（Golden）**：全卡金色边框 + 立绘动画 + 粒子光效，是「高稀有」的进阶表达。

#### 万智牌（MTG）
- **从上到下严格分区**：名称栏 → 法力符号 → 立绘 → 类型行（含稀有度扩展符号）→ 规则文本框 → 力量/防御角标。
- **力量/防御（Power/Toughness）**：右下角「X/Y」组合角标，对应 ATK/HP。
- **边框颜色 = 魔法色**（白/蓝/黑/红/绿），与稀有度解耦；稀有度由扩展符号颜色表达。
- 设计最克制、信息密度最高，适合「卡牌详情/图鉴」页参考。

#### 阴阳师百闻牌
- **和风美术**：精致卡面 + 顶部/底部式神归属与卡牌类型标识。
- **稀有度 N/R/SR/SSR**：通过卡框配色 + 角标字样双重表达。
- **高稀有卡工艺**：二级卡加「镭射底纸 + 纹理 UV」，实体卡级别的高质感。
- **SP/UR 新档**：彩虹/特殊配色，限定卡池。东方体系「铜→银→金→铂→钻」或「白→蓝→紫→金」。

---

## 3. 稀有度配色规范

### 3.1 行业标准配色（源自 WoW，被炉石等广泛采用）

这是全球最通用的稀有度配色体系，玩家认知成本最低，**强烈建议本项目直接采用**。

| 稀有度档位 | 颜色 | 主色 Hex | 浅色/高光 | 深色/阴影 | 适用光效 |
|-----------|------|---------|----------|----------|---------|
| **普通 N**（Normal/Common） | 灰白 | `#9D9D9D` | `#C8C8C8` | `#6B6B6B` | 无 |
| **稀有 R**（Rare） | 蓝 | `#0070DD` | `#3DA5F5` | `#0050A0` | 内发光 |
| **史诗 SR**（Epic） | 紫 | `#A335EE` | `#C467FF` | `#7B2BC4` | 内发光 + 边缘光 |
| **传说 SSR**（Legendary） | 橙金 | `#FF8000` | `#FFB347` | `#CC5500` | 外发光 + 金粒子 |
| *（可选）神话 SP* | 金/彩虹 | `#E6CC80` | `#FFD700` | `#B8A05A` | 全卡光效 |

> WoW 原始档（完整梯度）：Poor `#9D9D9D`(灰) → Common `#FFFFFF`(白) → Uncommon `#1EFF00`(绿) → Rare `#0070DD`(蓝) → Epic `#A335EE`(紫) → Legendary `#FF8000`(橙) → Artifact `#E6CC80`(金)。

### 3.2 东方体系对照（阴阳师/抽卡向）

| 档位 | 配色 | Hex 建议 |
|------|------|---------|
| N | 白/银灰 | `#D4D4D4` |
| R | 蓝 | `#4A90E2` |
| SR | 紫 | `#9B59B6` |
| SSR | 金 | `#F1C40F` |
| SP/UR | 彩虹渐变 | `linear-gradient` |

### 3.3 推荐方案（本项目）

**采用 WoW 体系（灰/蓝/紫/橙）**，原因：
1. 玩家认知最广（炉石/PVZ2/Diablo/原神圣遗物均沿用）。
2. 色相跨度大（无彩色 → 冷色 → 暖色），层级一眼可辨。
3. 配色成熟，明度/饱和度平衡好，不易出现「辨识度低」问题。

本项目宠物卡建议设 4 档：**N / R / SR / SSR**，对应 `#9D9D9D / #0070DD / #A335EE / #FF8000`。

---

## 4. 图层叠加方案

### 4.1 核心原则：分层组合，不在生成图里写文字

> **关键决策**：角色立绘 AI 生成图 / 稀有度边框底图 **不含任何文字数值**。文字（名称、HP/ATK）一律用 **HTML/CSS 绝对定位**叠加。
>
> 原因：AI 生成图里的文字效果差、不可控、不可动态更新；HTML 文字清晰、可本地化、可响应数值变化。

### 4.2 三层（或四层）叠加架构

```
z-index 由低到高：
┌─────────────────────────────────────────────┐
│ Layer 1: 稀有度边框背景图（含数值空白区）      │  ← <img> 或 background-image
│         - PNG，带透明中央图区                  │
│         - 边框颜色/光效已烘焙进图              │
├─────────────────────────────────────────────┤
│ Layer 2: 角色立绘（透明 PNG）                  │  ← <img> 绝对定位居中
│         - 立绘 PNG，背景透明                   │
│         - 居中，略超框（破框效果可选）           │
├─────────────────────────────────────────────┤
│ Layer 3: 底纹/暗角（可选，增强文字可读性）      │  ← ::after 伪元素
│         - 名称栏位置半透明黑底渐变              │
├─────────────────────────────────────────────┤
│ Layer 4: HTML 文字数值（最顶层）               │  ← 绝对定位元素
│         - 名称（底部栏）                       │
│         - HP/ATK/DEF/SPD（四角或底部条）        │
│         - 等级/稀有度角标（左上）               │
└─────────────────────────────────────────────┘
```

### 4.3 卡牌分区建议

```
┌─────────────────────────┐
│ [Lv.12]      [SSR]      │  ← 顶部：等级角标(左) / 稀有度标签(右)
│                         │
│      ╭─────────╮        │
│      │ 角色立绘 │        │  ← 中央：图区 illustration（占 60-70%）
│      │  (透明)  │        │
│      ╰─────────╯        │
│                         │
│ [HP]              [ATK] │  ← 数值角标：HP左下 / ATK右下
│ 120               45    │     （炉石惯例）
│ [DEF]             [SPD] │  ← 或：DEF/SPD 放底部数值条
│ 30                60    │
├─────────────────────────┤
│     宠物名称             │  ← 底部：名称栏（半透明黑底白字）
└─────────────────────────┘
```

### 4.4 CSS 实现骨架

```css
.pet-card {
  position: relative;
  width: 240px;
  height: 320px;          /* 3:4 比例 */
  border-radius: 12px;
  overflow: hidden;
  /* Layer 1: 稀有度边框背景图 */
}

.pet-card__frame {
  position: absolute;
  inset: 0;
  z-index: 1;
  /* background-image: url('/assets/card-frame-ssr.png'); */
}

.pet-card__art {
  position: absolute;
  top: 12%;
  left: 50%;
  transform: translateX(-50%);
  width: 75%;
  z-index: 2;
  /* 角色立绘 PNG */
}

.pet-card__shade {
  position: absolute;
  inset: 0;
  z-index: 3;
  background: linear-gradient(
    to bottom,
    transparent 55%,
    rgba(0,0,0,0.65) 100%
  );                      /* 底部暗角，增强名称栏可读性 */
}

.pet-card__name {
  position: absolute;
  bottom: 8px;
  left: 0; right: 0;
  z-index: 4;
  text-align: center;
  color: #fff;
  font-weight: 700;
  text-shadow: 0 1px 3px rgba(0,0,0,.8);
}

.pet-card__stat {
  position: absolute;
  z-index: 4;
  /* 圆形角标 + 数字 */
  width: 40px; height: 40px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800;
  color: #fff;
}

.pet-card__stat--hp  { left: 6px;  bottom: 44px; background: #c0392b; } /* 红 */
.pet-card__stat--atk { right: 6px; bottom: 44px; background: #d35400; } /* 橙 */
.pet-card__stat--def { left: 6px;  bottom: 88px; background: #2c7be5; } /* 蓝 */
.pet-card__stat--spd { right: 6px; bottom: 88px; background: #27ae60; } /* 绿 */

/* 稀有度外发光 */
.pet-card.rarity-ssr {
  box-shadow: 0 0 16px rgba(255, 128, 0, 0.6);
}
.pet-card.rarity-sr {
  box-shadow: 0 0 12px rgba(163, 51, 238, 0.5);
}
```

### 4.5 稀有度边框背景图（AI 生成指引）

为每档稀有度生成 1 张边框底图（4 张），要求：
- **PNG + Alpha 透明**（中央图区、四角数值区必须透明）。
- **不含任何文字/数字**。
- 尺寸统一（如 480×640 @2x）。
- 边框颜色按 §3 配色：N 灰 / R 蓝 / SR 紫 / SSR 橙金。
- SSR 档可在边框加入「龙形缠绕」「金色花纹」等炉石传说式装饰。
- 中央留出 60-70% 透明区给立绘。

---

## 5. 战力数值布局建议

### 5.1 行业惯例（炉石标杆）

| 数值 | 位置 | 图标形状 | 颜色 |
|------|------|---------|------|
| 法力/资源消耗 | 左上 | 水晶圆 | 蓝 |
| 攻击 ATK | **左下** | 尖刺圆 | 橙/黄 |
| 生命 HP | **右下** | 血滴圆 | 红 |
| （MTG）力量/防御 | 右下 | 「X/Y」组合 | — |

### 5.2 本项目推荐布局

宠物有 4 项核心数值（HP/ATK/DEF/SPD），推荐两种方案：

**方案 A：四角布局（最直观，推荐）**
```
┌───────────────────┐
│ HP            SPD │   ← 上排：HP(左上) / SPD(右上)
│ 120            60 │
│      [立绘]        │
│ DEF            ATK│   ← 下排：DEF(左下) / ATK(右下)
│ 30             45 │
└───────────────────┘
```
- 优点：四角分散，不遮挡立绘；符合炉石「左下ATK/右下HP」直觉。
- HP/ATK 放下排靠玩家直觉（战斗最关注），DEF/SPD 放上排。

**方案 B：底部数值条（紧凑，信息密度高）**
```
┌───────────────────┐
│                   │
│     [立绘]         │
│                   │
├───────────────────┤
│ HP120 ATK45 DEF30 │  ← 底部一条横栏，MTG 风格
│  名称栏            │
└───────────────────┘
```
- 优点：数值集中，适合卡牌较小场景（如战斗中手牌）。
- 缺点：底部空间紧张，名称需再下移或叠加。

### 5.3 数值角标视觉规范

- **形状**：圆形（直径 36-44px @1x），或六边形（更游戏化）。
- **底色**：HP 红 `#C0392B` / ATK 橙 `#D35400` / DEF 蓝 `#2C7BE5` / SPD 绿 `#27AE60`。
- **数字**：白色粗体 `font-weight:800`，加 `text-shadow` 黑色描边。
- **缩略图标**：角标内可叠加微型心形/剑/盾/靴子图标（4-8px）。

---

## 6. 落地推荐方案

### 6.1 总体选型

| 决策点 | 选型 | 理由 |
|--------|------|------|
| 稀有度档数 | 4 档（N/R/SR/SSR） | 兼顾收集深度与认知成本 |
| 配色体系 | WoW 体系（灰/蓝/紫/橙） | 玩家认知最广 |
| 卡牌比例 | 竖卡 3:4 | 兼容立绘，移动端友好 |
| 数值布局 | 方案 A（四角） | 主战场景直观 |
| 文字方案 | HTML 叠加，不进生成图 | 清晰/可本地化/可动态 |
| 稀有度表达 | 边框底图色 + 外发光 + 角标 | 三重锚点 |

### 6.2 资源清单（需 AI 生成 / 设计产出）

1. **稀有度边框底图 ×4**：N/R/SR/SSR 各一张，PNG+Alpha，480×640，中央透明，无文字。
2. **数值角标图标 ×4**：HP/ATK/DEF/SPD 圆形底，SVG。
3. **稀有度徽章 ×4**：N/R/SR/SSR 字样徽章（可纯 CSS 文字 + 边框实现，免生成）。
4. 角色立绘：已有（galgame 角色 12 张）。

### 6.3 实现优先级

1. 先做 SSR 档（视觉最炸，验证方案）→ 2. 补全 N/R/SR 边框 → 3. 接入数值系统 → 4. 加金卡/动画（可选）。

---

## 7. 关键参考链接

### PVZ
- [Seed Packet — PvZ Wiki (wiki.gg)](https://plantsvszombies.wiki.gg/wiki/Seed_packet)
- [Seed Packet/Gallery — PvZ Wiki](https://plantsvszombies.wiki.gg/wiki/Seed_packet/Gallery)
- [Seed Slot — PvZ Wiki (Fandom)](https://plantsvszombies.fandom.com/wiki/Seed_slot)

### 炉石传说
- [Rarity — Hearthstone Wiki](https://hearthstone.fandom.com/wiki/Rarity)
- [Attribute — Hearthstone Wiki（ATK左下/HP右下）](https://hearthstone.wiki.gg/wiki/Attribute)
- [Golden Card — Hearthstone Wiki](https://hearthstone.fandom.com/wiki/Golden_card)
- [Shaders Case Study: Golden Cards (YouTube)](https://www.youtube.com/watch?v=OYjMnMZe1Vg)
- [Austin Curzon — Golden Card Animations](https://austincurzon.com/hearthstone-golden-card-animations)
- [Hearthstone Diamond Cards — PC Gamer](https://www.pcgamer.com/hearthstone-diamond-cards-announcement/)

### 万智牌 MTG
- [Anatomy of a Magic Card — 官方](https://magic.wizards.com/en/news/feature/anatomy-magic-card-2006-10-21)
- [Parts of a Card — MTG Wiki](https://mtg.fandom.com/wiki/Parts_of_a_card)
- [How to Read MTG Cards — CGC](https://www.cgccards.com/news/article/15229/how-to-read-mtg/)

### 稀有度配色
- [Quality — Warcraft Wiki（官方稀有度色）](https://warcraft.wiki.gg/wiki/Quality)
- [Item Rarity Color Palette — Color-Hex（含 hex）](https://www.color-hex.com/color-palette/38466)
- [Global Item Rarity Colors — Lospec（多格式下载）](https://lospec.com/palette-list/global-item-rarity-colors)
- [How Color Theory Codifies Item Quality — Medium](https://medium.com/@ClaireFish/how-color-theory-codifies-item-quality-in-video-games-104d811804)
- [Color-Coded Item Tiers — TV Tropes](https://tvtropes.org/pmwiki/pmwiki.php/Main/ColorCodedItemTiers)

### 阴阳师/中式卡牌
- [百闻牌卡牌类型解析 — 旅法师营地](https://www.iyingdi.com/tz/post/3087585)
- [阴阳师：百闻牌官网](http://ssr.163.com/)
- [百闻逸话收藏卡卡面设计与工艺 — 知乎](https://zhuanlan.zhihu.com/p/650785247)
- [式神稀有度入门详解 — 游民星空](https://shouyou.gamersky.com/gl/201610/821805.shtml)

### CSS 图层叠加
- [A guide to image overlays in CSS — LogRocket](https://blog.logrocket.com/css-overlay/)
- [How to overlay your background images — DEV Community](https://dev.to/selbekk/how-to-overlay-your-background-images-59le)
- [Semi-transparent color layer over background-image — StackOverflow](https://stackoverflow.com/questions/9182978/semi-transparent-color-layer-over-background-image)
