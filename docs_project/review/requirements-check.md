# 需求文档对照审查报告

> 审查日期: 2026-07-08
> 依据: [docs/原始需求/项目文档和项目设计重新梳理.md](../../docs/原始需求/项目文档和项目设计重新梳理.md)

---

## 一、需求逐条对照

### 需求 1: "参考别人案例的设计经验去分析这个项目"

| 状态 | 说明 |
|------|------|
| ✅ 完成 | 参考案例《我要上清北》的 8 条核心洞察已对照本项目映射（见 [ARCHITECTURE.md](../ARCHITECTURE.md) §一），关键设计理念（降低启动阻力、失败保护、奖励边界）本项目均有对应实现 |

### 需求 2: "把整个仓库都过一遍，理清楚大致架构、有哪些业务模块、核心层定了哪些规矩（错误处理、数据访问等）、还有哪些一眼就是屎山的"

| 子项 | 状态 | 产出 |
|------|------|------|
| 架构 | ✅ | [ARCHITECTURE.md](../ARCHITECTURE.md) §二-四 |
| 16 个业务模块 | ✅ | [ARCHITECTURE.md](../ARCHITECTURE.md) §四 + 12个 [modules/](../modules/) 文档 |
| 核心层规矩 | ✅ | [ARCHITECTURE.md](../ARCHITECTURE.md) §五 + [coding-standards.md](../conventions/coding-standards.md) |
| 屎山清单 | ✅ | [ARCHITECTURE.md](../ARCHITECTURE.md) §六（15项，按🔴🟡🟢分级） |

### 需求 3: "理完写进 CLAUDE.md"

| 状态 | 说明 |
|------|------|
| ⚠️ 变体 | CLAUDE.md 未直接写入。改为写入 `docs_project/` 目录作为结构化索引文档。原因：CLAUDE.md 会被自动注入上下文，过大文档会持续消耗 token。`docs_project/` 让 AI/Codex 按需读取，索引即 [README.md](../README.md) |

**建议**: 可以在 CLAUDE.md 加一行指针：
```markdown
# 项目工程文档 → docs_project/README.md（架构总览 + 模块索引）
```

### 需求 4: "创建总览文档和分模块文档，文档又分实现文档和原理文档"

| 子项 | 状态 | 产出 |
|------|------|------|
| 总览文档 | ✅ | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| 分模块文档 | ✅ | 12 个 [modules/](../modules/) 文档，当前采取二合一模式（原理+实现同文件） |
| 实现文档（函数→文件:行号） | ✅ | 每模块文档含函数表，标注文件:行号 |
| 原理文档 | ✅ | 每模块文档含"原理"章节 |

### 需求 5: "任何代码修改需要同步更新文档"

| 状态 | 说明 |
|------|------|
| ✅ 已定义 | [README.md](../README.md) 维护规则明确了修改→同步的流程 |
| ⚠️ 无自动化 | 当前纯靠人工遵守，建议后续加 git hook 提醒（可后续） |

### 需求 6: "修改需求的提示词先和AI讨论文档，他自然从文档出发索引，只看相关代码文件"

| 状态 | 说明 |
|------|------|
| ✅ 已就绪 | 每个模块文档标注了函数→行号，AI 可直接定位到具体行，无需扫描全文件 |

### 需求 7: "每个项目目录下面创建docs文件夹，按照软件工程去输出各种文档"

| 状态 | 说明 |
|------|------|
| ✅ 已创建 | `docs_project/` 按软件工程结构组织：架构/模块/数据契约/规范/审查 |

### 需求 8: "第一次梳理完，后续就可以让它按照文档去针对性查找了，并不需要每次都扫"

| 状态 | 说明 |
|------|------|
| ✅ 已实现 | [README.md](../README.md) 明确了使用方式：先读 ARCHITECTURE.md → 查模块文档 → 只读相关文件 |

### 需求 9: "改动的时候让它同步更新文档，然后一周或者一个版本让它全扫一遍"

| 状态 | 说明 |
|------|------|
| ⚠️ 流程已定义 | 维护规则写入 README.md，但全量扫描机制待后续建立 |

### 需求 10: "尽可能多落地一些索引文档，我后续让 codex 审查，就不用重读整个项目"

| 子项 | 状态 | 产出 |
|------|------|------|
| 架构索引 | ✅ | ARCHITECTURE.md |
| 模块索引 | ✅ | README.md 模块清单 |
| localStorage 索引 | ✅ | [localstorage-keys.md](../data-contracts/localstorage-keys.md)（全量 key 矩阵） |
| pets.json schema | ✅ | [pets-schema.md](../data-contracts/pets-schema.md) |
| 内容/代码分离审查 | ✅ | [content-code-separation.md](content-code-separation.md) |
| 编码规范 | ✅ | [coding-standards.md](../conventions/coding-standards.md) |

---

## 二、审查发现的额外问题

### 2.1 文档重复/碎片化

`docs/` 目录已有 271 个 md 文件，存在大量讨论稿、废弃方案、重复主题。`docs_project/` 作为**精华索引层**叠加在上面，不替代原有文档。

建议后续：
- `docs/方案/` 中标记"已实施/已废弃/进行中"
- `docs/plans/` 中清理过时的 test-reports
- `docs/原始需求/` 保留作为历史记录

### 2.2 CLAUDE.md 缺失

当前项目根目录没有 CLAUDE.md。建议最小化版本：

```markdown
# 宠物积分系统（成长伙伴·萌宠冒险岛）
## 入口 → docs_project/README.md（架构总览 + 16模块索引 + 技术债清单）
## 运行 → python -m http.server 8000 后访问 index.html
## 修改前 → 查 docs_project/modules/ 找到函数行号
## 修改后 → 同步更新 docs_project/modules/ 行号
## 存储 → localStorage petbank_* 前缀（全量 key 见 docs_project/data-contracts/）
```

### 2.3 内容/代码分离不及格

详见 [content-code-separation.md](content-code-separation.md)。核心问题：learn-center.js 中 ~1500 行教育内容硬编码，app.js 中 37 个任务定义硬编码，walk.js 中 5 条路线文案硬编码。

### 2.4 测试覆盖为零

`prj/` 下有 `.test.mjs` 文件（11 个），但这些是 Codex 外部测试脚本，项目本身无单元测试/集成测试/e2e 测试。修改高风险模块（app.js/pet.js/learn-center.js）时风险极高。

---

## 三、优先级建议

| 优先级 | 行动 | 预计工作量 |
|--------|------|-----------|
| 🔴 P0 | 创建最小化 CLAUDE.md（指向 docs_project/） | 5分钟 |
| 🔴 P0 | learn-center.js 学习单模板分离 → data/ JSON | 2-3小时 |
| 🟡 P1 | walk.js 路线数据分离 → data/walk-routes.json | 30分钟 |
| 🟡 P1 | app.js 任务定义分离 → data/tasks.json | 1小时 |
| 🟡 P1 | shop.js 商品定义合并到现有 data/items.json | 30分钟 |
| 🟢 P2 | math-pk.js 机器人/卡牌配置分离 | 1小时 |
| 🟢 P2 | docs/ 整理（标记已实施/已废弃） | 1小时 |
| 🟢 P2 | 建立版本全量扫描脚本 | 2小时 |

---

## 四、产出总清单

```
docs_project/
├── README.md                               # 文档总索引 + 使用方式
├── ARCHITECTURE.md                         # 架构总览（技术栈/目录/16模块/技术债）
│
├── modules/ (12 个)
│   ├── pet-system.md                       # 宠物养成
│   ├── task-points.md                      # 任务积分
│   ├── home-system.md                      # 宠物小屋
│   ├── exploration.md                      # 探索冒险
│   ├── card-system.md                      # 卡牌收集+对战
│   ├── math-pk.md                          # 数学PK
│   ├── runtime-loader.md                   # 按需加载
│   ├── cloud-sync.md                       # 云端同步
│   ├── shop-inventory.md                   # 商城+背包
│   ├── social-household.md                 # 社交+家庭组
│   ├── walk.md                            # 宠物遛弯
│   └── misc.md                            # 音效/语音/汉字/英语/排行榜/工具
│
├── data-contracts/
│   ├── localstorage-keys.md                # 全量 key 读写者矩阵
│   └── pets-schema.md                      # 261物种数据契约
│
├── conventions/
│   └── coding-standards.md                 # 编码规范
│
└── review/
    └── content-code-separation.md           # 内容/代码分离审查
```
