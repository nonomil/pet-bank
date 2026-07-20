# Release 0.7.60：Minecraft 词卡校准与证据收口

状态：候选版本，发布前必须按专项 Hermes 手册和全量回归重新验收。

## 本次变化

- `EnglishVocabProgress` 继续使用 FSRS-5 的 19 参数、儿童学习步骤和 Profile 作用域进度；新增基于 review events 的受限坐标下降参数拟合。
- 新增独立艾宾浩斯指数曲线 `R(t)=exp(-lambda*t)` 估计。只有至少 20 条有效 review event 且至少 5 次同卡复习转移时，`parametersReady` 才会允许 scheduler 使用拟合参数。
- 云端词卡冲突会合并进度和去重后的 review events；合并后的旧拟合结果标记 `needsRecalibration`，积分、宠物等非词卡差异仍进入人工冲突流程。
- 运行词库新增 Oxford 3000/5000 exact CEFR 证据和本地快照；Cambridge YLE 年龄字段仍是阶段锚点加项目词表代理，不能写成官方逐词年龄认证。
- Hermes 部署手册新增校准、证据快照、跨设备冲突和 404/403 排查边界。

## 发布前命令

```powershell
node scripts/annotate_minecraft_vocab_evidence.mjs
node scripts/test-english-vocab-profile-scope.mjs
node scripts/test-minecraft-vocab-evidence.mjs
node scripts/test-cloud-sync-profile-integration.mjs
node scripts/test-cloud-sync-outbox.mjs
node scripts/test-high-priority-sync.mjs
node scripts/test-pages-fast-gate-contract.mjs
node scripts/test-static-route-entries.mjs
node scripts/run-full-regression.mjs
node scripts/assemble-pages-artifact.mjs site
```

运行失败时保留旧 release 和数据库备份，不切换 `/srv/pet-bank/current`；部署顺序以 [AI-HERMES-DEPLOY.md](./AI-HERMES-DEPLOY.md) 和 [MINECRAFT-VOCAB-SYNC-HERMES.md](./MINECRAFT-VOCAB-SYNC-HERMES.md) 为准。
