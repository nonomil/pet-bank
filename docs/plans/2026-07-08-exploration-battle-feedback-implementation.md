# 探索战斗失败反馈实施计划

> **给 Claude:** 必需子技能：使用 superpowers:executing-plans 来逐任务实施此计划。

**目标：** 为探索战斗失败结算补齐"复盘 + 下一步"提示，让孩子知道为什么需要暂停、下一次怎么更稳。

**架构：** 不改战斗数值、不改奖励、不改宠物复活流程。`js/exploration.js` 在失败时生成结构化 `battle.guidedFeedback`；`js/app.js` 统一普通攻击和道具路径的结算按钮区渲染；`css/style.css` 只补结算提示样式。

**技术栈：** Vanilla JS、Playwright 浏览器测试、docs_project 文档同步。

---

## 任务 1：新增失败反馈浏览器测试

**文件：**
- 创建：`prj/exploration_battle_guided_feedback.test.mjs`

**步骤：**
1. 打开 `index.html` 并按需加载探索模块。
2. 领养一只宠物，把 HP 调低到 3。
3. 直接创建一场强敌探索战并打开战斗弹窗。
4. 点击攻击触发失败结算。
5. 断言 `#battleActions` 包含"复盘"、"下一步"和休息/救援/宠物小屋类恢复建议。

**红灯：**
`node prj/exploration_battle_guided_feedback.test.mjs`

预期失败：结算区只有"回到宠物页"，没有复盘和下一步。

---

## 任务 2：探索系统生成结构化失败反馈

**文件：**
- 修改：`js/exploration.js`

**步骤：**
1. 新增 `buildBattleGuidedFeedback(battle, cause)`。
2. 新增 `markBattleLost(battle, cause)`，统一写入：
   - `battle.status = 'lost'`
   - `battle.guidedFeedback.note`
   - `battle.guidedFeedback.nextStep`
   - 战斗日志中的"复盘/下一步"
3. 替换逃跑失败和敌人反击两个 lost 分支。

---

## 任务 3：战斗结算 UI 渲染反馈

**文件：**
- 修改：`js/app.js`
- 修改：`css/style.css`

**步骤：**
1. 新增 `renderBattleResultGuide(battle)`。
2. 新增 `renderBattleEndActions(battle)`，统一普通攻击与道具路径的结束区。
3. 新增 `.battle-result-guide` 样式。

**绿灯：**
`node prj/exploration_battle_guided_feedback.test.mjs`

预期通过：`4/4 passed`。

---

## 任务 4：同步回归与文档

**文件：**
- 修改：`scripts/run-full-regression.mjs`
- 修改：`docs_project/modules/exploration.md`
- 修改：`docs_project/runbooks/testing-and-release.md`
- 修改：`docs_project/review/reference-case-analysis.md`

**步骤：**
1. 把 `prj/exploration_battle_guided_feedback.test.mjs` 纳入全量回归。
2. runbook 全量测试数更新到 22。
3. 探索模块文档补 `battle.guidedFeedback` 数据流、UI 渲染位置、验证命令。
4. 参考案例原则 5 标记为数学PK/探索小题/探索战斗已完成轻量复盘，剩余报告层聚合。

---

## 验证清单

```bash
node prj/exploration_battle_guided_feedback.test.mjs
node prj/exploration_math_feedback.test.mjs
node prj/math_pk_guided_feedback_contract.test.mjs
node scripts/run-full-regression.mjs
```
