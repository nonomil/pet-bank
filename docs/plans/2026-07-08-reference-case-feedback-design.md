# 参考案例差距改造一期设计稿

> 关联审查: `docs_project/review/reference-case-analysis.md`
> 本期范围: 失败保护、难度推荐、下一步建议

## 目标

把参考案例《我要上清北》中最值得借鉴的两条原则先落进现有玩法闭环：

- 失败不是惩罚，而是告诉孩子“刚才卡在哪里、下一次怎么试”。
- 难度不是“越难越好”，而是“哪个更适合我现在练”。

本期不做学习中心大重构、不做家长报告错题库、不引入 AI 分析。先用轻量规则和现有运行数据，让数学 PK 与探索小题的反馈更像导航，而不是单纯输赢提示。

## 需求

1. 数学 PK 的难度选择要展示“适合谁”和“为什么推荐”，避免只显示题型范围。
2. 数学 PK 结算页要在输、平、赢之外展示一条复盘说明和一条下一局建议。
3. 数学 PK 低正确率、输给机器人、乘法模式卡住时，要给不同的儿童友好策略。
4. 探索小题答错时，保留鼓励语，并显示“下一步怎么观察/怎么算”的提示。
5. 所有新增文案禁止使用打击性表达，例如“差、笨、失败、错误太多”。
6. 修改后同步 `docs_project/modules/math-pk.md` 与 `docs_project/modules/exploration.md`。

## 非目标

- 不记录完整错题历史。
- 不做个性化推荐算法。
- 不改家庭成长报告 `family-review.js`。
- 不抽离 `learn-center.js` 的学习单模板。
- 不改变积分、星轨、支援卡奖励规则。
- 不改变数学题生成算法。

## 现状

### 数学 PK

关键文件: `js/math-pk.js`

- `DIFFICULTY_OPTIONS` 在 `math-pk.js:44-49`，目前只有 `label` 和 `desc`。
- 大厅难度面板 `_difficultyPanel()` 在 `math-pk.js:636-654`，只展示名称与题型描述。
- 设置页难度面板 `renderDifficultySetting()` 在 `math-pk.js:989` 附近，也只展示当前难度选项。
- 结算 UI `render.result(data)` 在 `math-pk.js:950-986`，显示输赢、比分、成长分、答对数、星轨。
- `_endMatch()` 在 `math-pk.js:1518-1622`，汇总 `humanWins`、`robotWins`、`correctCount`、`maxCombo`、`starsEarned`。

当前问题是：结算能告诉孩子“发生了什么”，但还不够告诉孩子“下一次怎么做”。

### 探索小题

关键文件: `js/exploration-detail.js`

- `answerMath(correct, exp, msg, hint, explanation)` 在 `exploration-detail.js:198-218`。
- 题目按钮传入 `hint` 和 `explanation`，入口在 `exploration-detail.js:262-276`。
- 答错时已有固定鼓励语和可选 `hint`，没有统一的“下次策略”兜底。

当前问题是：有的故事题有提示，有的只有“答错了……继续探索吧”，语气和参考案例的失败保护目标不一致。

## 方案

### 1. 难度推荐文案

扩展 `DIFFICULTY_OPTIONS`，新增字段：

```javascript
{
    id: 'easy20',
    label: '加减起步',
    desc: '20 以内加减',
    fitFor: '适合刚开始热身',
    reason: '数字小，更容易把注意力放在观察题目上。'
}
```

大厅 `_difficultyPanel()` 和设置页 `renderDifficultySetting()` 都展示 `fitFor` 与 `reason`。如果空间有限，大厅展示两行，设置页展示完整说明。

### 2. 数学 PK 结算复盘

新增一个纯函数，例如 `buildGuidedFeedback(summary)`，输入：

```javascript
{
    difficulty,
    humanWins,
    robotWins,
    correctCount,
    total,
    maxCombo,
    multiplicationCorrectCount,
    win
}
```

输出：

```javascript
{
    title: '这局你最接近胜利的地方',
    note: '你已经能连续答对 2 题，说明节奏起来了。',
    nextStep: '下一局先慢读题，再按确定的答案出手。'
}
```

规则保持简单：

- `correctCount === 0`: 先建议回到低一档或训练模式。
- `correctCount / total < 0.5`: 建议“先慢读题、看清符号”。
- 输给机器人但正确率不低: 建议“先保准确，再练速度”。
- `maxCombo >= 2`: 强化已经做到的部分。
- `difficulty === 'medium_mul'`: 优先给乘法分组/连加策略。
- 赢了: 给“继续挑战或换档”的建议，而不是只夸奖。

### 3. 探索小题失败保护

新增一个小工具函数，例如 `buildMathRetryHint(hint, explanation)`：

- 有 `hint`: 显示“下一步：${hint}”
- 有 `explanation`: 显示“复盘：${explanation}”
- 都没有: 显示默认策略“先把题目里的数量圈出来，再决定用加法还是减法。”

答错文案从“答错了……”改为“这次还差一点，先换个观察顺序。”，避免负面标签。

### 4. 文档同步

更新：

- `docs_project/modules/math-pk.md`: 新增“引导式反馈”说明，记录新增函数和结算数据流。
- `docs_project/modules/exploration.md`: 新增“探索数学题反馈”说明，记录 `answerMath()` 的行为。

## 测试设计

新增静态契约测试：

`prj/math_pk_guided_feedback_contract.test.mjs`

检查内容：

- `DIFFICULTY_OPTIONS` 包含 `fitFor` 和 `reason` 字段。
- `math-pk.js` 包含 `buildGuidedFeedback`。
- 结算页渲染包含复盘与下一局建议相关文案。
- 新文案不包含禁止词：`笨`、`太差`、`失败了`、`错太多`。
- `exploration-detail.js` 包含统一的下一步策略函数或文案。

复用既有专项测试：

```bash
node prj/math_pk_fx_contract.test.mjs
node prj/exploration_math_feedback.test.mjs
```

如涉及页面流程，再补：

```bash
node scripts/learning-center-smoke.mjs
```

本期通常不需要全量回归；若修改范围扩大到 `app.js`、路由、积分主链路，再跑：

```bash
node scripts/run-full-regression.mjs
```

## 验收标准

- 难度面板不再只有题型描述，能看出“适合谁、为什么”。
- 数学 PK 每局结算都至少出现一条复盘说明和一条下一步建议。
- 探索小题答错时没有“答错了……”这类收口文案。
- 新增契约测试通过。
- 既有数学 PK 特效测试、探索数学反馈测试通过。
- `docs_project` 链接检查通过。
