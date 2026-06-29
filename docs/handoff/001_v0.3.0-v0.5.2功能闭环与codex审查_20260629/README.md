# 交接包 001 · v0.3.0→v0.5.2 功能闭环与 codex 审查

> **交接目标**：codex 对本次会话工作（约 30 次提交，v0.3.0→v0.5.2）做独立代码审查，聚焦架构一致性、回归风险、边界正确性、文档与代码对齐。
>
> **生成时间**：2026-06-29 · **当前分支**：main · **最新 tag**：v0.5.2（已 push，GitHub Pages 部署）

---

## 1. 当前目标 + 已完成边界

**本次会话目标**：把"宠物积分银行"从 v0.3.0（宠物小屋 P0 + 文档体系）推进到 v0.5.2（成熟产品态），清零现状总览的全部活跃缺口。

**已完成边界（10 大项，均带验证）**：

| # | 功能 | 版本 | 验证 |
|---|------|------|------|
| 1 | 结构化文档体系（7+ 份 + plans/changes/进度索引）| v0.3.0/v0.4.0 | 链接零死链 |
| 2 | 图片诊断修复（1104 处坏路径 + MC 原版 strip 重切 40 张）| v0.3.0-v0.3.4 | 残留 0 / 40 张 1 主块 |
| 3 | 宠物小屋 P0（home.js：5 维+4 按钮+倒下救援+点击气泡+背景接口+进化进度+微互动）| v0.3.7 | 17/17 |
| 4 | 商店家具联动（furniture.json 8 家具 + buyFurniture + 槽位兼容）| v0.3.8 | 端到端 9/9 |
| 5 | 战斗深化（skills.json 3 技能 + 道具快捷栏 + CD + 防御）| v0.3.9 | 24/24 |
| 6 | 宠物 3 动作映射修复 + MC 动作支持（提示词文档）| v0.3.5/v0.3.6 | 4/4 |
| 7 | 多孩子本地切换（ProfileManager swap，业务零改动）| v0.5.0 | 7/7 |
| 8 | 数据导出/导入（JSON 备份/恢复）| v0.5.1 | 4/4 |
| 9 | 奖励优化（盲盒 EPIC/LEGENDARY 稀有度分层 + 卡片 rarity 权重）| v0.5.2 | 3/3 |
| 10 | 综合冒烟清单（smoke.mjs 26 项）+ playwright 浏览器配置化 + 口径统一 147 | v0.4.0/工程 | 26/26 |

---

## 2. 关键产物路径 + 建议阅读顺序

**codex 审查建议顺序**：
1. 本 README（全景）
2. `背景上下文/关键发现.md`（10 项功能 + 验证体系 + 设计决策）
3. `行动项/下一步行动.md`（codex 审查建议点 + 剩余项）
4. `测试分析报告.md`（验证体系明细）
5. 代码：`js/home.js` / `js/profiles.js` / `js/shop.js` / `js/exploration.js` / `js/pet.js` / `data/{furniture,skills}.json`

**核心代码文件**：
- `js/home.js`（宠物小屋 + 家具 + 气泡 + 背景 + 进化进度）
- `js/profiles.js`（多孩子 ProfileManager swap + ProfileUI）
- `js/shop.js`（家具联动 + 盲盒稀有度）
- `js/exploration.js`（战斗 skill/item/CD/防御）
- `js/pet.js`（state 扩展 + 技能 API + feed 分流）
- `js/tools.js`（数据导出/导入）
- `data/furniture.json` / `data/skills.json`（共享目录）
- `scripts/smoke.mjs`（冒烟清单）+ `scripts/playwright-browser.mjs`（浏览器配置）

**设计文档**：`docs/plans/2026-06-29-shop-furniture-linkage-{design,implementation}.md`、`docs/plans/2026-06-29-battle-depth-design.md`、`docs/参考/banchong{宠物互动分析,账号机制分析与多孩子方案}.md`

---

## 3. 禁区（不碰）

- **不引入后端/账号体系**（本项目纯前端 GitHub Pages 定位；多孩子走本地 swap，非 banchong 式 JWT+后端）
- **不做家具 buff / 拖拽 / 多房间**（纯装饰边界，v0.3.8 设计稿固定）
- **不引入 MP / 技能树 / 物种技能 / AOE**（战斗边界，v0.3.9 设计稿固定）
- **不删原始材料**（`docs/原始需求/`、`docs/参考案例/` 保留溯源）
- **角色口径以 147 为准**（banchong91+classpet40+PVZ8+MC8，139 已证伪）

---

## 4. 接手确认协议（codex 接手第一步）

1. **先复述**：用一句话总结你理解的"本次工作 + 审查范围"
2. **等用户确认**后再动手
3. **审查时**：只读分析（不改代码），findings 写入 `docs/handoff/001_.../技术分析/` 或直接回复
4. **重点**：见 `行动项/下一步行动.md` 的「codex 审查建议点」

---

## 5. transcript 与凝蜕指向

- **当前会话 transcript**：本会话为实时交互，无 `.claude/backups/*.jsonl` 落盘（如需回溯，查 git log + CHANGELOG.md + docs/进度/）
- **凝蜕状态**：本项目未启用 `.claude/state/session-progress.md` / `.claude/memory/recent-decisions.md`（凝蜕机制未落地）。**等价状态查询**：
  - 最新进度：`docs/进度/2026-06-29-宠物小屋P0与文档体系.md` + `docs/进度/2026-06-29-文档体系二次收口与路线定稿.md`
  - 当前快照：`docs/项目现状总览.md`
  - 决策记录：`docs/方案/change-request-001|002-*.md` + `docs/plans/*-design.md`
  - 变更历史：`CHANGELOG.md`（v0.3.0→v0.5.2）

**优先级链**：本交接包（完整上下文）→ `docs/项目现状总览.md`（最新快照）→ git log（提交级回溯）。

---

## 6. 完整度模式

**完整**（10 项功能 + 验证体系 + 设计文档 + 冒烟清单齐备，非轻量占位）。

---

## 7. 下一跳建议（codex 接手第一步）

**审查本次工作**，重点 6 项（详见 `行动项/下一步行动.md`）：
1. 架构一致性（模块边界 / localStorage 键约定 / 数据流）
2. 回归风险（home.js 多轮叠加改动 / exploration.js 战斗改动 / app.js 多处接入）
3. 多孩子 swap 边界（profile_data 快照时序 / 删除当前档 / 老数据迁移幂等）
4. 战斗技能时序（CD tick 的 cdStartedThisTurn / defending 一次性清除 / 道具消耗回合）
5. 奖励权重平衡（盲盒 EV / 卡片 rarity 权重梯度）
6. 文档与代码对齐（CHANGELOG / 设计稿 / 实际实现）

审查后给出：通过 / 需修复（列 findings）/ 方向风险。

---

## 8. 剩余项（非本次范围）

- **用户手动**：生 MC 动作图（16 张）+ 背景图（6 套），代码接口已预留（home.js setHomeBg / app.js MC 动作）
- **用户并行**：docs 重构（项目现状总览/plans/changes/进度索引，部分未提交）
- **延后项**（现状总览 §6）：B 自动云同步 / PWA 离线 / PDF 成长报告 / 多孩子账户完整化
