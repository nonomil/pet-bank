# 旅行纪念资产系统实施计划

> **给 Codex：** 按任务逐项实施；每个任务完成后先运行对应验证，再进入下一个任务。图片生成必须遵守 `docs/GPT生图/Grok生图.md` 的探测、来源和密钥保护规则。

**目标：** 将旅行徽章、旅行卡、冰箱贴和宠物旅行卡牌接入现有探索完成页、宠物小屋和卡片图鉴，并保留无素材回退。

**架构：** 资产目录与 `data/travel-rewards.json` 负责声明，`js/travel-memory.js` 负责归一化和幂等记录，页面模块负责展示。所有图片为可选字段；加载失败回退到 emoji/CSS，不改变积分、经验或战斗规则。

**技术栈：** 原生 HTML/CSS/JavaScript、JSON、现有 Node smoke tests、真实浏览器截图验收。

---

### 任务 1：建立资产目录与数据契约

**文件：**
- 创建：`prj/学习机玩法原型/assets/generated/travel-memory/README.md`
- 创建：`prj/学习机玩法原型/assets/generated/travel-memory/manifest.json`
- 修改：`data/travel-rewards.json`
- 测试：`scripts/test-travel-memory-assets.mjs`

**步骤：**

1. 先写测试，检查三个样板场景保留 `memoryIcon`，新增资产字段均为可选字符串，来源和状态只允许枚举值。
2. 运行 `node scripts/test-travel-memory-assets.mjs`，预期在字段尚未实现时失败。
3. 创建目录、README 和空 manifest；在 JSON 中只加入 `assetVersion`、`assetSource`、`assetStatus` 及可选路径，不填不存在的图片为 `published`。
4. 重新运行测试，预期通过；再运行 `node -e "JSON.parse(require('fs').readFileSync('data/travel-rewards.json','utf8')); console.log('ok')"`。
5. 独立提交：`docs: define travel memory asset contract`。

### 任务 2：完成页接入徽章与旅行卡

**文件：**
- 修改：`js/travel-memory.js`
- 修改：`js/exploration-detail.js`
- 修改：相关完成页模板所在文件
- 测试：`scripts/test-travel-memory-assets.mjs`

**步骤：**

1. 为 `getSceneMemory()` 增加 `asset`、`cardAsset`、`assetStatus` 的安全归一化。
2. 先补测试：有资源时渲染图片，资源缺失或加载失败时显示 `memoryIcon`，重复领取仍返回 duplicate。
3. 在完成页加入徽章和卡片缩略图，图片使用 `resolvePetBankAssetUrl`，不把二进制写入 localStorage。
4. 增加 `onerror` 回退和可访问的 `alt`，不阻塞返回地图和下一站按钮。
5. 运行相关 Node 测试、`node --check js/travel-memory.js` 和 `node --check js/exploration-detail.js`。
6. 独立提交：`feat: show travel badges and cards on completion`。

### 任务 3：将冰箱贴纳入宠物小屋收藏库存

**文件：**
- 修改：`data/furniture.json`
- 修改：`js/home.js`
- 修改：`js/travel-memory.js`
- 修改：`css/style.css`
- 测试：`scripts/test-travel-memory-assets.mjs`

**步骤：**

1. 先写库存测试，确认领取冰箱贴只增加独立收藏，不自动覆盖家具槽位。
2. 在旅行记忆记录中保存 `fridgeAsset` 引用和领取状态，保持重复完成幂等。
3. 在小屋渲染中增加“旅行纪念物”小区域；孩子点击“摆放”后才调用现有家具槽位逻辑。
4. 图片不可用时显示 emoji 和名称，不能让小屋页面报错。
5. 运行小屋相关测试、JSON 解析和 `node --check js/home.js`。
6. 独立提交：`feat: add travel fridge magnets to home collection`。

### 任务 4：在卡片图鉴增加旅行卡展示层

**文件：**
- 修改：`js/card-collection.js`
- 修改：卡片图鉴对应 HTML/CSS
- 测试：现有卡片收集 smoke test + `scripts/test-travel-memory-assets.mjs`

**步骤：**

1. 先写展示测试，确认旅行卡不会进入战斗队伍，也不会改变现有系列奖励统计。
2. 增加“旅行记忆”筛选/分组，显示已获得卡片和未获得轮廓。
3. 只传入地点、日期、宠物阶段等 DOM 文案；图片仅提供卡框、背景和宠物姿态。
4. 运行卡片系统现有测试、`node --check js/card-collection.js`。
5. 独立提交：`feat: add travel cards to collection gallery`。

### 任务 5：按批次生成与验收图片

**文件：**
- 创建：`prj/学习机玩法原型/assets/generated/travel-memory/reference/travel-memory-reference-prompts.md`
- 创建：批次运行目录和脱敏结果文件
- 更新：`prj/学习机玩法原型/assets/generated/travel-memory/manifest.json`

**步骤：**

1. 运行 Bee/Grok preflight；若模型或接口失败，停止该路径并保存脱敏失败证据。
2. 若使用 ChatGPT 页面，记录来源为 `ChatGPT-web`，保存 prompt 原文和自然尺寸证据。
3. 先完成 Batch 0 风格参考板，人工确认三种主题的轮廓、光照、留白和缩小可读性。
4. 再完成 Batch 1/2/3，每批只改变一个视觉变量；原始图和裁切图分离保存。
5. 对每张 PNG 执行 RGBA、四边 alpha、尺寸、无绿色残留和语义命名检查；通过后才标记 `verified`。
6. 独立提交：`assets: add verified travel memory batch`；失败批次不提交为运行时素材。

### 任务 6：真实浏览器验收与发布记录

**文件：**
- 创建：`docs/releases/YYYY-MM-DD-travel-memory-assets.md`
- 创建：桌面/移动截图
- 可能修改：`docs_project/modules/exploration.md`
- 可能修改：`docs_project/modules/home-system.md`
- 可能修改：`docs_project/modules/card-system.md`

**步骤：**

1. 启动统一本地入口，使用当前项目约定端口；不要默认占用旧端口。
2. 从根路径进入网页，验证旅行完成页、宠物小屋、卡片图鉴三个入口。
3. 在 `1280x720` 和 `390x844` 下检查图片 `naturalWidth > 0`、无横向溢出、无 console error/warning、按钮可点击。
4. 重复领取同一场景，确认不会重复写入旅行记忆；刷新后确认收藏仍存在。
5. 将截图、命令、结果、来源和失败证据写入发布记录；未完成项明确标记，不写“已验收”。
6. 独立提交：`docs: record travel memory asset verification`。

## 交付顺序

先完成任务 1~2 的数据和完成页回退，再做任务 3 的小屋收藏；任务 4 的卡片图鉴可以并行开发，但不能依赖未验证图片。任务 5 只有在 Batch 0 风格确认后才继续，任务 6 是每一批发布前的硬门槛。

## 不做的事情

- 不把 Bee/Grok 失败响应当成成功图片。
- 不把 API key 写入 prompt、代码、manifest、测试输出、截图或聊天回复。
- 不在第一轮新增积分货币、复杂随机分支或战斗数值。
- 不将旅行卡牌直接塞入现有对战平衡。
- 不把整张带文字的游戏截图当作运行时题卡或奖励素材。
