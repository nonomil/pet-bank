# 旅行纪念资产阶段发布记录

**日期：** 2026-07-12
**范围：** 森林、海滩、星光花园三场景的旅行徽章、冰箱贴、旅行卡底图和统一宠物旅行卡框

## 已交付

- 3 枚透明旅行徽章：`badges/forest-badge.png`、`badges/beach-badge.png`、`badges/stargarden-badge.png`
- 3 枚透明冰箱贴：`fridge-magnets/forest-mushroom-magnet.png`、`fridge-magnets/beach-shell-magnet.png`、`fridge-magnets/stargarden-star-magnet.png`
- 3 张旅行卡底图：`cards/forest-card-bg.png`、`cards/beach-card-bg.png`、`cards/stargarden-card-bg.png`
- 1 个统一宠物旅行卡框：`pet-cards/pet-travel-card-frame.png`
- 资产清单：`assets/generated/travel-memory/manifest.json`
- 原始图、提示词和生成结果：`assets/generated/travel-memory/reference/`、`generation-result.json`

实际来源是 Agnes `agnes-image-2.1-flash`。key 只在本机生成进程内读取，没有写入 prompt、manifest、日志或网页。

## 网页落地

- `data/travel-rewards.json` 增加四类资产路径、来源、版本、状态和冰箱贴家具 ID。
- 探索完成页优先显示已验证徽章图，加载失败回退 emoji。
- 宠物小屋增加“旅行纪念物”收藏区；孩子点击“收入小屋”后才加入家具库存，不自动覆盖槽位。
- 卡片图鉴增加“旅行记忆”区；卡底图失败回退 emoji/CSS，不影响现有宠物卡和战斗。
- 旅行记忆卡面现在组合场景底图、统一宠物卡框和完成时的宠物快照；旧记录或缺图时保留 emoji/CSS 回退。
- 旧版 `petbank_travel_memory_v1` 记录进入 home/card 时自动补齐新资产字段。

## 验证证据

### 自动检查

```text
node scripts/test-travel-memory-assets.mjs
travel memory asset contract tests passed

node scripts/test-pet-adventure-retention.mjs
pet adventure retention contract tests passed

node --check js/travel-memory.js
node --check js/exploration-detail.js
node --check js/home.js
node --check js/card-collection.js
node --check js/runtime-loader.js
```

`manifest.json` 中 10 张资产均为 `1024x1024`；徽章和冰箱贴为 `RGBA`，四边 alpha 最大值为 0，绿幕残留检测为 0；卡底图和卡框为 `RGB` 不透明底图。

### 浏览器

- 服务：`python -m http.server 9077 --bind 127.0.0.1`
- 入口：从 `http://127.0.0.1:9077/` 进入，不能直接把 `/app/explore` 当静态目录访问。
- 可重复浏览器验收：`node scripts/test-travel-memory-browser.mjs`
- 组合卡验收：三张卡均包含 `cardAsset`、`petCardAsset` 和宠物主体容器，不写入 `petbank_cards`，不进入 `CardArena`。
- 浏览器脚本还比较渲染前后的 `petbank_cards`、套票、竞技场积分、成长积分和宠物状态，结果保持一致。
- 本轮组合卡阶段新增方案：`docs/plans/2026-07-12-travel-card-composition-design.md`、`docs/plans/2026-07-12-travel-card-composition-implementation.md`。
- 真实探索闭环验收：`node scripts/test-travel-memory-real-journey.mjs`，从森林 UI 推进到战斗胜利，自动生成宠物快照并在完成页/图鉴显示森林旅行卡；截图：`docs/releases/travel-memory-real-journey-desktop.png`。
- 该门禁使用可见故事按钮、数学选项、路线选项和战斗“攻击”按钮推进，没有直接调用 `TravelMemory.record()`；三场景战斗胜利，快照与出发前宠物状态一致。现有战斗胜利的随机宠物卡奖励单独保留，旅行卡不会写入 `petbank_cards`。
- 三样板结果：森林 1 回合胜利、海滩 2 回合胜利、星光花园 4 回合胜利；三条记录均在完成页显示徽章，并在图鉴累计显示 1/2/3 张旅行卡。
- 三样板完成页截图：`docs/releases/travel-memory-real-journey-forest.png`、`docs/releases/travel-memory-real-journey-beach.png`、`docs/releases/travel-memory-real-journey-stargarden.png`。
- 桌面：`1280x720`，小屋显示 3 件冰箱贴，图鉴显示 3 张旅行卡，相关图片 `naturalWidth=1024`，无横向溢出。
- 移动：`390x844`，小屋/图鉴收藏区可见，相关图片 `naturalWidth=1024`，`bodyWidth=384`，无横向溢出。
- 原收藏截图：`docs/releases/travel-memory-assets-desktop.png`、`docs/releases/travel-memory-assets-mobile.png`
- 组合卡截图：`docs/releases/travel-card-composition-desktop.png`、`docs/releases/travel-card-composition-mobile.png`

## 已知事项

- 直接访问 `/app/explore` 仍由静态服务器返回 404；这是当前前端 history 路由现状，真实验收从根路径进入。
- 浏览器历史日志可能包含 `/app/explore` 和 favicon 404；本阶段旅行资产请求、图片加载和页面布局无相关 error/warning。
- 旅行卡牌目前只用于收藏展示，不改变宠物经验、积分、卡牌对战或稀有度算法。
- Agnes 首次卡底图 prompt 被内容策略拒绝，改用中性收藏卡背景 prompt 后成功；脱敏失败证据保留在 `reference/card-background-first-attempt-failure.json`，没有伪装成成功。

## 下一批

先观察三场景的孩子点击率和“收入小屋”行为，再决定是否扩展其余 9 个探索场景；下一轮只改一个视觉变量，不同时改奖励规则和页面结构。

- 旅行专用样式：css/travel-memory.css，主入口 index.html 已加载。
