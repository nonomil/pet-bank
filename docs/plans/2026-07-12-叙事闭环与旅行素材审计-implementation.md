# 叙事闭环与旅行素材审计实施计划

> **给 Codex：** 按任务逐项实施；每个任务完成后先运行对应验证，再进入下一个任务。

**目标：** 将 12 个探索故事的真实完成状态固化为可重复审计，并让运行时只从场景 JSON 读取事件和结尾文案；同时把旅行纪念图片的生成、验收和扩展边界写清楚。

**架构：** `data/stories/*.json` 是叙事单一来源，`js/exploration-detail.js` 只保存已加载的场景对象。`data/travel-rewards.json` 覆盖 12 个场景的纪念物元数据；`assets/generated/travel-memory/` 中 3 个场景有 Agnes 已验证图片，其他场景明确使用 placeholder 和 emoji/CSS 回退。

**技术栈：** 原生浏览器 JavaScript、Node.js ESM 契约脚本、JSON、Agnes `agnes-image-2.1-flash` 本地生成脚本。

---

### 任务 1：建立全量叙事与旅行资产契约

**文件：**
- 创建：`scripts/test-narrative-closure.mjs`
- 读取：`data/stories/*.json`、`data/travel-rewards.json`
- 读取：`assets/generated/travel-memory/manifest.json`

**步骤：**
1. 断言 12 个故事均有 `chapter_skill`、`ending_text` 和五种固定事件。
2. 断言短文案、宠物情绪、数学题选项、选择奖励和遭遇文案完整。
3. 断言 12 个场景的旅行元数据、小屋装饰 ID 和 placeholder/verified 状态一致。
4. 断言运行时不存在 `sceneEvents`、`SCENE_ENDING` 第二来源。
5. 运行 `node scripts/test-narrative-closure.mjs`，预期输出 `narrative closure contract passed`。

### 任务 2：收口运行时故事单一来源

**文件：**
- 修改：`js/exploration-detail.js`

**步骤：**
1. 将每个加载成功的场景 JSON 保存为 `storyData[sceneId]`。
2. 事件推进、选择、数学题和结束页均从 `storyData[currentScene.id]` 取值。
3. 保留故事加载失败的明确服务器提示，不恢复静默硬编码兜底。
4. 运行 `node --check js/exploration-detail.js`。
5. 运行 `node scripts/test-narrative-closure.mjs` 和现有旅行闭环测试。

### 任务 3：维护视觉资产扩展边界

**文件：**
- 参考：`docs/plans/2026-07-11-travel-memory-asset-plan.md`
- 生成：`scripts/generators/gen_travel_memory_assets.py`
- 资产：`assets/generated/travel-memory/`

**步骤：**
1. 生成前只在本机读取 `docs/资源/生图/Agnes生图key.md`，不输出 key。
2. 每批保存 prompt、原始结果、处理结果和 manifest；图片内不烧录文字。
3. 用 alpha、尺寸、naturalWidth 和浏览器截图验收后才写入 `data/travel-rewards.json`。
4. 先扩展一个场景做 A/B 体验验证，再决定是否为 placeholder 场景生成图片。
5. 若 Agnes 请求失败，保留脱敏失败证据，不伪造 `verified` 状态。

### 任务 4：最终文档同步

**文件：**
- 修改：`docs/plans/2026-06-30-叙事收口与文案优化-任务清单.md`
- 待后续修改：`docs/项目现状总览.md`、`docs/工程/路线/差距清单与开发路线图.md`、`docs/需求/规格/需求规格书.md`、`docs/进度/README.md`、`docs/变更/README.md`

**步骤：**
1. 勾选已实现的 R3/R1/R4/R5 项，保留最终文档同步项未勾选。
2. 将历史发布记录视为证据，不改写“当时尚未完成”的历史口径。
3. 另开文档同步提交，避免把历史记录、素材和词库改动混入本轮。

**验证命令：**

```powershell
node scripts/test-narrative-closure.mjs
node scripts/test-travel-memory-assets.mjs
node scripts/test-travel-memory-browser.mjs
node scripts/test-travel-memory-real-journey.mjs
node --check js/exploration-detail.js
```
