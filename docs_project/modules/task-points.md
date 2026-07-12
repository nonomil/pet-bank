# 任务积分系统

> 核心文件: [js/app.js](../../js/app.js) (4411行，其中任务积分部分约 500 行；行号按 2026-07-12 基线)

---

## 原理

### 设计目标
将日常任务拆成 6 个维度，每完成一个任务获得积分。积分是孩子"努力可视化"的载体，形成"努力→收获→投入→再努力"的正循环。

### 核心模型

```
维度 (DIMENSIONS)  ──── 6个维度，常规维度各 6 个任务，petcare 7 个任务（共 37 个）
  ├── learning (学习力)    : 阅读/练字/背诵/听写/数学/日记
  ├── sports (运动力)      : 运动/跳绳/跑步/球类/骑行/晨练
  ├── selfcontrol (自控力) : 屏幕时间/整理书桌/计划/按时起床/独立作业/洗漱
  ├── exploration (探索力) : 观察植物/做新菜/读新书/记录好奇/画地图/探索路线
  ├── practice (实践力)    : 家务/整理房间/浇花/垃圾分类/洗衣/做菜
  └── petcare (守护力)     : 喂食/清理/陪伴/检查/遛宠物/记录日记  ← 第6维度

首页优先任务 (HOME_PRIORITY_TASKS) ──── 3 个推荐
  阅读 20 分钟 / 运动 30 分钟 / 屏幕时间不超 2 小时

积分任务配图 (POINT_TASK_ART) ──── 10 种 kidstar 插图
```

---

## 实现

### 关键函数

| 函数 | 文件:行号 | 说明 |
|------|----------|------|
| `DIMENSIONS` | app.js:39-107 | **6 维度** 37 任务定义（常量） |
| `HOME_PRIORITY_TASKS` | app.js:109-113 | 首页 3 个优先任务 |
| `POINT_TASK_ART` | app.js:115-126 | 积分任务配图 URL 映射 |
| `getPointTaskArt(task)` | app.js:128-140 | 按任务文本正则匹配配图 |
| `toggleTask(dim, taskName, pts)` | app.js:412 | 勾选/取消任务，增减积分 |
| `renderTaskGrid()` | app.js:437 | 渲染全部 37 个任务卡片 |
| `renderGrowthStickerReport()` | app.js:462 | 渲染成长贴纸报告（热力图+维度进度条） |
| `saveAppState()` | app.js:282 | 持久化积分和共享每日状态 |
| `loadAppState()` | app.js:287 | 从 localStorage 恢复状态 |
| `renderAll()` | app.js:4645 | 全局重渲染入口 |
| `window.addGrowthPoints(n)` | app.js:4668 | 外部增加积分 |
| `window.spendPoints(n)` | app.js:4669 | 外部消费积分 |

### 各维度详情

| 维度 key | 中文名 | 图标 | 任务数 | 定义位置 |
|----------|--------|------|--------|---------|
| learning | 学习力 | book-open | 6 | app.js:40-49 |
| sports | 运动力 | bike | 6 | app.js:51-60 |
| selfcontrol | 自控力 | clock | 6 | app.js:62-72 |
| exploration | 探索力 | compass | 6 | app.js:73-83 |
| practice | 实践力 | wrench | 6 | app.js:84-93 |
| petcare | 守护力 | paw-print | 7 | app.js:95-106 |

### 持久化

```
key: petbank_points              → 总积分 (number)
key: petbank_daily_state          → 当前日期 + profileId + 任务/日宝箱状态 (JSON object)
key: petbank_completed            → 旧兼容任务集合 (JSON array)
key: petbank_tasks_completed_today → 旧兼容今日完成数 (number)
key: petbank_custom_items        → 自定义兑换项 (JSON array)
```

### 配图匹配逻辑

[getPointTaskArt](../../js/app.js#L128-L140) 按任务文本正则匹配：
```
数学/算/口算/计算/专项 → math
练字/日记/写/听写/抄写 → writing
阅读/背诵/古诗/英语/学习力/新书 → reading
运动/跳绳/跑步/骑行/球/晨练/户外 → sports
起床/屏幕/计划/自控/提醒/赖床/时间/按时/独立完成 → clock
整理/家务/房间/书桌/清理/垃圾/玩具/分类/衣物 → tidy
做菜/新菜/家常菜/厨房 → cooking
宠物/喂食/梳毛/抚摸/遛宠物/宠物窝/清理宠物/陪伴玩耍/健康检查/成长日记/守护力 → petcare
探索/观察/植物/地图/路线/好奇/记录 → explore
其他 → guide 默认插图
```

---

## 注意事项

- `totalPoints` 通过 `Object.defineProperty` 拦截 setter，确保始终为有效数字；每日任务通过 `PetBankDailyState` 绑定本地日和 active profile
- `completedTasks` 是 `Set`，持久化时用 `JSON.stringify([...completedTasks])` 转为数组
- `renderAll()` 是全局重渲染入口，在 toggleTask 中每次触发，开销大
- petcare（守护力）是第 6 维度，与宠物小屋的照料行为紧密关联
