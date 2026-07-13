# v0.7.42 发布记录

> 发布日期：2026-07-14
>
> 范围：三世界像素故事漫游、20 个侦探小游戏节点、首页探索入口和静态发布验收；无数据库迁移。

## 交付内容

- 科幻地图 20 个节点、森林地图 20 个节点、方块地下城 20 个节点。
- 像素冒险内置侦探小游戏路线 20 个节点；小游戏为扫描、收集、修复、搭建、照顾和路线互动，不是答题页。
- 原有森林探险 12 个场景和星光成长侦探社 5 个案件入口保留。
- 新进度键为 `petbank_pixel_worlds_progress_v1`，旧 04 故事包和旧进度键保留。
- 页面素材当前使用已验证本地素材回退。Bee `gpt-image-2` 供应商本次返回 `404 no enabled channel`，未把失败文件发布；重新生成流程见 [PIXEL-WORLDS-HERMES.md](./PIXEL-WORLDS-HERMES.md)。

## 本地证据

```text
node scripts/test-pixel-worlds-contract.mjs                    PASS: 3 worlds / 60 levels + 20 bonus levels
node scripts/test-explore-mode-contract.mjs                    PASS
node scripts/test-exploration-entry-browser.mjs                PASS: forest 12 / story 20 / block 20 / detective 5
node scripts/test-pixel-story-all-chapters-browser.mjs          PASS: four route entry screens, no page errors
node --check js/pixel-story-engine.js                           PASS
node --check js/pixel-story-map.js                              PASS
node --check js/app.js                                          PASS
```

## 发布边界

- 本版本没有 SQLite migration，部署前仍要执行标准 health check，但不需要 schema 变更。
- Nginx 根目录仍只能指向 `/srv/pet-bank/current/site`。
- Hermes 必须先组装新 release、检查故事包和静态资源，再切换 `current`；外部 canary 失败时只切回上一 release。
