# 卡牌系统（收集+对战）

> 收集: [js/card-collection.js](../../js/card-collection.js) (1052行)
> 对战引擎: [js/card-arena.js](../../js/card-arena.js) (927行)
> 对战 UI: [js/card-arena-ui.js](../../js/card-arena-ui.js) (1477行)
> 战斗引擎: [js/battle-engine.js](../../js/battle-engine.js)
> 战斗特效: [js/battle-fx.js](../../js/battle-fx.js)
> 对战关卡: [data/arena-stages.json](../../data/arena-stages.json)

---

## 原理

### 设计目标
卡牌系统分两层：收集层（图册/分馆）给孩子收集动力和成就感；对战层（2v2 PvE）提供策略决策空间。两层独立但数据共享——收集到的卡牌才能编入对战队伍。

### 卡牌收集模型

```
系列 (Series) ──── 按来源分馆/图册
  ├── 阳光花园馆 (原版+PVZ+甜芽花园)
  ├── 奇趣冒险馆 (仓鼠大冒险+萌爪伙伴)
  ├── 创想课堂馆 (classpet 风格练习)
  └── 方块生态馆 (Minecraft 原版)

图册 (Booklet) ──── 按主题聚合多个系列
  收集满一本图册的所有卡牌 → 获得套票奖励 (REWARD_TICKETS_PER_SERIES=5)
```

### 卡牌对战模型

```
2v2 PvE 宝可梦式回合制

队伍: TEAM_SIZE=2（1上场+1替补）
技能: 4技能槽（attack/power_strike/defend/ultimate）；各技能独立 CD
稀有度限制: SSR(legendary) 每队≤1
规则:
  ├── 先手: spd高者先（平手Player先）
  ├── 伤害: calcDamage(useDef=true) 启用防御减伤
  ├── 防御态: 下回合受击减伤50%
  ├── 换人: 消耗回合，替补上场
  ├── 阵亡: 自动换下一只
  └── 胜负: 一方全灭或投降

事件日志 (log[]):
  { actor, side, action, dmg, targetHp, faint, switch }
```

### 竞技场关卡

```
data/arena-stages.json 定义关卡配置:
  ├── 关卡 id/name/desc
  ├── 敌方队伍（combatant × TEAM_SIZE）
  ├── 奖励（积分/掉落）
  └── 解锁条件
```

---

## 实现

### CardCollection (card-collection.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `CardCollection.init()` | :60 | 初始化：加载卡牌+图鉴文案 |
| `CardCollection.loadCards()` | :640 | 从 localStorage 加载已收集卡牌 |
| `CardCollection.addCard(speciesId)` | :670 | 添加一张卡牌到收集 |
| `CardCollection.hasCard(speciesId)` | :690 | 检查是否已收集 |
| `CardCollection.getAllCards()` | :700 | 返回所有收集状态 |
| `CardCollection.getSeriesStats()` | :720 | 按系列统计收集进度 |
| `CardCollection.renderUI(containerId)` | :800 | 渲染卡牌收集主页 |
| `CardCollection.renderGallery()` | :900 | 渲染分馆视图 |
| `CardCollection.renderBooklet()` | :950 | 渲染图册视图 |
| `CardCollection.checkSeriesReward()` | :680 | 检查套票奖励（集齐5张） |

### CardArena (card-arena.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `CardArena.selectTeam(petIds[])` | :120 | 从已收集卡牌选 2 只组队 |
| `CardArena.startBattle(enemyTeam)` | :200 | 初始化对战状态 |
| `CardArena.executeAction(action)` | :300 | 执行回合动作 |
| `CardArena.checkWinCondition()` | :400 | 判断胜负 |
| `CardArena.autoSwitch()` | :420 | 阵亡自动换人 |
| `CardArena.getState()` | :500 | 获取当前对战状态（供 UI 渲染） |
| `CardArena.getLog()` | :510 | 获取战斗日志 |

### CardArenaUI (card-arena-ui.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `CardArenaUI.openStages()` | :50 | 打开关卡选择界面 |
| `CardArenaUI.renderBattle()` | :200 | 渲染对战画面 |
| `CardArenaUI.renderTeamSelect()` | :100 | 渲染选队界面 |
| `CardArenaUI.handleAction(action)` | :400 | 处理玩家操作 |
| `CardArenaUI.showBattleLog()` | :600 | 显示战斗日志 |

### 持久化

```
key: petbank_cards → 已收集卡牌 ID 数组 (card-collection.js:658)
key: petbank_awarded_series → 已领取套票奖励的系列 (card-collection.js:685)
key: petbank_arena_points → 竞技场兼容积分账本 (card-arena-ui.js:1521)
```

---

## 注意事项

- 卡牌对战默认启用 def/spd（useDef=true），与探索战斗不同
- TEAM_SIZE 从 3v3 收缩为 2v2（降低认知负担）
- CardArena 是纯逻辑层，不碰 DOM；CardArenaUI 负责渲染
- BattleEngine 被探索和卡牌对战共享，通过 useDef 参数区分
- PvP 本地热座（pvpTeamA/pvpTeamB）是彩蛋功能，未正式启用

## 旅行记忆收藏

卡片图鉴顶部额外展示已完成探索的旅行卡。旅行卡只读展示地点、完成时间和下一站预告，不进入 `CardArena` 队伍，也不改变现有系列收集奖励、经验或战斗数值；卡底图加载失败时回退到旅行 emoji。
