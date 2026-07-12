# 宠物小屋 (HomeSystem)

> 核心文件: [js/home.js](../../js/home.js) (963行)
> 家具数据: [data/furniture.json](../../data/furniture.json)
> 方案文档: [docs/方案/产品决策宠物小屋-方案.md](../../docs/方案/产品决策/宠物小屋-方案.md)

---

## 原理

### 设计目标
宠物小屋是宠物"住的地方"。孩子通过摆放家具装饰小屋、通过互动按钮照顾宠物（喂食/玩耍/休息/洗澡）。小屋的状态条直观反映宠物健康，倒下后的救援机制让孩子体验"照顾责任"。

### 核心模型

```
小屋状态 (homeState):
  slots: 5 槽位
    center_left  : floor 类型 → 默认 food_bowl
    center_right : floor 类型 → 默认 null
    corner_left  : corner 类型 → 默认 bath_tub
    corner_right : corner 类型 → 默认 null
    back         : backdrop 类型 → 默认 null
  theme: 背景主题 id（默认 cozy_night）
  unlockedThemes: 已解锁主题列表

家具系统:
  furniture: 已拥有家具 ID 列表（默认 ['food_bowl', 'bath_tub']）
  furnitureCatalog: 从 data/furniture.json 加载的家具目录
  家具匹配规则: slotType 必须匹配槽位类型（floor/corner/backdrop）

5 维状态条:
  HP (生命)    ← PetSystem.hp/max_hp
  饱食 (hunger) ← PetSystem.hunger (0-100)
  快乐 (happiness) ← PetSystem.happiness (0-100)
  亲密 (intimacy) ← PetSystem.intimacy (0-100)
  经验 (exp)    ← PetSystem.exp / EXP_TABLE

清洁度: 额外维度，角落图标显示（不进 5 维条）

Decay 结算:
  离开小屋时记录 last_home_ts
  下次进入时: hunger/happiness/cleanliness 按时间差衰减
  衰减到 0: 宠物"倒下"→ 显示救援 CTA
```

### 背景主题

```
8 个主题（cozy_night 默认解锁）:
  cozy_night, candy_cottage, dawn, forest_treehouse,
  garden_balcony, starry, underwater_aquarium, volcano_hearth

素材路径: assets/background/{theme}.webp
```

---

## 实现

### 关键函数

| 函数 | 行号 | 说明 |
|------|------|------|
| `HomeSystem.loadCatalog()` | :77 | 从 furniture.json 加载家具目录 |
| `HomeSystem.renderUI(containerId)` | :200 | 渲染宠物小屋完整视图 |
| `HomeSystem.handleAction(action)` | :400 | 处理互动按钮（feed/play/rest/bath） |
| `HomeSystem.placeFurniture(slotId, furnitureId)` | :500 | 摆放家具到槽位 |
| `HomeSystem.removeFurniture(slotId)` | :550 | 移除槽位家具 |
| `HomeSystem.buyFurniture(furnitureId)` | :600 | 购买家具 |
| `HomeSystem.changeTheme(themeId)` | :650 | 切换背景主题 |
| `HomeSystem.unlockTheme(themeId)` | :700 | 解锁新主题 |
| `HomeSystem.getHomeState()` | :750 | 获取当前小屋状态 |

### 持久化

```
key: petbank_home_state    → 家具摆放+主题 (home.js:122)
key: petbank_home_furniture → 已拥有家具列表 (home.js:125)
```

### 数据依赖

```
data/furniture.json → 家具目录（furniture[] 数组）
  每件家具: {id, name, slotType, price, emoji, ...}
```

### 宠物 API 依赖

```
PetSystem.feed(food, {homeContext:true})
PetSystem.play({homeContext:true})
PetSystem.rest({homeContext:true})
PetSystem.bath({homeContext:true})
PetSystem.decay(now)
PetSystem.markHomeExit()
PetSystem.revive()
PetSystem.getState()
```

---

## 注意事项

- 家具槽位类型（slotType）必须匹配才能摆放
- 默认解锁 cozy_night 主题，其余需购买
- 离开小屋时触发 markHomeExit()，下次进入计算 decay
- 宠物倒下（decay 导致 hp ≤ 0）后小屋显示特殊立绘 + 救援按钮
- 探索禁用 UI 守卫：宠物倒下时不能进入探索

## 旅行纪念物

探索完成后，旅行记忆会在小屋侧栏显示为独立收藏区。孩子点击“收入小屋”后才把对应冰箱贴加入家具库存；不会自动覆盖已有槽位。图片路径来自 `data/travel-rewards.json`，不可用时显示原场景 emoji。
