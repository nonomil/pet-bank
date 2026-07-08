# 宠物积分系统 —— 工程文档索引

> 本目录承载结构化工程文档。首次全仓库扫描生成于 2026-07-08，2026-07-08 修正。
> 代码修改需同步更新对应文档。

## 快速导航

| 文档 | 用途 | 读者 |
|------|------|------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 架构总览、模块全景、技术债清单 | 所有人 |
| [conventions/](conventions/) | 编码规范（错误处理、命名、模块模式） | 开发者 |
| [data-contracts/](data-contracts/) | 数据契约（localStorage keys、JSON schema） | 开发者/Codex |
| [modules/](modules/) | 分模块实现文档（原理+函数→行号） | 开发者/Codex |
| [review/](review/) | 审查报告（内容分离+需求对照） | 所有人 |
| [runbooks/](runbooks/) | 运行与验证（本地启动、回归测试、smoke） | 开发者/Codex |
| [rules/](rules/) | 维护规则（代码改了什么要同步哪些文档） | 开发者 |

## 分模块文档

| 模块 | 文档 | 核心文件 |
|------|------|---------|
| 任务积分系统 | [task-points.md](modules/task-points.md) | js/app.js |
| 宠物养成 | [pet-system.md](modules/pet-system.md) | js/pet.js |
| 宠物小屋 | [home-system.md](modules/home-system.md) | js/home.js |
| 探索冒险 | [exploration.md](modules/exploration.md) | js/exploration.js |
| 卡牌收集+对战 | [card-system.md](modules/card-system.md) | js/card-*.js |
| 数学PK | [math-pk.md](modules/math-pk.md) | js/math-pk.js |
| 学习中心 | [learn-center.md](modules/learn-center.md) | js/learn-center.js |
| 商城+背包 | [shop-inventory.md](modules/shop-inventory.md) | js/shop.js, js/inventory.js |
| 社交+家庭组 | [social-household.md](modules/social-household.md) | js/social.js, js/household.js |
| 云端同步 | [cloud-sync.md](modules/cloud-sync.md) | js/cloud-*.js |
| 运行时加载器 | [runtime-loader.md](modules/runtime-loader.md) | js/runtime-loader.js |
| 宠物遛弯 | [walk.md](modules/walk.md) | js/walk.js |
| 音效/语音/汉字/宝箱/工具 | [misc.md](modules/misc.md) | js/sfx.js, js/voice.js, js/hanzi-game.js, js/treasure.js, js/tools.js |

> **注**: 宝箱(treasure)、语音(voice)、家长工具(tools) 当前合并在 misc.md。待模块稳定后拆分独立文档。

## 运行与验证

| 文档 | 内容 |
|------|------|
| [testing-and-release.md](runbooks/testing-and-release.md) | 本地启动、全量回归、smoke、验证入口 |

## 数据契约

| 文档 | 内容 |
|------|------|
| [localstorage-keys.md](data-contracts/localstorage-keys.md) | 所有 petbank_* key 的读写者清单 |
| [pets-schema.md](data-contracts/pets-schema.md) | pets.json 字段说明（261 物种） |

## 维护规则

| 文档 | 内容 |
|------|------|
| [documentation-sync-rules.md](rules/documentation-sync-rules.md) | 代码改动→文档同步规则 |

## 审查报告

| 文档 | 内容 |
|------|------|
| [reference-case-analysis.md](review/reference-case-analysis.md) | 参考案例《我要上清北》9条设计原则逐条对照 |
| [content-code-separation.md](review/content-code-separation.md) | 内容/代码分离审查（20项问题，分三期改造） |
| [requirements-check.md](review/requirements-check.md) | 原始需求逐条对照审查 |

## 使用方式

### 对 AI/Codex

```
1. 先读 ARCHITECTURE.md 理解全局
2. 根据任务查 modules/ 找到相关函数和行号
3. 修改代码后同步更新模块文档
4. 涉及存储变更时更新 data-contracts/
5. 修改完成后参考 runbooks/ 跑验证
```

### 对人类开发者

```
1. 新增模块 → 在 modules/ 创建对应文档
2. 修改函数签名 → 更新模块文档中的函数表
3. 新增 localStorage key → 在 localstorage-keys.md 注册
4. 新增测试/脚本 → 在 runbooks/ 记录
5. 一个版本后 → 全量扫描验证行号
```

## 维护规则

- **实现文档**：记载"哪个函数在哪个文件第几行"（**必须核实后写入**）
- **原理文档**：解释"为什么这样设计"
- 当前采取二合一模式（原理+实现在同一文件）
- 任何代码修改需同步更新文档中的行号
- 每周或每个版本后全量扫描一次，确保文档与代码一致
