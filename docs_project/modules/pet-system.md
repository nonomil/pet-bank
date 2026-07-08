# 宠物养成系统 (PetSystem)

> 核心文件: [js/pet.js](../../js/pet.js) (614行)
> 数据文件: [data/pets.json](../../data/pets.json) (261物种)
> 技能文件: [data/skills.json](../../data/skills.json)

---

## 原理

### 设计目标
宠物是孩子在学习世界中的"化身"。宠物成长绑定孩子的任务完成和探索进度，强化"我照顾它→它陪伴我→我们一起变强"的情感回路。

### 核心模型

```
物种 (Species)  ──── 261种，6个来源合并
  ├── id, name, emoji, desc
  ├── base_hp, base_atk, base_def, base_spd
  ├── rarity: common | rare | epic | legendary
  ├── imageStages: {0..5} → 6阶段图片
  └── source: original | banchong | classpet | minecraft | banchong2 | banchong2_plant

宠物实例 (State)
  ├── species, level, exp
  ├── hp, max_hp, atk, def, spd
  ├── hunger (饱食度), happiness (快乐度), intimacy (亲密度), cleanliness (清洁度)
  ├── wins, explorations, days_cared
  ├── weapon, armor
  ├── skills[] (已开放技能id)
  └── defending, last_home_ts (decay结算基准)

阶段 (Stage)  ──── 5阶段进化
  蛋(Lv1) → 幼崽(Lv3) → 成长期(Lv5) → 完全体(Lv8) → 终极体(Lv15)

经验表 (EXP_TABLE): [0,30,80,150,250,400,600,850,1200,1600,2100,2700,3400,4200,5100]
最高等级 (MAX_LEVEL): 15
```

### Decay 机制（宠物小屋 §5.3）
离开宠物小屋后（`markHomeExit()`），饥饿度/快乐度/清洁度随时间衰减。下次进入小屋时由 `decay()` 结算。

---

## 实现

### 公共 API

| 函数 | 文件:行号 | 说明 |
|------|----------|------|
| **数据库/技能加载** | | |
| `PetSystem.loadPetDB()` | pet.js:535 | 从 data/pets.json 加载 261 物种数据库（含去重+Promise缓存） |
| `PetSystem.loadSkills()` | pet.js:351 | 从 data/skills.json 加载技能定义表 |
| `PetSystem.isDBLoaded()` | pet.js:592 | 数据库是否已加载完成 |
| **物种查询** | | |
| `PetSystem.getAllSpecies()` | pet.js:561 | 返回所有物种数组（261条，含 imageStages 标准化后） |
| `PetSystem.getAllSpeciesBySeries()` | pet.js:566 | 按系列分组 { seriesName: [species...] } |
| `PetSystem.getSpeciesByRarity(rarity)` | pet.js:577 | 按稀有度过滤 'common'\|'rare'\|'epic'\|'legendary' |
| `PetSystem.getAllSeries()` | pet.js:587 | 获取所有系列元数据对象 |
| `PetSystem.getRarityConfig()` | pet.js:582 | 返回 RARITY 配置（name/color/icon） |
| **状态管理** | | |
| `PetSystem.load()` | pet.js:89 | 从 localStorage 加载宠物状态（含旧档兼容 def/spd 回填） |
| `PetSystem.save()` | pet.js:109 | 持久化宠物状态到 localStorage (key: petbank_pet) |
| `PetSystem.getState()` | pet.js:471 | 获取当前宠物完整状态对象 |
| `PetSystem.chooseSpecies(id)` | pet.js:114 | 选择物种（重置全部属性到 Lv1） |
| **等级/经验** | | |
| `PetSystem.addExp(amount)` | pet.js:180 | 增加经验，达到阈值自动升级（返回升级信息） |
| `PetSystem.MAX_LEVEL` | pet.js:15 | 等级上限常量 = 15 |
| `PetSystem.EXP_TABLE` | pet.js:28 | 经验表常量 = [0,30,80,...5100] |
| **HP/战斗** | | |
| `PetSystem.takeDamage(amount, options)` | pet.js:202 | 受到伤害（支持防御减伤） |
| `PetSystem.heal(amount)` | pet.js:214 | 恢复 HP |
| `PetSystem.revive(hpPercent)` | pet.js:275 | 复活（按百分比恢复 HP，默认 50%） |
| `PetSystem.getTotalAtk()` | — | 计算总攻击力（基础+武器） |
| `PetSystem.getTotalMaxHp()` | — | 计算总最大 HP |
| `PetSystem.getTotalDef()` | — | 计算总防御力 |
| `PetSystem.getTotalSpd()` | — | 计算总速度 |
| **宠物照料** | | |
| `PetSystem.feed(foodItem, options)` | pet.js:222 | 喂食（支持 homeContext 模式，提升饱食度+亲密度） |
| `PetSystem.play()` | pet.js:252 | 玩耍（提升快乐度） |
| `PetSystem.rest()` | pet.js:265 | 休息（恢复少量 HP+快乐度） |
| `PetSystem.bath(options)` | pet.js:283 | 洗澡（提升清洁度） |
| **小屋/时间** | | |
| `PetSystem.decay()` | pet.js:295 | 衰减结算（按 last_home_ts 计算饥饿/快乐/清洁度衰减） |
| `PetSystem.markHomeExit()` | pet.js:321 | 标记离开小屋时间戳（写 last_home_ts） |
| **阶段** | | |
| `PetSystem.getCurrentStage()` | pet.js:142 | 按当前等级返回阶段信息 {name,emoji,stageIdx} |
| `PetSystem.getStageEmoji()` | — | 返回当前阶段 emoji |
| `PetSystem.getEvolutionStageIndex()` | pet.js:153 | 返回当前进化阶段索引（映射 imageStages） |
| `PetSystem.getCurrentStageImage()` | — | 返回当前阶段对应图片 URL |
| `PetSystem.STAGES` | pet.js:19 | 阶段配置常量 |
| **装备** | | |
| `PetSystem.equip(item)` | — | 装备武器/护甲 |
| `PetSystem.unequip(slot)` | — | 卸下装备 |
| **统计** | | |
| `PetSystem.addExploration()` | pet.js:458 | 探索次数 +1 |
| `PetSystem.addWin()` | — | 战斗胜利数 +1 |
| **战斗深化（技能CD）** | | |
| `PetSystem.getSkillsData()` | pet.js:367 | 获取技能定义表 |
| `PetSystem.getSkill(skillId)` | pet.js:372 | 获取单个技能定义 |
| `PetSystem.getSkills()` | pet.js:377 | 获取当前已开放技能列表 |
| `PetSystem.getCooldown(skillId)` | — | 获取技能 CD |
| `PetSystem.startCooldown(skillId)` | — | 设置技能 CD |
| `PetSystem.tickCooldowns()` | — | 所有 CD -1（每回合调用） |
| `PetSystem.canUseSkill(skillId)` | — | 检查技能是否可用（已开放+CD=0） |
| `PetSystem.resetBattleState()` | — | 重置战斗状态（CD清零+取消防御） |
| `PetSystem.setDefending(v)` | — | 设置防御态 |
| `PetSystem.isDefending()` | — | 检查是否防御态 |

---

## 数据文件

| 文件 | 说明 |
|------|------|
| [data/pets.json](../../data/pets.json) | 261 物种，version 2.0，6 来源 |
| [data/skills.json](../../data/skills.json) | 技能定义（power_strike, defend, ultimate 等） |

## 持久化

```
key: petbank_pet
格式: JSON (完整 state 对象，不含 cooldowns 运行态)
写入: PetSystem.save() → pet.js:110
读取: PetSystem.load() → pet.js:89→ PetSystem.getState() 返回运行中 state 引用
```

---

## 物种来源

| source | 数量 | 说明 |
|--------|------|------|
| original | 8 | pet-bank 原生 PVZ 风格（豌豆射手/向日葵/坚果墙等） |
| banchong | 91 | 仓鼠大冒险（灵兽族/星瞳族/绮梦族/萌肖族等 12 系列） |
| classpet | 40 | classpet-pro1.0（萌宠/幻想/像素/科幻/国潮 5 风格） |
| minecraft | ~59 | Minecraft 原版生物 |
| banchong2 | 40 | 班宠乐园2 动物（萌爪伙伴族） |
| banchong2_plant | 23 | 班宠乐园2 植物（甜芽花园族） |
| **合计** | **261** | |

---

## 注意事项

- SPECIES_FALLBACK（pet.js:41-50）是数据库加载失败时的兜底 8 种 PVZ 宠物
- `loadPetDB()` 有 Promise 缓存（PET_DB_LOAD_PROMISE），多次调用不会重复 fetch
- `load()` 含旧档兼容逻辑：def/spd 缺失时从 SPECIES 回填（pet.js:99-105）
- EXP_TABLE 长度 15（对应 MAX_LEVEL），无 Lv16+ 定义
- decay 依赖 `last_home_ts`（unix秒），首次进入小屋时该字段为 null，decay 跳过
- 技能通过 `state.skills` 数组控制开放，初始 3 技能（power_strike, defend, ultimate）
- cooldowns 不持久化，每场战斗在 `resetBattleState()` 时清零
