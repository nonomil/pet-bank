# v0.7.43 发布记录

> 发布日期：2026-07-14
>
> 范围：主站 Minecraft 单词远征、参考词表本地快照、Pages 深层路由和 Hermes 部署验收；无数据库迁移。

## 交付内容

- 学习中心新增 `/app/learn/minecraft-vocab`，固定 11 步短会话：2 个复习、5 个新词、3 个主动回忆、1 个场景句。
- 主站默认学习池为 96 张已审查词卡；参考站 API 快照为 500 条结构化词卡，仅用于本地审查和后续扩充。
- 会话快照按 Profile 保存，完成当天远征由统一 receipt 发放一次 10 成长分；不会新建积分账本。
- 完整 11,241 张 Anki 卡片继续位于独立项目 `prj/anki-minecraft-vocab/`，不进入 Pages 制品，不连接 SQLite。

## 本地证据

```text
node scripts/learning-center-smoke.mjs                         PASS: 104/104
node scripts/run-full-regression.mjs                           PASS: 69/69
node scripts/test-static-route-entries.mjs                     PASS: 41 routes
node scripts/test-mayihaoke-minecraft-words.mjs                PASS
node scripts/test-minecraft-vocab-session.mjs                  PASS
MMWG_E2E_BASE_URL=http://127.0.0.1:8770/app/learn/minecraft-vocab \
  node scripts/test-minecraft-vocab-browser.mjs                 PASS
node scripts/assemble-pages-artifact.mjs _site_verify           PASS
```

制品检查确认 `app/learn/minecraft-vocab/index.html`、页面脚本、样式和资料包资源存在；`prj/anki-minecraft-vocab/` 未被复制到 `_site_verify`。

## 发布步骤

1. Hermes 在新 release 中执行 [MINECRAFT-VOCAB-LEARNING-HERMES.md](./MINECRAFT-VOCAB-LEARNING-HERMES.md) 的本地合同、浏览器和 Pages 制品检查。
2. 运行 `node scripts/assemble-pages-artifact.mjs site`，Nginx 只指向 `/srv/pet-bank/current/site`。
3. 先检查 `/app/learn/minecraft-vocab/`、根首页、`/api/v1/health` 和现有游戏入口，再切换 `current`。
4. 外部 canary 通过后保留旧 release；失败时只切回上一 release，不删除 `/srv/pet-bank/shared/`。

## 数据与回滚边界

- 本版本没有 SQLite migration，不得修改或重放数据库迁移。
- `petbank_minecraft_vocab_session_v1_*` 属于孩子 Profile 业务快照；账号 token、家庭资料和 SQLite 数据仍按现有自托管规则处理。
- 参考站快照是仓库静态数据，不在生产服务器实时抓取；更新前必须重新运行词表合同测试并检查来源字段。
- Anki 独立站使用自己的 release/current 链接和 [ANKI-MINECRAFT-VOCAB-HERMES.md](./ANKI-MINECRAFT-VOCAB-HERMES.md)，主站回滚不应删除或覆盖它的 release。
