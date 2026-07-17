# v0.7.45 发布记录

> 发布日期：2026-07-14
>
> 范围：Minecraft 单词远征内容补全、远征卡片展示、主站响应式验收、Pages 制品和 Hermes 文档；无数据库迁移。

## 交付内容

- 主站 Minecraft 学习池保持 96 张，参考站本地快照保持 500 条；两套运行/审查数据都补齐 `phrase`、`phraseTranslation`、`sentence`、`sentenceTranslation`。
- 新增 `scripts/enrich_minecraft_vocab.cjs`，可重复执行并默认保留原有来源和例句；`scripts/test-minecraft-vocab-content.mjs` 检查数量、字段、控制字符、重复词和装饰素材污染。
- 远征学习卡新增双语短语和场景句展示；首页素材来源分层显示 96 张主站池、500 条参考快照和 11,241 张独立 Anki 卡片。
- 首页改用本地无嵌入文字的 `assets/learn/english-vocab/minecraft-card.webp`；Bee `gpt-image-2` 本次返回 `404 no enabled channel`，未接入失败生成物。
- 完整 Anki 工作台继续使用独立 release/current，不进入 Pages 制品，不连接主站 SQLite。

## 本地验证证据

```text
node scripts/test-minecraft-vocab-content.mjs                 PASS
node scripts/test-mayihaoke-minecraft-words.mjs               PASS
node scripts/test-minecraft-vocab-session.mjs                 PASS
MMWG_E2E_BASE_URL=http://127.0.0.1:7000 node scripts/test-minecraft-vocab-browser.mjs PASS
node scripts/learning-center-smoke.mjs                        PASS: 104/104
node scripts/run-full-regression.mjs                          PASS: 70/70
python -m unittest discover -s prj/anki-minecraft-vocab/scripts -p "test_*.py" -v PASS: 5/5
python -m py_compile prj/anki-minecraft-vocab/scripts/*.py       PASS
node scripts/test-pages-fast-gate-contract.mjs                PASS
node scripts/test-static-route-entries.mjs                    PASS: 41 routes
node scripts/assemble-pages-artifact.mjs _site_verify          PASS
```

制品检查确认 `_site_verify/app/learn/minecraft-vocab/index.html` 和无文字 hero 资源存在，`_site_verify/prj/anki-minecraft-vocab/` 不存在；Anki 独立项目未进入主站 Pages。

## Hermes 发布步骤

1. 在新 release 中执行 [MINECRAFT-VOCAB-LEARNING-HERMES.md](./MINECRAFT-VOCAB-LEARNING-HERMES.md) 的内容门禁、Minecraft 浏览器、全量回归和 Pages 制品检查。
2. 独立 Anki 站另执行 [ANKI-MINECRAFT-VOCAB-HERMES.md](./ANKI-MINECRAFT-VOCAB-HERMES.md)，不得把 `prj/anki-minecraft-vocab/` 复制进主站 site。
3. 主站制品通过后，Nginx 只指向 `/srv/pet-bank/current/site`；先验证 `/app/learn/minecraft-vocab/`、根首页、API health 和一个现有主站入口，再切换 `current`。
4. 保留旧 release；失败时只回切 `current`，不删除 `/srv/pet-bank/shared/`，不修改 SQLite migration。

## 数据与回滚边界

- 本版本没有 SQLite migration。
- `petbank_minecraft_vocab_session_v1_*` 仍是按孩子 Profile 隔离的本地业务快照；奖励继续走 `GameRewardReceipts` 和 `PetBankPoints`。
- 参考站数据是静态快照，生产不实时抓取；更新前必须运行补全脚本和内容门禁。
- Bee 生图通道不可用时使用已验证本地素材回退，不把错误响应、API key 或外站链接写入生产资源。
- Anki 独立站回滚只切换其自己的 `/srv/pet-bank/anki-minecraft-vocab/current`，不得影响主站 release 或共享数据库。
