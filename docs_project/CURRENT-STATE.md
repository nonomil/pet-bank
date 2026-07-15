# 当前实现快照

> 核实基线：2026-07-14。本文只记录能从当前代码和验证入口复核的事实；产品设想和历史差距请看 `docs/`。

## 运行形态

- 主站是 `index.html` 单页静态应用，当前有 28 个 `page-*` 页面容器。
- 首屏脚本在 `index.html` 中加载；页面专属脚本和样式由 `js/runtime-loader.js` 按 bundle 延迟加载。
- 项目没有 npm 构建步骤。开发预览必须通过 HTTP 服务，因为运行时会 `fetch()` 加载 JSON 和故事数据。
- 浏览器运行态以带 `petbank_` 前缀的 `localStorage` 为主；`ProfileManager` 通过快照和 reload 切换孩子档案，网络失败的云端快照进入独立 outbox，不属于孩子业务快照。
- `prj/petbank-server/` 是 SQLite 后端。账号、家庭、孩子和快照 API 已实现并由端到端测试覆盖；社交同步仍属于目标合同，不应描述为已上线能力。

## 核心入口

| 能力 | 当前入口 |
| --- | --- |
| 路由与页面编排 | `js/app.js` 的 `switchPage()`、`preparePage()` |
| 按需加载 | `js/runtime-loader.js` 的 `SCRIPT_BUNDLES` / `STYLE_BUNDLES` |
| 任务与积分 | `js/app.js`、`js/core-reward-service.js`、`js/task-reward-events.js` |
| 宠物与小屋 | `js/pet.js`、`js/home.js`、`js/pet-care-daily.js` |
| 探索与战斗 | `js/exploration*.js`、`js/battle-engine.js`、`js/battle-fx.js` |
| 学习中心 | `js/learn-center.js`、`data/learn/` |
| 独立学习游戏桥接 | `js/app.js` 的 iframe/message bridge，运行资源由 Pages 制品白名单控制 |
| 发布制品 | `scripts/assemble-pages-artifact.mjs` |
| 全量回归 | `scripts/run-full-regression.mjs` |

## 数据边界

- 静态业务数据位于 `data/`，当前约 87 个 JSON 文件；故事正式内容位于 `data/stories/`。
- 学习资料包位于 `data/learn/`，由 `catalog.json` 和各 pack 的 `manifest.json`、`plan.json`、modules 组成。
- 运行时 key 的 owner、scope 和迁移要求以 [localstorage-keys.md](data-contracts/localstorage-keys.md) 为准。
- Pages 只发布 `assemble-pages-artifact.mjs` 明确放行的运行时；不能依据 `prj/` 或 `docs/` 目录大小批量清理。
- `prj/anki-minecraft-vocab/` 是独立的 Anki Minecraft 词卡静态工作台，使用自己的 `data/` 与 `assets/media/`，不写入主站 `data/vocab/`，也不进入主站 Pages 制品；独立部署和回滚见 [ANKI-MINECRAFT-VOCAB-HERMES.md](runbooks/self-hosted/ANKI-MINECRAFT-VOCAB-HERMES.md)。
- Minecraft 运行学习池为 2,168 个去重词，合并现有精选卡、参考站本地快照 500 条和 Anki 可读官方词条；完整 Anki 工作台仍保留 11,241 张卡片和完整目录。两套数据均有中英短语和中英短句完整性门禁。

## 当前能力口径

| 能力 | 状态 |
| --- | --- |
| 本地任务、积分、宠物成长、商城、背包、小屋、遛弯、探索 | 当前实现，需按模块测试验证 |
| 学习中心、数学 PK、汉字、排行榜、独立学习游戏 | 当前实现或已桥接，需按专项验证入口检查 |
| 本地多孩子档案 | 当前实现，切换会保存快照并 reload |
| 自托管账号、家庭、孩子管理 | 当前已实现，需通过 VPS canary 验证 |
| Anki Minecraft 词卡工作台 | 当前实现，11,241 张卡片、231 个末级牌组；原始 6,847 个媒体映射清洗为 4,956 个；独立静态部署 |
| Minecraft 单词远征内容层 | 当前实现，2,168 个去重词 + 11,241 张 Anki 原始卡片目录；每条都有短语、短句及中文翻译；内容完整性测试已接入全量回归 |
| 三世界像素故事漫游 | 当前实现：科幻、森林、方块地下城各 20 个主线节点，另有 20 个侦探小游戏节点；入口由首页和故事地图提供；认字内容为剧情文本，不是题库 |
| Profile 快照自动 push/pull | 已接入启动恢复、孩子切换前上传、页面隐藏/退出上传；积分和宠物保存后会防抖触发快照上传；网络失败进入独立 outbox，冲突保留本地并提示，尚无多端自动合并 |
| 好友、串门、PK、动态流 | 尚未实现 |

## 像素世界故事口径

- 正式运行包为 `data/story-packs/05-pixel-worlds-story/manifest.json`，由 `js/pixel-story-map.js` 渲染三张世界地图和一条侦探小游戏路线。
- 首批节点使用独立 `levels/*.json`；扩展节点使用清单内联的 `background/storyText/prompt/actions` 元数据，由 `js/pixel-story-engine.js` 生成统一场景，因此每个地图节点都必须有可进入的剧情和至少两个互动动作。
- `petbank_pixel_worlds_progress_v1` 是新故事进度键。旧 04 故事包数据和 `petbank_pixel_story_progress_v1` 不得删除或迁移覆盖。
- 新故事没有数学题、正确/错误判定或学习积分统计；“认字”只通过地点名、对白和线索提示自然出现。

## 维护要求

代码与旧 `docs/` 方案冲突时，以源码、测试和本目录为准，并把漂移记录到对应工程文档。功能变更完成后，不要只更新计划；必须回填模块、数据契约或 runbook。
