# 探索短章节与断点续玩 Phase D 发布记录

## 本阶段交付

- 新增 `js/exploration-chapter.js`：把现有事件映射为 `看见 / 选择 / 带回家` 三个主节点，数学题和遭遇战标记为可选挑战。
- 新增 `js/exploration-progress.js`：按场景独立保存事件索引、当前节点、待输入状态和已发现物品。
- 探索页增加三节点进度指示，不改变现有事件、数学题、战斗和奖励接口。
- 从根入口刷新后可恢复到当前场景和当前事件；显式退出、完成结算后清理临时进度。
- 运行时 loader 接入章节和断点模块。

## 测试

通过：

- `node scripts/test-pet-adventure-retention.mjs`
- `node --check js/exploration-detail.js`
- `node --check js/exploration-chapter.js`
- `node --check js/exploration-progress.js`
- `node scripts/test-pages-fast-gate-contract.mjs`
- 全量 `data/stories/*.json` 解析校验

## 真实浏览器验收

服务器：`python -m http.server 9077 --bind 127.0.0.1`

- 从 `http://127.0.0.1:9077/` 进入探索页。
- 糖果王国桌面 `1280x720`：显示 `1 看见 · 2 选择 · 3 带回家`，无横向溢出。
- 糖果王国移动 `390x844`：节点指示正常，无横向溢出，控制台 `0 errors`。
- 推进到数学挑战后保存 `petbank_exploration_progress_v1:candy`；从根入口重新加载并进入糖果场景，恢复到同一数学挑战。
- 调用退出后进度 key 被清理，探索地图恢复。

截图：

- `docs/releases/pet-adventure-phase-d-desktop.png`
- `docs/releases/pet-adventure-phase-d-mobile.png`

## 入口限制

直接访问 `http://127.0.0.1:9077/app/explore` 会被 Python 静态服务器返回 404；当前验收和用户使用路径必须从根入口 `/` 进入，再由前端路由切换。未在本阶段修改服务器路由。

## 后续项

- 纪念徽章、旅行卡、冰箱贴、宠物卡牌仍按资产方案执行；当前纪念卡使用图标。
- 新短句本地语音映射仍待补齐，现有 VoiceSystem 可能记录缺失音频 warning。
