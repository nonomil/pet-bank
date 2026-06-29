# 战斗深化设计稿（技能面板 + 道具快捷栏）

> **ID**：`DESIGN-2026-06-29-02`
> **状态**：边界待确认，确认后转实施
> **目标**：给当前"只有 attack/flee"的半自动战斗，加上**技能选择**和**可视化道具快捷栏**，提升战术深度，但不过度设计（不引入 MP/技能树/buff 系统）。

---

## 1. 背景（探索结论）
- 战斗半自动回合制：`exploration.js:303 battleTurn(action)` 只有 `attack`/`flee`
- **技能系统完全不存在**（无数据/UI/冷却）
- 战斗道具：`app.js:1010 useItemInBattle()` 用 `prompt()` 输入编号，体验差，且**不消耗回合**（免费动作，无战术成本）
- 装备系统完善（weapon/armor/equip，`pet.js:299 getTotalAtk`）
- 战斗 UI：`app.js:896 showBattleModal` 弹窗（HP 条 + 3 按钮：攻击/逃跑/道具）

## 2. 边界（参考商店家具联动"不过度设计"原则）

### 做
- **3 个通用技能**（不按物种，避免数据爆炸）：强力击 / 防御 / 必杀
- 技能冷却（CD 回合数），战斗内 CD tracking
- **可视化道具快捷栏**（替代 prompt）：显示战斗消耗品图标 + 数量，点击使用
- **用道具消耗 1 回合**（修复"免费动作"漏洞）

### 不做（避免过度）
- ❌ MP/蓝量系统（技能用 CD 限制，不引入蓝量）
- ❌ buff/debuff 系统（防御只做"下回合减伤"，不建 buff 框架）
- ❌ 技能树 / 技能升级 / 技能学习
- ❌ AOE / 多目标 / 元素克制
- ❌ 物种专属技能（先通用，后续可扩）
- ❌ 战斗动画特效大改（复用现有 shake/flash）

## 3. 技能清单（3 个通用）

| 技能 id | 名称 | 效果 | 冷却 | 伤害公式 |
|---|---|---|---|---|
| `power_strike` | 强力击 | 1.8× 普攻伤害 | 2 回合 | `floor(getTotalAtk() * 1.8) + random(0,2)` |
| `defend` | 防御 | 下回合受击减伤 50% | 3 回合 | 0（防御态：`state.defending=true`，下回合伤害×0.5） |
| `ultimate` | 必杀 | 3× 普攻伤害 | 5 回合 | `floor(getTotalAtk() * 3) + random(0,3)` |

数据：`data/skills.json`（id/name/icon/desc/damage multiplier/cooldown/type）

## 4. 道具快捷栏

- **4 槽快捷栏**（战斗 UI 底部），显示战斗消耗品（type=consumable 且 battle-usable）
- 每槽：图标 + 名称 + 数量（`InventorySystem.getCount(id)`）
- 点击 → `useItemInBattle(id)` → 使用 + **消耗 1 回合**（调用 battleTurn 复算敌人反击）
- 默认槽：potion_small / potion_large / pet_food_basic / revive_potion（玩家拥有的才显示）
- 空槽/数量 0：灰显

## 5. 数据模型

### data/skills.json（新建）
```json
{
  "version": "1.0",
  "skills": [
    { "id": "power_strike", "name": "强力击", "icon": "💥", "desc": "1.8倍伤害", "multiplier": 1.8, "cooldown": 2, "type": "attack" },
    { "id": "defend", "name": "防御", "icon": "🛡️", "desc": "下回合减伤50%", "multiplier": 0, "cooldown": 3, "type": "defend" },
    { "id": "ultimate", "name": "必杀", "icon": "⚡", "desc": "3倍伤害", "multiplier": 3, "cooldown": 5, "type": "attack" }
  ]
}
```

### pet.js state 扩展
- `skills`: 可用技能 id 数组（默认 3 个全开放，或按等级解锁——本期全开放）
- `cooldowns`: `{ skillId: 剩余回合 }`（战斗内，不持久化，每场战斗重置）
- `defending`: bool（防御态，下回合减伤）

### combat.json 对齐
- `flee_chance` 配置 0.3 vs 代码 0.5 → 统一（用配置值）

## 6. 接入点（精确文件:行号）

| 改动 | 文件:行号 | 说明 |
|---|---|---|
| 技能数据 | 新建 `data/skills.json` | 3 技能定义 |
| state 扩展 | `js/pet.js:56-74` | 加 skills/cooldowns/defending |
| 回合逻辑 | `js/exploration.js:303-375 battleTurn` | 加 `skill`/`item` 分支，CD 递减，防御减伤 |
| 战斗 UI | `js/app.js:896-925 showBattleModal` | 加技能按钮面板 + 道具快捷栏（替代 prompt） |
| 道具使用 | `js/app.js:1010 useItemInBattle` | 改为接收 id 参数 + 消耗回合 |
| 减伤 | `js/exploration.js:366` 敌人攻击 | 检查 defending，减伤 50% |

## 7. 验收标准
1. 战斗 UI 有 3 技能按钮（强力击/防御/必杀）+ 4 槽道具快捷栏
2. 技能按 CD 限制（CD 中禁用，显示剩余回合）
3. 强力击/必杀伤害正确（1.8x/3x atk）
4. 防御：下回合敌人攻击减伤 50%
5. 道具快捷栏显示拥有数量，点击使用 + 消耗 1 回合
6. 道具栏空/0 灰显
7. 逃跑概率与 combat.json 对齐
8. 不引入 MP/buff/技能树

## 8. 明确不做
MP / 蓝量 / buff-debuff 框架 / 技能树 / 物种技能 / AOE / 元素克制 / 战斗动画大改

## 9. 风险
- 防御态（defending）需在敌人攻击时检查 + 用后清除，时序要准
- CD tracking 每场战斗重置（不持久化），刷新战斗 CD 清零
- 道具消耗回合后，玩家不能再行动（敌人反击），需 UI 锁定
