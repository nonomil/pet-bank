# 宠物积分系统工程文档索引

> 当前工程基线：2026-07-12。先读仓库根目录 `AGENTS.md`，再按任务进入本目录。代码和验证入口是事实来源，模块文档中的行号可能随迭代漂移。

## 快速导航

| 文档 | 用途 |
| --- | --- |
| [../AGENTS.md](../AGENTS.md) | 当前架构事实、核心规矩、技术债和修改流程 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Repo Map、启动链路、核心流程、模块和风险 |
| [CURRENT-STATE.md](./CURRENT-STATE.md) | 当前实现快照、能力状态和代码入口 |
| [../docs/工程/架构/数据架构与账号流程.md](../docs/工程/架构/数据架构与账号流程.md) | 面向产品与部署协作的账号、SQLite、快照和 Hermes 当前口径 |
| [conventions/](conventions/) | 命名、模块、错误处理和编码约定 |
| [data-contracts/](data-contracts/) | localStorage key、宠物/内容数据契约 |
| [modules/](modules/) | 各业务模块原理、入口和公开 API |
| [runbooks/](runbooks/) | 本地运行、测试、发布、自托管和清理 |
| [rules/](rules/) | 代码改动与文档同步规则 |
| [文档生命周期](../docs/文档生命周期.md) | 活跃文档、历史方案和归档资料的边界 |
| [../docs/方案/项目路线/07-当前扫描与优化方案-2026-07-12.md](../docs/方案/项目路线/07-当前扫描与优化方案-2026-07-12.md) | 当前扫描合并后的优化优先级、工作包和验收 |

## 当前模块文档

| 领域 | 文档 | 当前代码 |
| --- | --- | --- |
| 任务与积分 | [task-points.md](modules/task-points.md) | `js/app.js`、奖励服务 |
| 宠物养成 | [pet-system.md](modules/pet-system.md) | `js/pet.js`、照料/成长模块 |
| 宠物小屋 | [home-system.md](modules/home-system.md) | `js/home.js`、`js/travel-memory.js` |
| 探索冒险 | [exploration.md](modules/exploration.md) | `js/exploration*.js`、战斗/语音 |
| 卡牌 | [card-system.md](modules/card-system.md) | `js/card-*.js` |
| 数学 PK | [math-pk.md](modules/math-pk.md) | `js/math-pk.js` |
| 学习中心 | [learn-center.md](modules/learn-center.md) | `js/learn-center.js`、词汇/汉字 |
| 商城与背包 | [shop-inventory.md](modules/shop-inventory.md) | `js/shop.js`、`js/inventory.js` |
| Runtime Loader | [runtime-loader.md](modules/runtime-loader.md) | `js/runtime-loader.js` |
| 遛弯 | [walk.md](modules/walk.md) | `js/walk.js` |
| 音效/语音/汉字/宝箱/工具 | [misc.md](modules/misc.md) | 对应 `js/` 模块 |
| 本地 profile/复盘 | [social-household.md](modules/social-household.md) | `js/profiles.js`、`js/family-review.js` |
| 自托管后端边界 | [cloud-sync.md](modules/cloud-sync.md) | `prj/petbank-server/` |

`social-household.md` 和 `cloud-sync.md` 区分当前已接入的账号/家庭/孩子管理、基础快照生命周期和 outbox；词卡进度/review events 已有受限自动合并，但积分/宠物等通用业务的自动多端合并及好友/社交能力仍未实现。不要把其中任一层级混写成“完整云同步已上线”。

## 数据与运行

- [localstorage-keys.md](data-contracts/localstorage-keys.md)：运行时 key、owner、scope、迁移和共享风险。
- [pets-schema.md](data-contracts/pets-schema.md)：`data/pets.json` 结构。
- [testing-and-release.md](runbooks/testing-and-release.md)：静态服务、Pages 快速门禁、全量回归和制品验证。
- [lifecycle-and-time.md](runbooks/lifecycle-and-time.md)：日切、时间单位、Profile reload、timer 生命周期。
- [self-hosted/README.md](runbooks/self-hosted/README.md)：SQLite 后端、共享数据目录、备份和发布。

## 面向 AI/开发者的最短流程

1. 读 `AGENTS.md`、`CURRENT-STATE.md` 和 `ARCHITECTURE.md`，确认当前功能是否真的存在。
2. 按业务进入对应 `modules/`、`data-contracts/` 和 `runbooks/`。
3. 修改存储、奖励、时间、路由或发布资源时，先找全部读写者和验证入口。
4. 修改实现后同步契约文档；新增测试/脚本要加入 runbook 或回归入口。
5. 用与改动范围匹配的 contract/simulation 验证，最后复核 `git diff` 和工作树边界。
