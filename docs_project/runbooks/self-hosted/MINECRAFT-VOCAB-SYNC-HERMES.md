# Minecraft 词卡、FSRS 与同步专项验收

此手册给 Hermes/部署 AI 使用。它覆盖本次词卡调度、外部证据分类和跨设备词卡合并；不代表积分、宠物等全部业务状态已经具备自动冲突合并。

## 发布前

在仓库根目录顺序执行，不能并行执行“生成数据”和“读取数据”的测试：

```powershell
node scripts/annotate_minecraft_vocab_evidence.mjs
node scripts/test-minecraft-vocab-evidence.mjs
node scripts/test-english-vocab-profile-scope.mjs
node scripts/test-cloud-sync-profile-integration.mjs
node scripts/test-cloud-sync-outbox.mjs
node scripts/test-high-priority-sync.mjs
node scripts/test-pages-fast-gate-contract.mjs
node scripts/test-static-route-entries.mjs
node scripts/assemble-pages-artifact.mjs _site_verify
```

检查：

- FSRS scheduler 为 `fsrs-5`，参数数量为 19，默认目标保持率为 0.9；达到 20 条有效 review event 且至少 5 次同卡复习转移后，`calibrate()` 会拟合 19 个权重和独立的艾宾浩斯 `lambda`，并在 `parametersReady=true` 时让 scheduler 使用 Profile 参数。
- 新卡前两次 Good 为 1 天/3 天，Again 为 10 分钟，Hard 为 12 小时；毕业后由稳定性计算间隔。
- 旧词卡读取后出现 `schedulerMigration=sm2-to-fsrs5`，不能丢失原有 `seen/correct/wrong/dueAt`。
- `calibrate()` 少于 20 条复习或少于 5 次同卡复习转移时不得启用拟合权重；少于 20 条时也不得改变目标保持率；达到样本门槛后才写入 Profile 校准键。
- 词卡冲突只在所有非词卡业务键一致时自动合并；review event 合并后会把旧参数标成 `needsRecalibration`，积分/宠物不同必须仍为 `conflict`。
- 运行词库每张卡都有 `ageEvidence`、`frequencyEvidence`、`cefrEvidence`、`classificationConfidence`；`minecraft-specialized` 不得被误标为 common。
- `ageEvidence=curriculum-proxy` 仍不是 Cambridge 官方逐词年龄命中；Oxford `cefrEvidence=exact-wordlist` 只作为 CEFR/通用词表交叉证据。

## Release 组装

```bash
node scripts/run-full-regression.mjs
node scripts/test-pages-fast-gate-contract.mjs
node scripts/test-static-route-entries.mjs
node scripts/assemble-pages-artifact.mjs site
```

`_site_verify` 和 `site` 只作为本地/发布制品目录。不要把 `docs/minecraft-vocab-evidence/raw/`、Anki 原始素材、`.codex/skills`、浏览器 profile、token 或 key 复制到 Pages。

## VPS 切换

遵守 [UPGRADE-AND-BACKUP.md](UPGRADE-AND-BACKUP.md) 和 [AI-HERMES-DEPLOY.md](AI-HERMES-DEPLOY.md)：先备份 `/srv/pet-bank/shared/`，组装并验证新 release，再切换 `current`。切换前后都检查：

```bash
curl --fail https://<domain>/api/v1/health
curl --fail https://<domain>/parent/
curl --fail https://<domain>/app/learn/minecraft-vocab/
```

如果出现 404/403，先确认 Nginx root 指向 `current/site`、深层入口是否由 Pages 制品脚本组装，以及资源是否使用 `resolvePetBankAssetUrl`；不要把仓库根目录直接暴露为静态根。

## 线上冲突验证边界

- 使用专用测试孩子，不要在真实家庭创建临时数据。
- 两个已登录设备各复习不同词卡，确认合并后两张卡和两条 review event 都存在，revision 递增一次。
- 再制造积分或宠物字段差异，确认不会自动覆盖，家长端仍显示冲突处理入口。
- 网络断开时确认词卡仍能本地记录，恢复网络后 outbox 可重试；不要把“已入 outbox”报告为“已同步”。

失败时保留旧 release 和数据库备份，禁止 `git clean -fdx`、删除 shared 目录或强制覆盖远端快照。
