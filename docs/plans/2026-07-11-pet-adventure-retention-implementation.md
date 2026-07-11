# 宠物进化与探索留存优化实施计划

> **给 Claude:** 必需子技能：使用 `superpowers:executing-plans` 来逐任务实施此计划。

**目标：** 在不破坏现有积分、经验和存档规则的前提下，把宠物进化和探索改造成短时、强视觉反馈、可持续回访的儿童体验。

**架构：** 先做表现层兼容改造，再增加旅行纪念物，最后迁移故事数据为短章节。旧故事仅有 `text` 字段时继续走兼容路径；所有新状态都使用独立 localStorage key 或现有库存/成长日志接口，不修改既有积分算术。

**技术栈：** 原生 JavaScript、HTML/CSS、JSON 数据、现有 Node `.mjs` 契约测试、Python 静态服务器 `9077`、Codex In-app Browser 截图验收。

---

## 阶段 0：基线与工作区保护

### 任务 0.1：确认网页基线

**文件：**
- 读取：`index.html`
- 读取：`js/home.js`
- 读取：`js/exploration.js`
- 读取：`js/exploration-detail.js`
- 读取：`js/pet.js`
- 读取：`scripts/test-pet-growth-feedback.mjs`
- 读取：`scripts/test-pet-growth-history.mjs`

**步骤：**

1. 运行 `git status --short`，记录已有用户改动，不得清理或重置。
2. 运行 `node scripts/test-pet-growth-feedback.mjs`。
3. 运行 `node scripts/test-pet-growth-history.mjs`。
4. 启动 `python -m http.server 9077 --bind 127.0.0.1`，确认 `http://127.0.0.1:9077/` 返回 200。
5. 保存基线截图到临时目录，不纳入本轮提交。

**验收：** 基线测试通过；工作区原有改动未被暂存。

### 任务 0.2：建立本轮测试入口

**文件：**
- 创建：`scripts/test-pet-adventure-retention.mjs`

**步骤：**

1. 编写失败测试，覆盖进化预览返回当前阶段、下一阶段和剩余等级。
2. 编写失败测试，覆盖短文本优先：旧事件只有 `text` 时仍返回旧文本，新事件优先返回 `shortText`。
3. 编写失败测试，覆盖旅行纪念物事件具备 `sceneId`、`itemId` 和 `nextPreview`。
4. 运行 `node scripts/test-pet-adventure-retention.mjs`，确认因接口尚不存在而失败。
5. 提交测试基线：`test: define pet adventure retention contracts`。

---

## 阶段 A：进化预览与单一下一步

### 任务 A.1：实现进化预览服务

**文件：**
- 创建：`js/pet-evolution-preview.js`
- 修改：`js/pet.js`
- 测试：`scripts/test-pet-adventure-retention.mjs`

**步骤：**

1. 在测试中固定等级 1、2、3、4、5、8、15，验证阶段名称、当前图、下一阶段最小等级和剩余等级。
2. 实现 `PetEvolutionPreview.get(state, species)`，只读取 `PetSystem` 暴露的阶段和物种数据，不复制经验表。
3. 对最高阶段返回 `isMax: true`、`next: null`，避免出现负数进度。
4. 对缺少图片的旧物种返回 emoji/当前可用图片，不阻塞渲染。
5. 运行 `node scripts/test-pet-adventure-retention.mjs`，确认进化预览契约通过。
6. 提交：`feat: add pet evolution preview contract`。

### 任务 A.2：首页加入进化预览和单一 CTA

**文件：**
- 修改：`js/home.js`
- 修改：`index.html`
- 修改：相关首页样式所在文件（优先沿用 `js/home.js` 的局部样式）
- 测试：`scripts/test-pet-adventure-retention.mjs`

**步骤：**

1. 测试未选宠、普通阶段、最高阶段三种渲染状态。
2. 在首页宠物卡增加一行短文案：当前阶段、下一阶段或“已完成进化”。
3. 增加下一阶段剪影/占位图，点击后打开轻量预览，不跳转完整图鉴。
4. 将每日照料卡的多个提示收敛为一个 `nextCare` CTA，保留原有动作函数。
5. 所有新增可见文本控制在 24 字内，详细说明放进 `title` 或折叠区域。
6. 运行既有宠物测试和 `node scripts/test-pet-adventure-retention.mjs`。
7. 启动 9077，使用浏览器检查 1280x720 和 390x844，无横向溢出。
8. 提交：`feat: show pet evolution preview and next action`。

### 任务 A.3：探索页短句优先渲染

**文件：**
- 修改：`js/exploration-detail.js`
- 修改：`js/exploration.js`
- 修改：`data/stories/forest.json`
- 修改：`data/stories/beach.json`
- 修改：`data/stories/stargarden.json`
- 测试：`scripts/test-pet-adventure-retention.mjs`

**步骤：**

1. 为三个样板场景增加 `shortText`、`detailText`、`petMood`，保留原 `text`。
2. 在测试中验证 `shortText` 优先，缺失时回退 `text`。
3. 实现短文本渲染：默认显示 `shortText`，仅在用户点击“想知道更多”时显示 `detailText`。
4. 给宠物立绘添加 `petMood` class，至少支持 `happy`、`surprised`、`worried`、`proud` 四种状态。
5. 把选项按钮文案限制在 2~6 字，长说明放到选项后的反馈卡。
6. 运行故事数据校验和 `node scripts/test-pet-adventure-retention.mjs`。
7. 用浏览器完成三个场景的桌面/移动截图验收。
8. 提交：`feat: prioritize short exploration story beats`。

---

## 阶段 B：旅行纪念物与回家反馈

### 任务 B.1：定义旅行奖励数据

**文件：**
- 创建：`data/travel-rewards.json`
- 创建：`js/travel-memory.js`
- 修改：`scripts/test-pet-adventure-retention.mjs`

**步骤：**

1. 为森林、海滩、星空花园定义照片、贴纸、材料和下一站预告。
2. 实现 `TravelMemory.record()`、`getSceneMemory()`、`getNextPreview()`，使用独立 key `petbank_travel_memory_v1`。
3. 记录函数必须幂等，同一场景重复结算不能重复发放纪念物。
4. 运行契约测试，覆盖首次领取、重复领取、未知场景。
5. 提交：`feat: add idempotent travel memories`。

### 任务 B.2：接入探索完成结算

**文件：**
- 修改：`js/exploration-detail.js`
- 修改：`js/inventory.js`（仅在已有公开接口不足时）
- 修改：`js/pet-growth-history.js`（仅记录事件，不改变原日志格式）
- 测试：`scripts/test-pet-adventure-retention.mjs`

**步骤：**

1. 在场景完成后调用 `TravelMemory.record()`。
2. 复用现有库存接口发放物品，禁止直接改库存 localStorage。
3. 在完成页只显示宠物反应、纪念物、下一站预告三项。
4. 将完整奖励明细放入可选的“查看记录”。
5. 验证战斗胜利、无战斗完成、重复完成三条路径。
6. 提交：`feat: show travel memory on return home`。

---

## 阶段 C：短章节和断点续玩

### 任务 C.1：建立三节点章节模型

**文件：**
- 修改：`data/stories/forest.json`
- 修改：`data/stories/beach.json`
- 修改：`data/stories/stargarden.json`
- 修改：`js/exploration-detail.js`
- 测试：`scripts/test-pet-adventure-retention.mjs`

**步骤：**

1. 将三个样板场景整理为 `see`、`choose`、`return` 三节点。
2. 数学题和战斗改为可选标签节点，不强制每次出现。
3. 为当前章节增加独立存档 key，刷新后恢复当前节点。
4. 在退出探索时清理临时状态，但保留已领取纪念物和已完成章节。
5. 运行完整探索相关测试和浏览器验收。
6. 提交：`feat: support resumable three-beat travel chapters`。

### 任务 C.2：迁移剩余九个场景

**文件：**
- 修改：其余 `data/stories/*.json`
- 测试：`scripts/test-pet-adventure-retention.mjs`
- 文档：`docs_project/modules/exploration.md`

**步骤：**

1. 每次迁移三个场景，保留旧 `text` 兼容字段。
2. 每批运行故事格式校验、探索回归和浏览器截图。
3. 更新探索模块文档中的事件格式和降级规则。
4. 每批独立提交，不与词库、游乐场或素材整理混合。

---

## 发布验收

### 必跑命令

```powershell
node scripts/test-pet-adventure-retention.mjs
node scripts/test-pet-growth-feedback.mjs
node scripts/test-pet-growth-history.mjs
python -m http.server 9077 --bind 127.0.0.1
```

### 浏览器验收

- 桌面：`1280x720`
- 移动：`390x844`
- 首页：进化预览、单一下一步 CTA、无横向溢出。
- 森林/海滩/星空花园：三节点故事、短句、宠物表情、纪念物和下一站预告。
- 刷新探索页：节点可恢复，重复完成不重复发奖。

### 发布记录

每个阶段完成后更新 `docs/releases/` 下的阶段记录，写明：提交号、测试命令、浏览器 viewport、截图路径和未完成项。
