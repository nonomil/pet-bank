# Minecraft 词卡校准与分级证据实施计划

> **给 Codex:** 收尾前必须使用 `verification-before-completion` 执行新鲜验证。

**目标：** 为 Minecraft 词卡补齐可重复的 FSRS-5 参数拟合、艾宾浩斯曲线估计、跨设备合并后的重新校准状态，以及可审计的年龄/频率分级证据。

**架构：** `EnglishVocabProgress` 继续保存 Profile 作用域的复习事件和进度；校准从按卡片排序的 review events 重放 DSR 状态，用受限坐标下降拟合 19 个 FSRS-5 权重，并独立拟合 `R(t)=e^(-lambda*t)` 的艾宾浩斯衰减参数。外部年龄证据只在拿到逐词快照时标记官方命中，否则保留阶段锚点和项目词表代理边界。

**技术栈：** Vanilla JS IIFE、localStorage、Node `node:assert`/`vm`、公开官方网页与可复核原始快照。

---

### 任务 1：FSRS 与艾宾浩斯校准

**文件：**
- 修改：`js/english-vocab-progress.js`
- 修改：`scripts/test-english-vocab-profile-scope.mjs`

1. 先增加 19 权重拟合、艾宾浩斯 lambda 拟合和样本门槛断言。
2. 运行专项测试确认新断言失败。
3. 实现受限坐标下降、事件重放和校准结果持久化。
4. 让 scheduler 仅在拟合结果有效时采用拟合权重。
5. 运行专项测试确认通过。

### 任务 2：跨设备校准状态

**文件：**
- 修改：`js/profiles.js`
- 修改：`scripts/test-cloud-sync-profile-integration.mjs`

1. 合并 review event 后清除过期参数拟合结果并标记需要重新校准。
2. 保持积分、宠物等非词卡冲突仍不能自动合并。
3. 增加跨设备校准状态测试。

### 任务 3：外部年龄与频率证据

**文件：**
- 修改：`scripts/annotate_minecraft_vocab_evidence.mjs`
- 修改：`scripts/test-minecraft-vocab-evidence.mjs`
- 修改：`docs/minecraft-vocab-evidence/*`

1. 固化公开来源 URL、抓取时间、哈希和证据级别。
2. 逐词命中才标记 official；代理和阶段锚点保持显式降级。
3. 重新生成词库并运行证据测试。

### 任务 4：Hermes 与发布验证

**文件：**
- 修改：`docs_project/runbooks/self-hosted/AI-HERMES-DEPLOY.md`
- 修改：`docs_project/runbooks/self-hosted/MINECRAFT-VOCAB-SYNC-HERMES.md`
- 修改：对应项目路线/状态文档

1. 更新 Hermes 顺序、失败边界和重新校准命令。
2. 运行专项测试、全回归、Pages 门禁和制品组装。
3. 检查工作树、提交并推送远程。
