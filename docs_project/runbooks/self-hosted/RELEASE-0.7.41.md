# v0.7.41 发布记录

> 发布日期：2026-07-14
>
> 范围：Anki Minecraft 词卡独立静态工作台；主站账号、家庭和 SQLite API 的部署边界不变。

## 本次发布内容

- 新增 `prj/anki-minecraft-vocab/`，从现代 Anki `collection.anki21` 提取 11,241 张卡片、231 个末级牌组和 6,847 个媒体映射。
- 网页提供完整层级目录、聚合统计、搜索、卡片翻面、图片/音频预览和移动端目录抽屉。
- 加密字段保持原始值并显示状态，不破解、不猜测；项目不写入主站 `data/vocab/`，不进入 Pages 制品。
- 为 Hermes 增加独立 release/current 静态部署、Nginx、验证和回滚步骤。

## 本地证据

```text
python -m unittest discover -s prj/anki-minecraft-vocab/scripts -p "test_*.py" -v   5/5 PASS
python -m py_compile prj/anki-minecraft-vocab/scripts/*.py                         PASS
浏览器回归：根目录、官方词条、核心单词、搜索、末级目录、翻卡媒体、移动端抽屉 PASS
新浏览器会话控制台错误                                                           0
node scripts/run-full-regression.mjs                                               63/63 PASS
node scripts/test-static-route-entries.mjs                                        39 routes PASS
node scripts/test-pages-fast-gate-contract.mjs                                    PASS
node scripts/test-self-hosted-ops.mjs                                             3/3 PASS
node --test prj/petbank-server/test/*.test.mjs                                    9/9 PASS
node scripts/smoke.mjs                                                            26/26 PASS
node scripts/assemble-pages-artifact.mjs _site_verify_anki                        PASS
```

另外修正了全量回归中单词记忆原型对历史文档路径的漂移：验证脚本现在读取当前 `docs/专题/打字游戏/单词记忆小游戏.md`。

完整执行命令和生产验收边界见 [ANKI-MINECRAFT-VOCAB-HERMES.md](./ANKI-MINECRAFT-VOCAB-HERMES.md)。真实 VPS 外部域名验收仍由 Hermes 在目标服务器执行；在此之前不要把线上部署写成已完成。
