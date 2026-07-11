# 探索冒险系统 (ExplorationSystem)

> 核心文件: [js/exploration.js](../../js/exploration.js) (686行)
> 详情文件: [js/exploration-detail.js](../../js/exploration-detail.js) (381行)
> 战斗引擎: [js/battle-engine.js](../../js/battle-engine.js)
> 战斗特效: [js/battle-fx.js](../../js/battle-fx.js)
> 场景数据: [data/scenes.json](../../data/scenes.json)
> 叙事文件: [data/stories/](../../data/stories/) (12 个场景 JSON)

---

## 原理

### 设计目标
探索地图是孩子进入学习世界的"冒险入口"。12 个场景按等级由外向内螺旋排列，从 Lv1 的外圈逐步推进到 Lv5 的中心终点。每个场景包含叙事对话、探索事件和战斗遭遇，孩子需要先阅读理解再选择行动，把"阅读→判断→行动"融入冒险体验。

### 核心模型

```
地图布局 (MAP_LAYOUT)
  12 场景按 min_level 分 5 圈层，由外向内螺旋推进

  Lv1 (外层起点): forest ── 起点花园
  Lv2 (外层弧线): beach → candy → waterfall ── 森林边界
  Lv3 (中层右→底): desert → cave → mountain ── 海边集市→高地洞窟
  Lv4 (内层底→左): castle → underwater ── 高地洞窟→海边集市
  Lv5 (中心): volcano → space → stargarden ── 星空终点

  每场景节点:
    id, x, y, size, chapter, min_level, ring

章节主题 (CHAPTER_THEME):
  1: 起点花园 (#7ee68a)   2: 森林边界 (#5ec8a0)   3: 海边集市 (#5ab8d4)
  4: 高地洞窟 (#c89060)   5: 星空终点 (#a888d4)

圈层引导环 (RING_GUIDES):
  4 个椭圆弧，visual-only 装饰线，不参与交互
```

### 战斗模型

```
探索战斗 (1v1 PvE)
  ├── 回合制：玩家普攻/技能 (cd=0/2/3/5)
  ├── 怪物自动普攻
  ├── 防御态：下回合受击减伤 50%
  ├── 战斗日志：actor/side/action/dmg/targetHp/faint 事件数组
  └── 失败：HP 扣 10%，不死亡，给复活动作

技能定义 (skillDefs):
  attack       : 普攻 (mult=1, cd=0)
  power_strike : 强力击 (mult=1.8, cd=2)
  defend       : 防御 (mult=0, cd=3)
  ultimate     : 必杀 (mult=3, cd=5)

伤害公式 (battle-engine.js:26-29):
  普攻: max(1, atk + rand(0..2) - 1)
  技能: max(1, floor(atk * mult) + rand(0..2))
  反击: max(1, atk + rand(0..1) - 1)
  防御启用时: max(1, atk - floor(def/2)) + ...
```

### 叙事系统

```
每个场景对应一个 stories/{sceneId}.json:
  ├── chapters[] → 该场景的章节对话
  ├── enemies[] → 该场景可能遇到的敌人
  └── events[]  → 特殊事件，含 math_question 等探索小题

叙事文件:
  forest.json, beach.json, candy.json, waterfall.json,
  desert.json, cave.json, mountain.json, castle.json,
  underwater.json, volcano.json, space.json, stargarden.json
```

#### 短旅行章节

12 个场景均声明 `chapter_flow.mode = "short"`，默认主路径为：

```text
看见（旁白 + 发现） → 选择（一次路线选择） → 带回家（旅行纪念物）
```

每个场景的数学题和遭遇战仍保留在原事件数组，但只有孩子点击“挑战一下”时才进入；挑战路径继续复用现有数学题、探索战斗、经验和掉落规则。旅行记忆目录覆盖 12 个场景，其中 3 个使用已验证 Agnes 图片，9 个使用 placeholder 状态和 emoji/CSS 回退；所有场景都有可收入小屋的装饰 ID。

短流程状态由 `js/exploration-progress.js` 写入同一场景进度键的附加字段（`flowMode`、`flowPhase`、`challengeStatus`），刷新从根入口恢复；直接访问静态服务器的 `/app/explore` 仍会 404，真实验收必须从 `/` 进入。

---

## 实现

### ExplorationSystem 关键函数

| 函数 | 文件:行号 | 说明 |
|------|----------|------|
| `MAP_LAYOUT` | exploration.js:20 | 12 场景坐标和等级配置 |
| `RING_GUIDES` | exploration.js:47 | 4 圈层引导弧 |
| `CHAPTER_THEME` | exploration.js:54 | 5 章主题颜色 |
| `ExplorationSystem.loadScenes()` | exploration.js:98 | 从 scenes.json 加载场景数据，并恢复解锁状态 |
| `ExplorationSystem.renderSceneGridMap(activeSceneId, boardId)` | exploration.js:287 | 渲染探索地图节点、路线和圈层 |
| `ExplorationSystem.tryUnlock(sceneId, boardId)` | exploration.js:340 | 尝试解锁场景，成功后扣积分并刷新地图 |
| `ExplorationSystem.startExploration(sceneId)` | exploration.js:404 | 开始某场景探索，读取叙事/事件/战斗 |
| `ExplorationSystem.startBattle(scene, monster)` | exploration.js:469 | 触发探索战斗，创建当前 battle 状态 |
| `buildBattleGuidedFeedback(battle, cause)` | exploration.js:492 | 按失败原因生成探索战斗复盘/下一步建议 |
| `markBattleLost(battle, cause)` | exploration.js:506 | 统一标记探索战斗失败并写入 `battle.guidedFeedback` |
| `ExplorationSystem.battleTurn(action)` | exploration.js:517 | 执行一回合（普攻/技能/防御） |
| `ExplorationSystem.getUnlockedCount()` | exploration.js:146 | 统计已解锁场景数量 |
| `ExplorationSystem.isSceneUnlocked(scene)` | exploration.js:139 | 判断场景是否已解锁 |
| `ExplorationSystem.unlockScene(sceneId)` | exploration.js:316 | 写入已解锁场景 |

### 探索战斗失败反馈

- `markBattleLost()` 在逃跑失败或敌人反击导致 HP 归零时写入 `battle.guidedFeedback`。
- `battle.guidedFeedback` 包含 `note` 和 `nextStep`，当前用于战斗结算区，后续也可供成长报告读取。
- [js/app.js](../../js/app.js) 的 `renderBattleResultGuide()`（app.js:2600）负责渲染"复盘/下一步"，`renderBattleEndActions()`（app.js:2613）统一普通攻击与道具路径的结算按钮区。
- 样式在 [css/style.css](../../css/style.css) 的 `.battle-result-guide`（style.css:3862）维护。
- 对应验证：`node prj/exploration_battle_guided_feedback.test.mjs`。

### ExplorationDetail 关键函数

| 函数 | 文件:行号 | 说明 |
|------|----------|------|
| `ExplorationDetail.show(sceneId)` | exploration-detail.js:74 | 打开 galgame 探索详情并加载场景故事 |
| `buildMathRetryHint(hint, explanation)` | exploration-detail.js:199 | 将题目 hint/explanation 转成"下一步/复盘"提示 |
| `ExplorationDetail.answerMath(correct, exp, msg, hint, explanation)` | exploration-detail.js:205 | 处理探索数学小题答题反馈和奖励 |
| `ExplorationDetail.choose(eventIdx, choiceIdx)` | exploration-detail.js:288 | 处理探索事件选项 |
| `ExplorationDetail.next()` | exploration-detail.js | 推进 legacy 事件或 short flow |
| `ExplorationDetail.completeShortJourney()` | exploration-detail.js | 跳过可选挑战并完成短旅行 |
| `ExplorationDetail.startShortChallenge()` | exploration-detail.js | 从短旅行进入数学挑战 |
| `ExplorationDetail.startShortBattle()` | exploration-detail.js | 从短旅行进入遭遇战 |
| `ExplorationDetail.exit()` | exploration-detail.js | 退出详情页并恢复地图 |
| `ExplorationDetail.showEnding()` | exploration-detail.js | 展示场景探索结束语 |

### 探索数学题反馈

- `ExplorationDetail.answerMath()` 答错时不使用惩罚性文案，固定先提示"这次还差一点，先换个观察顺序。"
- `buildMathRetryHint(hint, explanation)` 优先展示题目 `hint`，否则展示 `explanation`，两者都没有时给默认策略："先把题目里的数量圈出来，再决定用加法、减法还是乘法。"
- 若题目同时提供 `hint` 和 `explanation`，答错反馈会同时展示"下一步"和"复盘"。
- 对应验证：`node prj/exploration_math_feedback.test.mjs`。

### BattleEngine (battle-engine.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `BattleEngine.calcDamage(atk, def, opts)` | :26-29 | 伤害计算（纯函数） |
| `BattleEngine.decideOrder(spdA, spdB)` | :36-40 | 先手判定 |
| `BattleEngine.makeCombatant(o)` | :46+ | combatant 工厂函数 |
| `BattleEngine.runTurn(attacker, defender, skill, opts)` | :70+ | 执行一回合 |

### BattleFx (battle-fx.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `SKILL_EFFECTS` | :13-36 | 技能→特效映射（CSS/SVG + Lottie fallback） |
| `EVENT_EFFECTS` | :38+ | 事件→特效映射（战斗开始/胜利/失败等） |

### 持久化

```
key: petbank_unlocked_scenes → 已解锁场景 (exploration.js:113, 写入 exploration.js:120)
key: petbank_points          → 积分（解锁消耗扣减）(exploration.js:331)
```

---

## 注意事项

- 探索战斗默认不启用 def/spd（useDef=false），与卡牌对战不同。
- 场景解锁消耗积分，在 exploration.js:331 扣除。
- BLANK_CELLS 仅作路线装饰点，不可点击。
- 螺旋布局方案经过 3 版迭代（S0→S1→S2），当前 min_level 决定圈层而非 chapter。
- 探索小题、探索战斗失败和数学 PK 结算反馈属于同一轮"引导式反馈闭环"，但实现位置分离。

## 旅行纪念资产

三条样板路线（森林、海滩、星光花园）在 `data/travel-rewards.json` 声明徽章、旅行卡底图、冰箱贴和宠物旅行卡框。图片来源、版本和逐类状态由 `assetSource`、`assetVersion`、`assetStatuses` 记录；网页文字仍由 DOM 渲染，图片加载失败回退到场景 emoji。原始图、提示词、像素验收和 manifest 位于 `assets/generated/travel-memory/`。
