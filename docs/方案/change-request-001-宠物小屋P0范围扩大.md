# Change Request 001 — 宠物小屋 P0 范围扩大

> solution-loop 阶段 12 Change/Rebaseline 支线登记。未通过 rebaseline-check 前，方案不冻结、不进执行。

## 变更内容
P0-1「宠物小屋」MVP 范围扩大，将原 P1 内容纳入 P0：

| 原归属 | 项 | 新归属 |
|--------|-----|--------|
| P1-1 | 衰减闭环（decay API + last_home_ts 按小时结算） | **P0-1** |
| P1-2 | 倒下救援 CTA + 复活动画 | **P0-1** |
| P1-1 | 改造 feed/play/rest 写 hunger/intimacy/exp | **P0-1** |
| 新增 | bath（洗澡）API + 第 4 互动按钮 | **P0-1** |
| — | EXP 5 维常驻（不降级到次级面板） | **P0-1** |

## 触发
solution-loop 阶段 2 `/gate` direction-check 用户决策（2026-06-29）：
- 「P0 是否含衰减闭环+救援」→ **含**
- 「EXP 显示」→ **5 维常驻**
- 「P0 互动按钮数」→ **4 个（含洗澡）**

## 影响文档（需逐层更新）
- `docs/路线/差距清单与开发路线图.md` — P1-1/P1-2 条目移入 P0-1，标注本 CR 引用
- `docs/规格/需求规格书.md` — §2.2 四互动按钮（喂食/玩耍/洗澡/治疗）确认 P0 化；§7.2 优先级同步
- `docs/方案/宠物小屋-方案.md` — 返工：吸收三步审查裁决的 5 条阻断修正 + 新 P0 范围

## 裁决要求的阻断修正（返工方案必须吸收）
1. **last_home_ts 单一归属**：归 `PetSystem.state.last_home_ts`（home.js 离开时写），加 `if null skip` 守卫 + `hours = max(0, floor(...))` 防时间篡改
2. **switchPage + nav 注册**：接入步骤补「home tab 在 app.js nav 数组注册 + switchPage case」，列为 AC
3. **AC-5 喂食口径**：feed 改造后口径「饱食+25 / 经验+10 / 积分-10」（对齐规格书 §5.3），并附 feed 改造的 inventory useItem 回归测试点
4. **EXP 5 维常驻**：顶部状态条 HP/饱食/快乐/亲密/经验 5 维常驻（对齐规格书 §2.2），饱食/亲密无数据源时显示占位
5. **bath 新 API 设计**：明确洗澡的语义（提升清洁度/快乐？）、与 4 按钮（喂食/玩耍/洗澡/治疗）的映射（治疗=rest 还是独立 heal）

## 新增风险
- **feed/play/rest 改造回归**：inventory.js useItem 调用链依赖现有 feed 语义，改造须回归
- **bath 是新 API**：pet.js 无依托，需从 0 设计
- **P0 工作量显著增大**：原 MVP（静态家园）→ 含衰减+救援+API 改造+新按钮，开发与测试成本上升

## rebaseline 要求
- [ ] 差距清单 P1→P0 标注完成
- [ ] 方案返工完成（吸收 5 条阻断修正 + 新范围）
- [ ] adjudicator 复核 verdict（重审）
- [ ] rebaseline-check 通过
- 以上全部完成前，不得进入执行阶段
