# 宠物旅行纪念 Phase B 发布记录

## 本阶段交付

- 新增 `data/travel-rewards.json`，定义森林、海滩、星光花园的纪念物、回家文案和下一站预告。
- 新增 `js/travel-memory.js`，使用 `petbank_travel_memory_v1` 独立存档。
- 旅行记忆记录具备幂等保护，同一场景重复完成不会重复写入或重复发放纪念物。
- 探索完成页接入纪念卡：显示图标、纪念物名称、回家反馈和下一站预告。
- 纪念物沿用现有 `InventorySystem.addItem`，不改变积分、经验和战斗算法。

## 测试

通过：

- `node scripts/test-pet-adventure-retention.mjs`
- `node scripts/test-pet-growth-feedback.mjs`
- `node scripts/test-pet-growth-history.mjs`
- `node scripts/test-pet-care-daily-state.mjs`
- `node scripts/test-core-reward-policy.mjs`
- `node scripts/test-core-reward-presentation.mjs`
- `node scripts/test-core-reward-feedback.mjs`
- `node scripts/test-task-reward-events.mjs`
- `node scripts/test-pages-fast-gate-contract.mjs`
- `node --check js/travel-memory.js`
- `node --check js/exploration-detail.js`
- `node --check js/runtime-loader.js`

## 真实浏览器验收

服务器：`python -m http.server 9077 --bind 127.0.0.1`

- 桌面 `1280x720`：完成页显示森林纪念卡和下一站预告，无横向溢出。
- 移动 `390x844`：完成页显示森林纪念卡和下一站预告，无横向溢出。
- 重复调用完成结算：`petbank_travel_memory_v1` 中森林记录数仍为 `1`。
- 控制台：`0 errors`。

截图：

- `docs/releases/pet-adventure-phase-b-desktop.png`
- `docs/releases/pet-adventure-phase-b-mobile.png`

## 已知限制

- 现有 `scripts/run-full-regression.mjs` 仍引用历史清理后不存在的 `prj/regression_runner_contract.test.mjs`，因此全回归入口不能作为本阶段验证命令；本阶段使用直接专项测试和 Pages fast gate。
- 纪念图片资产尚未接入，当前使用纪念物图标；资产生成遵循 `docs/plans/2026-07-11-travel-memory-asset-plan.md`。
- 新探索短句尚未补本地语音映射，VoiceSystem 可能按既有策略记录缺失音频 warning，但无运行时 error。
