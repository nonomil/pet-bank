# 宠物遛弯 (WalkSystem)

> 核心文件: [js/walk.js](../../js/walk.js) (458行)

---

## 原理

### 设计目标
宠物遛弯是脱离"刷题"场景的休闲互动。孩子选择路线、切换户外场景、看宠物气泡对话、结束后获得小奖励。目的是建立"陪伴感"而非"任务感"。

### 核心模型

```
5 条路线 (ROUTES):
  park   → 🌤️ 晨光花园 (清晨阳光步道, dawn背景)
  river  → 🌊 溪流步道 (瀑布溪谷, waterfall场景)
  mall   → 🌿 林间草坡 (森林草坡, forest场景)
  school → 🌼 花园阳台 (露台花园, garden_balcony背景)
  (第5条动态)

每路线包含:
  sceneImage    → 场景图 URL
  sceneGradient → 背景渐变 CSS
  bubbleLines   → 宠物气泡对话（3句随机）
  scenePrompt   → AI生图提示词（给GPT生图管线用）
```

---

## 实现

### 关键函数

| 函数 | 行号 | 说明 |
|------|------|------|
| `WalkSystem.renderWalkPage()` | :80 | 渲染遛弯主页面 |
| `WalkSystem.selectRoute(routeId)` | :150 | 选择遛弯路线 |
| `WalkSystem.startWalk()` | :200 | 开始遛弯（场景切换+气泡轮播） |
| `WalkSystem.showBubble()` | :250 | 显示宠物气泡 |
| `WalkSystem.endWalk()` | :300 | 结束遛弯（结算+日志） |
| `WalkSystem.getWalkLogs()` | :117 | 获取遛弯日志 |
| `WalkSystem.getWalkData()` | :90 | 获取遛弯数据（步数/距离/次数） |

### 持久化

```
key: petbank_walk_data → 遛弯数据 (walk.js:103) → 也被 app.js:1504 读取
key: petbank_walk_logs → 遛弯日志数组 (walk.js:113)
```

---

## 注意事项

- petbank_walk_data 被 walk.js 和 app.js 共享读写
- 气泡内容是硬编码的中文文案，每路线 3 句
- scenePrompt 字段是为 GPT 生图管线预留的，运行时只读取不调用
- 遛弯日志只保留最近记录（无上限清理逻辑）
