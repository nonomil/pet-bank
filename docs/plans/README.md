# 活跃设计与实施计划

本目录只保留当前批次的计划。尚未排期但仍有价值的候选工作放在 [backlog](待办/)，已落地或只用于复盘的计划统一放在 [归档计划](../归档/计划/)；代码实现事实以 [docs_project](../../docs_project/README.md) 为准。

## 当前批次：旅行记忆与探索叙事

| 文件 | 类型 | 状态 |
| --- | --- | --- |
| [2026-07-12-叙事闭环与旅行素材审计-implementation](./2026-07-12-叙事闭环与旅行素材审计-implementation.md) | 实施 | 当前批次 |
| [2026-07-12-short-travel-chapter-design](./2026-07-12-short-travel-chapter-design.md) | 设计 | 已落地，保留验收上下文 |
| [2026-07-12-short-travel-chapter-implementation](./2026-07-12-short-travel-chapter-implementation.md) | 实施 | 已落地，保留验收上下文 |
| [2026-07-12-travel-card-composition-design](./2026-07-12-travel-card-composition-design.md) | 设计 | 当前批次 |
| [2026-07-12-travel-card-composition-implementation](./2026-07-12-travel-card-composition-implementation.md) | 实施 | 当前批次 |
| [2026-07-12-travel-memory-real-journey-e2e](./2026-07-12-travel-memory-real-journey-e2e.md) | 验收 | 当前批次 |
| [2026-07-12-星际探索故事实施计划](./2026-07-12-星际探索故事实施计划.md) | 实施 | 当前批次 |

## 仍需复核的专题计划

### 核心循环与成长体验

- [petbank-core-loop-design](待办/2026-07-11-petbank-core-loop-design.md) / [implementation](待办/2026-07-11-petbank-core-loop-implementation.md)
- [petbank-core-loop-v2-design](待办/2026-07-11-petbank-core-loop-v2-design.md) / [implementation](待办/2026-07-11-petbank-core-loop-v2-implementation.md)
- [pet-adventure-retention-design](待办/2026-07-11-pet-adventure-retention-design.md) / [implementation](待办/2026-07-11-pet-adventure-retention-implementation.md)
- [growth-review-navigation-implementation](待办/2026-07-11-growth-review-navigation-implementation.md)
- [child-journey-home-design](待办/2026-07-11-child-journey-home-design.md) / [implementation](待办/2026-07-11-child-journey-home-implementation.md)

### 学习玩法与词库

- [pinyin-racer-track-redesign](待办/2026-07-11-pinyin-racer-track-redesign.md)
- [pinyin-snake-learning-loop-design](待办/2026-07-11-pinyin-snake-learning-loop-design.md) / [pace-plan](待办/2026-07-11-pinyin-snake-pace-plan.md)
- [theme-enemy-learning-loop-implementation](待办/2026-07-11-theme-enemy-learning-loop-implementation.md)
- [vocab-governance-import-design](待办/2026-07-11-vocab-governance-import-design.md)
- [word-shooter-air-battle-design](待办/2026-07-11-word-shooter-air-battle-design.md) / [plan](待办/2026-07-11-word-shooter-air-battle-plan.md)
- [word-shooter-air-combat-design](待办/2026-07-11-word-shooter-air-combat-design.md) / [plan](待办/2026-07-11-word-shooter-air-combat-plan.md)
- [2026-07-02-汉字拼音笔画学习系统-v2-design](待办/2026-07-02-汉字拼音笔画学习系统-v2-design.md)

### 工程与资源治理

- [web-project-optimization-implementation](待办/2026-07-11-web-project-optimization-implementation.md)
- [codex-shim-deployment-hardening](待办/2026-07-11-codex-shim-deployment-hardening.md)
- [travel-memory-asset-plan](待办/2026-07-11-travel-memory-asset-plan.md)
- [travel-memory-asset-system-design](待办/2026-07-11-travel-memory-asset-system-design.md) / [implementation](待办/2026-07-11-travel-memory-asset-system-implementation.md)

## 使用规则

1. 新计划必须写清代码文件、数据影响、验证命令和完成条件。
2. 计划完成后，把最终事实回填到 `docs_project/` 对应模块/契约/runbook。
3. 已完成计划不要继续标成“当前最高优先”；移到 `docs/归档/计划/` 并保留发布或进度记录。
4. 不要在这里复制工程架构、模块 API 或 localStorage 清单。

## 待办

候选计划按主题保留在 [`待办/`](待办/)，进入执行批次前需要补充优先级、依赖、验证命令和明确状态。
