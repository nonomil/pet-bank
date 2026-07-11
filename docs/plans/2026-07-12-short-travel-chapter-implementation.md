# 短旅行章节实施计划

> **给 Codex:** 必需子技能：使用 `superpowers:executing-plans` 来逐任务实施此计划。

**目标：** 为 12 个探索场景落地真正的三节点短旅行主路径，并保留数学题/战斗的可选挑战和存档兼容。

**架构：** 在每个故事 JSON 中声明 `chapter_flow`，运行时由 `ExplorationChapter` 计算安全的短流程模型。`ExplorationDetail` 使用状态机区分主路径、数学挑战和战斗挑战；旅行记忆仍由现有 `TravelMemory` 幂等记录，图片缺失时回退到 emoji/CSS。

**技术栈：** 原生 JavaScript、JSON、Node ESM 契约测试、Playwright 浏览器验收、Python `http.server` 9077。

---

### 任务 1：建立短章节失败契约

**文件：**
- 修改：`scripts/test-pet-adventure-retention.mjs`
- 修改：`data/stories/forest.json`
- 修改：`data/stories/beach.json`
- 修改：`data/stories/stargarden.json`

**步骤：**
1. 断言 12 个场景都有 `chapter_flow.mode=short`、`see=[0,1]`、`choose=3`、数学/战斗挑战索引。
2. 断言 12 个场景都有旅行记忆元数据和有效小屋装饰 ID。
3. 断言短流程模型能返回安全的 `see/choose/challenge` 索引。
4. 运行 `node scripts/test-pet-adventure-retention.mjs`，先确认因字段和接口不存在而失败。

### 任务 2：实现短流程模型

**文件：**
- 修改：`js/exploration-chapter.js`
- 修改：`scripts/test-pet-adventure-retention.mjs`

**步骤：**
1. 增加 `buildShortFlow(story)`，校验索引和事件类型，非法输入返回 `null`。
2. 增加 `getShortFlowEvent(flow, node)`，返回 see/choose/challenge 对应事件。
3. 保持现有 `build()` / `getNodeForEvent()` 行为不变，避免既有章节进度存档回归。
4. 运行契约测试，确认短流程模型通过。

### 任务 3：接入主路径和可选挑战

**文件：**
- 修改：`js/exploration-detail.js`
- 修改：`js/exploration-progress.js`
- 修改：`css/style.css`

**步骤：**
1. `show()` 读取短流程并恢复 `flowMode`、`challengeStatus`。
2. 短流程先展示两个 see 事件，再展示一次 choice；choice 反馈后提供“带回家”和“挑战一下”。
3. “带回家”直接调用现有旅行记忆记录与完成页；“挑战一下”才进入 math 和 battle。
4. 挑战完成或跳过后清理临时状态；旧流程继续使用原 `showNextEvent()`。
5. 进度存档新增字段并保持旧 schema 兼容。
6. 运行 `node --check` 和契约测试。

### 任务 4：浏览器验收脚本

**文件：**
- 创建：`scripts/test-short-travel-chapter-browser.mjs`
- 参考：`scripts/test-travel-memory-real-journey.mjs`

**步骤：**
1. 检查 12 个场景默认路径在选择后直接显示完成卡，不出现战斗 modal。
2. 检查挑战路径仍能答题、进入战斗并完成旅行记忆。
3. 检查刷新恢复选择/挑战状态，退出清理进度 key。
4. 检查桌面/移动 viewport、自然图片尺寸、横向溢出和 console errors。

### 任务 5：文档与发布记录

**文件：**
- 修改：`docs_project/modules/exploration.md`
- 创建：`docs/releases/2026-07-12-short-travel-chapter.md`

**步骤：**
1. 写明 12 个场景都是真正 short flow，3 个有 verified Agnes 图片，9 个使用 placeholder 回退。
2. 记录测试命令、截图路径、兼容策略和未完成项。
3. 独立提交本阶段文件，不混入词库、游乐场和已有截图改动。

**验证命令：**

```powershell
node scripts/test-pet-adventure-retention.mjs
node scripts/test-short-travel-chapter-browser.mjs
node scripts/test-travel-memory-assets.mjs
node scripts/test-travel-memory-real-journey.mjs
node --check js/exploration-chapter.js
node --check js/exploration-detail.js
```
