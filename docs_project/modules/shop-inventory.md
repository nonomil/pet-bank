# 积分商城 + 道具背包

> 商城: [js/shop.js](../../js/shop.js) (529行)
> 背包: [js/inventory.js](../../js/inventory.js) (~80行)
> 宝箱: [js/treasure.js](../../js/treasure.js) (~200行)
> 物品数据: [data/items.json](../../data/items.json), [data/point-items.json](../../data/point-items.json)

---

## 原理

### 设计目标
积分是孩子"努力可视化"的载体。商城提供积分消费出口（兑换奖励+盲盒+战斗道具），背包管理已购物品。宝箱是惊喜激励（日常/探索/里程碑）。核心约束：积分不能直接替代学习，道具不能替孩子答题。

### 商城模型

```
兑换物品 (ITEMS): 8 种生活奖励
  🍕 选晚餐(30分)  📺 多看动画(20分)  🍰 周末甜点(40分)  🎮 游戏30分钟(50分)
  🧹 免家务(25分)  📚 新书(35分)      🎨 手工材料(45分)  🌳 户外探险(60分)

盲盒 (BLIND_BOXES):
  🎁 普通盲盒(20分): 50%返利5-15分 + 50%随机道具
  🎊 豪华盲盒(50分): 30%返利20-40分 + 40%稀有道具 + 30%经验加成

战斗道具 (BATTLE_ITEMS): 5 种
  🧪 回血药(15分)  ⚔️ 攻击药(25分)  🛡️ 防御药(25分)  💣 炸弹(30分)  🌟 复活符(40分)

自定义兑换 (Custom Items):
  家长可添加自定义积分兑换项，存 petbank_custom_items
```

### 道具背包模型

```
InventorySystem:
  物品堆叠: [{item_id, count}]
  最大堆叠: stack_max (默认99)
  装备栏: weapon / armor 槽
```

### 宝箱模型

```
3 类宝箱:
  daily:    日常宝箱（每日完成≥1任务可领）
  explore:  探索宝箱（探索场景掉落）
  milestone: 里程碑宝箱（宠物达到特定等级/战斗数/探索数）
```

---

## 实现

### ShopSystem (shop.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `ShopSystem.renderUI(containerId)` | :80 | 渲染商城界面 |
| `ShopSystem.buyItem(itemId)` | :150 | 购买物品（扣积分） |
| `ShopSystem.openBlindBox(boxId)` | :200 | 开盲盒 |
| `ShopSystem.addCustomItem(name, price, emoji)` | :250 | 添加自定义兑换项 |
| `ShopSystem.getHistory()` | :84 | 获取购买历史 |

### InventorySystem (inventory.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `InventorySystem.loadItemsData()` | :11 | 加载 items.json 物品定义 |
| `InventorySystem.load()` | :24 | 从 localStorage 加载背包 |
| `InventorySystem.addItem(itemId, count)` | :42 | 添加物品（含堆叠逻辑） |
| `InventorySystem.removeItem(itemId, count)` | :60 | 移除物品 |
| `InventorySystem.hasItem(itemId)` | :80 | 检查是否拥有 |
| `InventorySystem.getCount(itemId)` | :90 | 获取持有数量 |

### TreasureChest (treasure.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `TreasureChest.canOpenDaily()` | :41 | 检查日常宝箱是否可领 |
| `TreasureChest.openDaily()` | :60 | 开启日常宝箱 |
| `TreasureChest.openExplore()` | :80 | 开启探索宝箱 |
| `TreasureChest.checkMilestones()` | :49 | 检查里程碑触发 |
| `TreasureChest.openMilestone(level)` | :100 | 开启里程碑宝箱 |

### 持久化

```
key: petbank_inventory   → 背包物品 (inventory.js:38)
key: petbank_chests      → 宝箱库存 (treasure.js:17)
key: petbank_daily_claim_date → 日常宝箱领取日 (treasure.js:112)
key: petbank_claimed_milestones → 已领取里程碑 (treasure.js:64)
key: petbank_custom_items → 自定义兑换项 (app.js:495,588)
```

---

## 注意事项

- 购买历史只保留最近 50 条 (shop.js:116)
- 战斗道具 toInventory:true 的会进背包而不是直接使用
- 盲盒概率在代码中硬编码，非配置化
- 自定义兑换项在积分页（today）的兑换区展示
