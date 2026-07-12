# 旅行记忆真实探索闭环实施计划

**状态：** 已完成并通过真实浏览器验收

> **给 Codex：** 按任务逐项实施；每个任务完成后先运行对应验证，再进入下一个任务。

**目标：** 用真实探索 UI 验证“进入场景 → 短故事 → 选择/答题 → 战斗 → 完成页 → 旅行记忆”的完整闭环。

**架构：** 测试从根入口加载页面，只通过 `ExplorationDetail.show()`、可见按钮和现有战斗 UI 推进；不直接调用 `TravelMemory.record()` 伪造完成。测试上下文使用临时 localStorage，完成后检查旅行记录、宠物快照、库存和完成页 DOM。

**技术栈：** Playwright、现有 `9077` 静态服务器、Node `.mjs` 测试。

---

### 任务 1：建立真实旅程测试

**文件：**
- 创建：`scripts/test-travel-memory-real-journey.mjs`
- 修改：`docs/发布/2026-07-12-travel-memory-assets.md`

**步骤：**

1. 从根入口加载并等待 `PetBankRuntime`、`PetSystem` 和探索模块。
2. 选择默认宠物、恢复 HP，调用 `ExplorationDetail.show('forest')` 打开真实故事页。
3. 点击旁白和发现节点；点击正确的森林数学选项；选择第一条路线；点击遭遇节点进入战斗。
4. 通过可见“攻击”按钮完成战斗，关闭结算进入探索完成页。
5. 断言 `petbank_travel_memory_v1.forest` 存在，且含 `pet.speciesId/name/stage`；完成页含旅行徽章卡。
6. 断言重复刷新/回到图鉴后记录仍存在；`petbank_cards` 只允许保留或增加既有战斗奖励，不把旅行卡本身写入宠物战斗卡数组。

### 任务 2：发布证据

**文件：**
- 修改：`docs/发布/2026-07-12-travel-memory-assets.md`
- 创建：`docs/发布/travel-memory-real-journey-desktop.png`

**步骤：**

1. 在 `1280x720` 运行真实旅程测试并保存完成页截图。
2. 记录命令、场景、点击节点、战斗结果和 localStorage 契约结果。
3. 运行旅行资产、宠物冒险和浏览器组合测试，再只提交本阶段文件。
