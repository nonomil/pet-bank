# 参考案例差距改造一期实施计划

> **给 Claude:** 必需子技能：使用 superpowers:executing-plans 来逐任务实施此计划。

**目标：** 为数学 PK 与探索小题补齐“难度推荐、失败复盘、下一步建议”的轻量反馈闭环。

**架构：** 不改题库、不改奖励、不引入新框架。以 `js/math-pk.js` 的难度配置与结算数据为输入生成引导文案；以 `js/exploration-detail.js` 的 `hint/explanation` 为输入生成探索小题的下一步提示。同步更新 `docs_project` 模块文档。

**技术栈：** Vanilla JS、静态契约测试 `.mjs`、Playwright 探索专项测试。

---

## 任务 1：新增数学 PK 引导反馈契约测试

**文件：**
- 创建：`prj/math_pk_guided_feedback_contract.test.mjs`
- 读取：`js/math-pk.js`
- 读取：`js/exploration-detail.js`

**步骤 1：编写失败的测试**

创建 `prj/math_pk_guided_feedback_contract.test.mjs`：

```javascript
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const mathPk = fs.readFileSync(path.join(repoRoot, 'js', 'math-pk.js'), 'utf8');
const explorationDetail = fs.readFileSync(path.join(repoRoot, 'js', 'exploration-detail.js'), 'utf8');

[
    'fitFor',
    'reason',
    'buildGuidedFeedback',
    '复盘',
    '下一局',
    '适合'
].forEach((needle) => {
    assert.ok(mathPk.includes(needle), `math-pk.js should contain guided feedback marker: ${needle}`);
});

assert.ok(
    /DIFFICULTY_OPTIONS[\s\S]*fitFor[\s\S]*reason/.test(mathPk),
    'difficulty options should include fitFor and reason'
);

assert.ok(
    /result\(data\)[\s\S]*guidedFeedback|result\(data\)[\s\S]*nextStep/.test(mathPk),
    'result view should render guided feedback'
);

assert.ok(
    /buildMathRetryHint|下一步/.test(explorationDetail),
    'exploration math feedback should expose a next-step retry hint'
);

[
    '笨',
    '太差',
    '失败了',
    '错太多'
].forEach((badWord) => {
    assert.equal(mathPk.includes(badWord), false, `math-pk.js should avoid discouraging word: ${badWord}`);
    assert.equal(explorationDetail.includes(badWord), false, `exploration-detail.js should avoid discouraging word: ${badWord}`);
});

console.log('PASS math_pk_guided_feedback_contract');
```

**步骤 2：运行测试以验证它失败**

运行：

```bash
node prj/math_pk_guided_feedback_contract.test.mjs
```

预期：失败，提示缺少 `fitFor` / `reason` / `buildGuidedFeedback` 等标记。

---

## 任务 2：扩展数学 PK 难度配置与大厅面板

**文件：**
- 修改：`js/math-pk.js:44-49`
- 修改：`js/math-pk.js:636-654`

**步骤 1：为难度配置补推荐字段**

把 `DIFFICULTY_OPTIONS` 从：

```javascript
{ id: 'easy20', label: '加减起步', desc: '20 以内加减' }
```

扩展为：

```javascript
{
    id: 'easy20',
    label: '加减起步',
    desc: '20 以内加减',
    fitFor: '适合刚开始热身',
    reason: '数字小，更容易先看清题目和符号。'
}
```

五个难度都要补齐：

- `easy20`: 刚开始热身，看清符号。
- `easy100`: 已能稳定做 20 以内，练进位和退位。
- `medium_mul`: 刚开始乘法，用“几组几个”理解。
- `medium_mix`: 想练切换思路，加减乘混合。
- `hard`: 已经比较熟，练速度和抗干扰。

**步骤 2：更新大厅难度面板**

在 `_difficultyPanel()` 的按钮内，保留 `label/desc`，新增：

```javascript
<small>${escapeHtml(option.fitFor || '')}</small>
<em>${escapeHtml(option.reason || '')}</em>
```

如果使用 `<em>`，同步在同一个 style 注入区补 `.mathpk-difficulty-option em` 样式，确保手机上不溢出。

**步骤 3：运行契约测试**

运行：

```bash
node prj/math_pk_guided_feedback_contract.test.mjs
```

预期：仍失败，因为还没实现 `buildGuidedFeedback` 和探索下一步提示。

---

## 任务 3：更新设置页难度面板

**文件：**
- 修改：`js/math-pk.js:989-1020` 附近

**步骤 1：同步展示推荐理由**

在 `renderDifficultySetting(containerId)` 中，每个难度选项展示：

- `o.label`
- `o.desc`
- `o.fitFor`
- `o.reason`

要求：设置页文案比大厅略完整，家长能看懂“为什么推荐这个档”。

**步骤 2：运行现有数学 PK 合约**

运行：

```bash
node prj/math_pk_fx_contract.test.mjs
```

预期：通过，说明没有破坏数学 PK 样式/特效标记。

---

## 任务 4：新增数学 PK 结算复盘函数

**文件：**
- 修改：`js/math-pk.js`，建议放在 `render` 对象前或 `render.result()` 前的工具函数区
- 修改：`js/math-pk.js:1518-1622`

**步骤 1：实现纯函数**

新增：

```javascript
function buildGuidedFeedback(summary) {
    const data = summary || {};
    const total = Math.max(1, Number(data.total || CONFIG.TOTAL_ROUNDS || 1));
    const correctCount = Number(data.correctCount || 0);
    const ratio = correctCount / total;
    const difficulty = normalizeDifficulty(data.difficulty || state.mathDifficulty);
    const win = !!data.win;
    const maxCombo = Number(data.maxCombo || 0);

    if (difficulty === 'medium_mul' && ratio < 0.7) {
        return {
            note: '这局最值得练的是把乘法看成“几组几个”。',
            nextStep: '下一局先数有几组，再数每组几个，最后再写乘法。'
        };
    }
    if (correctCount === 0) {
        return {
            note: '这局题目节奏有点快，先把观察顺序找回来。',
            nextStep: '下一局先慢读题，再点答案；也可以换到更适合热身的难度。'
        };
    }
    if (ratio < 0.5) {
        return {
            note: '你已经开始抓到题目了，还需要多一点确认时间。',
            nextStep: '下一局先看符号，再算数字，确定后再出手。'
        };
    }
    if (!win) {
        return {
            note: maxCombo >= 2 ? '你已经能连续答对，说明方法是对的。' : '你答对了一些题，准确度正在变稳。',
            nextStep: '下一局先保准确，再慢慢追速度。'
        };
    }
    return {
        note: maxCombo >= 2 ? '你这局已经打出连续思考节奏。' : '你完成了这一局挑战。',
        nextStep: '下一局可以继续巩固，也可以试试更适合挑战的新难度。'
    };
}
```

**步骤 2：把反馈传入 `render.result()`**

在 `_endMatch()` 的 `render.result({ ... })` 参数中加入：

```javascript
difficulty: state.mathDifficulty,
guidedFeedback: buildGuidedFeedback({
    difficulty: state.mathDifficulty,
    humanWins: state.humanWins,
    robotWins: state.robotWins,
    correctCount: state.correctCount,
    multiplicationCorrectCount: state.multiplicationCorrectCount,
    maxCombo: state.maxCombo,
    total: CONFIG.TOTAL_ROUNDS,
    win: win
})
```

异步模式可以暂不加，避免影响好友 PK 提交流程。

**步骤 3：运行契约测试**

运行：

```bash
node prj/math_pk_guided_feedback_contract.test.mjs
```

预期：可能仍失败，因为 `render.result()` 还没展示。

---

## 任务 5：渲染数学 PK 结算建议

**文件：**
- 修改：`js/math-pk.js:950-986`

**步骤 1：在 `render.result(data)` 中读取反馈**

在非 async 分支中新增：

```javascript
const guidedFeedback = data.guidedFeedback || buildGuidedFeedback(data);
```

**步骤 2：在结算 HTML 中展示**

在星轨与解锁文案后、按钮前插入：

```javascript
<div class="mathpk-result-guide">
    <strong>复盘</strong>
    <p>${escapeHtml(guidedFeedback.note || '')}</p>
    <strong>下一局</strong>
    <p>${escapeHtml(guidedFeedback.nextStep || '')}</p>
</div>
```

同文件样式注入区补：

```css
.mathpk-result-guide {
    margin:12px auto 10px;
    max-width:420px;
    padding:10px 12px;
    border-radius:14px;
    background:rgba(255,255,255,.1);
    border:1px solid rgba(255,255,255,.14);
    text-align:left;
}
.mathpk-result-guide strong { display:block; color:#ffd166; font-size:.82rem; margin-top:4px; }
.mathpk-result-guide p { margin:3px 0 6px; line-height:1.5; font-size:.88rem; opacity:.9; }
```

**步骤 3：运行契约测试**

运行：

```bash
node prj/math_pk_guided_feedback_contract.test.mjs
```

预期：数学 PK 部分通过；如果探索提示尚未实现，仍失败。

---

## 任务 6：改探索小题答错反馈

**文件：**
- 修改：`js/exploration-detail.js:198-218`

**步骤 1：新增下一步提示函数**

在 `answerMath()` 前新增：

```javascript
function buildMathRetryHint(hint, explanation) {
    if (hint) return `下一步：${hint}`;
    if (explanation) return `复盘：${explanation}`;
    return '下一步：先把题目里的数量圈出来，再决定用加法、减法还是乘法。';
}
```

**步骤 2：替换答错分支文案**

把当前答错分支：

```javascript
const parts = ['<span class="galgame-warn">这次记录还差一点点。</span>'];
...
parts.push('<span class="galgame-warn">答错了……继续探索吧。</span>');
```

改成：

```javascript
const parts = ['<span class="galgame-warn">这次还差一点，先换个观察顺序。</span>'];
parts.push(`<span class="galgame-hint">${buildMathRetryHint(hint, explanation)}</span>`);
```

如果有 `explanation`，可以额外展示一行：

```javascript
if (hint && explanation) {
    parts.push(`<span class="galgame-explanation">复盘：${explanation}</span>`);
}
```

**步骤 3：运行探索专项测试**

运行前确保本地服务在 `127.0.0.1:8765`：

```bash
python -m http.server 8765 --bind 127.0.0.1
```

另一个终端运行：

```bash
node prj/exploration_math_feedback.test.mjs
```

预期：通过。若测试仍检查旧文案，需要更新测试断言为“下一步”或具体 hint。

---

## 任务 7：跑专项验证

**文件：**
- 无代码修改

**步骤 1：运行静态契约**

```bash
node prj/math_pk_guided_feedback_contract.test.mjs
```

预期：

```text
PASS math_pk_guided_feedback_contract
```

**步骤 2：运行数学 PK 既有合约**

```bash
node prj/math_pk_fx_contract.test.mjs
```

预期：

```text
PASS math_pk_fx_contract
```

**步骤 3：运行探索数学反馈**

确保 server 已启动：

```bash
python -m http.server 8765 --bind 127.0.0.1
```

运行：

```bash
node prj/exploration_math_feedback.test.mjs
```

预期：全部检查通过，无 console error。

---

## 任务 8：同步工程文档

**文件：**
- 修改：`docs_project/modules/math-pk.md`
- 修改：`docs_project/modules/exploration.md`
- 可选修改：`docs_project/review/reference-case-analysis.md`

**步骤 1：更新数学 PK 模块文档**

在 `docs_project/modules/math-pk.md` 增加“引导式反馈”章节：

```markdown
### 引导式反馈

- 难度配置 `DIFFICULTY_OPTIONS` 包含 `fitFor/reason`，大厅和设置页都展示推荐理由。
- `buildGuidedFeedback(summary)` 根据正确率、输赢、连击和难度生成复盘与下一局建议。
- `render.result(data)` 在结算页展示复盘/下一局建议。
```

函数表补：

```markdown
| `buildGuidedFeedback(summary)` | math-pk.js:xxx | 生成结算复盘与下一局建议 |
```

**步骤 2：更新探索模块文档**

在 `docs_project/modules/exploration.md` 补：

```markdown
### 探索数学题反馈

`ExplorationDetail.answerMath()` 答错时不使用惩罚性文案，优先展示 `hint`，否则展示 `explanation` 或默认下一步策略。
```

**步骤 3：如 reference-case 状态改变，更新审查文档**

如果本期完成后原则 2/5 状态从“部分做到”变为“已做到/改善”，更新：

`docs_project/review/reference-case-analysis.md`

---

## 任务 9：最终文档链接检查

**文件：**
- 无代码修改

**步骤 1：运行 docs_project 链接检查**

PowerShell:

```powershell
$root = Resolve-Path -LiteralPath "G:\StudyCode\宠物积分系统"
$docs = Join-Path $root "docs_project"
$missing = @()
Get-ChildItem -LiteralPath $docs -Recurse -Filter *.md | ForEach-Object {
  $file = $_.FullName
  $text = Get-Content -LiteralPath $file -Raw
  [regex]::Matches($text, '\[[^\]]+\]\(([^)]+)\)') | ForEach-Object {
    $target = $_.Groups[1].Value.Trim()
    if ($target -match '^(https?:|mailto:|#)' -or $target -eq '') { return }
    $targetPath = ($target -split '#')[0]
    if ($targetPath -eq '') { return }
    if ($targetPath -match '^[a-zA-Z]+:') { return }
    $targetPath = [Uri]::UnescapeDataString($targetPath)
    $full = [System.IO.Path]::GetFullPath((Join-Path (Split-Path -Parent $file) $targetPath))
    if (-not (Test-Path -LiteralPath $full)) {
      $missing += [pscustomobject]@{ File = $file.Substring($root.Path.Length + 1); Target = $target }
    }
  }
}
if ($missing.Count -eq 0) { "DOC_LINK_CHECK_OK" } else { $missing | Format-Table -AutoSize }
```

预期：

```text
DOC_LINK_CHECK_OK
```

---

## 任务 10：提交前检查

**文件：**
- 无代码修改

**步骤 1：查看变更**

```bash
git diff -- js/math-pk.js js/exploration-detail.js prj/math_pk_guided_feedback_contract.test.mjs docs_project/modules/math-pk.md docs_project/modules/exploration.md docs_project/review/reference-case-analysis.md
```

**步骤 2：确认没有无关文件**

```bash
git status --short
```

预期：只包含本期相关文件和已有未跟踪文档。不要回滚用户已有改动。

**步骤 3：记录验证结果**

在最终回复中列出实际运行过的命令及结果。若未跑全量回归，明确说明原因：本期只改数学 PK、探索反馈和文档，未触及全局路由/存储/云端。
