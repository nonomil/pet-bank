# Math PK Multiplication Onboarding Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn `乘法启程` from a pure robot race into a default no-timer multiplication practice flow that teaches repeated addition before optional PK, with lightweight Math FX and pet-vs-robot characters that make progress and feedback more engaging.

**Architecture:** Keep the existing `MathPKGame` module and full-screen arena shell. Add a `training` branch only for `medium_mul`, with its own question metadata, rendering, answer flow, lightweight inline CSS effects, current-pet player avatar, difficulty-based robot rival mapping, and soft handoff back to the existing `Game.start()` robot battle. Do not introduce Lottie or a separate FX runtime in P1.

**Tech Stack:** Vanilla JavaScript in `js/math-pk.js`, existing inline arena styles, Node `vm` tests under `prj/*.test.mjs`, browser-local `localStorage`.

---

## Task Status

- [x] Task 1: Add multiplication onboarding regression test
- [x] Task 2: Add training state and question generator
- [x] Task 3: Render the `medium_mul` practice lobby
- [x] Task 4: Implement training flow and PK handoff
- [x] Task 5: Add lightweight Math FX contract test
- [x] Task 6: Implement practice-first Math FX
- [x] Task 7: Add character asset contract test
- [x] Task 8: Generate and validate robot rival assets
- [x] Task 9: Wire current pet and difficulty robot avatars
- [x] Task 10: Preserve existing difficulty and PK behavior
- [ ] Task 11: Manual browser verification
- [x] Task 12: Final verification

## Execution Record

2026-07-06 execution checkpoint:

Red:

- `node prj/math_pk_multiplication_onboarding.test.mjs` initially failed before the practice lobby and `startTraining()` flow existed.
- `node prj/math_pk_fx_contract.test.mjs` initially failed before Math FX markers and reduced-motion guards existed.
- `node prj/math_pk_character_assets.test.mjs` initially failed while Math PK still depended on the old human/robot avatar contract.

Green:

- `node --check js/math-pk.js`: passed.
- `node prj/math_pk_multiplication_onboarding.test.mjs`: passed.
- `node prj/math_pk_fx_contract.test.mjs`: passed.
- `node prj/math_pk_character_assets.test.mjs`: passed.
- `node prj/math_pk_difficulty_levels.test.mjs`: passed.
- Robot rival PNG/WebP alpha inspection: 10 assets are 512x512, include alpha, have transparent corners, and have no opaque edge pixels.
- Static HTTP smoke at `http://127.0.0.1:5173/index.html`: `index.html`, `js/math-pk.js`, `robot-mul.webp`, and `dog_idle.webp` returned 200.

Remaining:

- Full browser visual QA is still manual because Playwright browser binaries are not installed in this workspace.
- The current robot rivals are local transparent placeholder illustrations. They satisfy the alpha/cropping contract, but final Agnes/GPT redraws can replace them later using the same filenames.

---

### Task 1: Add Multiplication Onboarding Regression Test

**Files:**
- Create: `prj/math_pk_multiplication_onboarding.test.mjs`
- Read: `prj/math_pk_difficulty_levels.test.mjs`
- Read: `js/math-pk.js`

**Step 1: Write the failing test**

Create `prj/math_pk_multiplication_onboarding.test.mjs` with a DOM stub that stores `innerHTML` for the arena elements.

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = process.cwd();
const source = fs.readFileSync(path.join(repoRoot, 'js', 'math-pk.js'), 'utf8');

function createElementStub(id) {
    return {
        id,
        innerHTML: '',
        textContent: '',
        style: {},
        classList: { add() {}, remove() {} },
        querySelector() {
            return { style: {}, offsetWidth: 0 };
        }
    };
}

function createSandbox() {
    const storage = new Map();
    const elements = new Map();
    const documentStub = {
        addEventListener() {},
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, createElementStub(id));
            return elements.get(id);
        }
    };
    const windowStub = {};
    const sandbox = {
        console,
        Math,
        Date,
        Promise,
        setTimeout,
        clearTimeout,
        fetch: async () => ({ json: async () => ({ grades: {} }) }),
        localStorage: {
            getItem(key) { return storage.has(key) ? storage.get(key) : null; },
            setItem(key, value) { storage.set(key, String(value)); },
            removeItem(key) { storage.delete(key); }
        },
        document: documentStub,
        window: windowStub
    };
    windowStub.localStorage = sandbox.localStorage;
    windowStub.document = documentStub;
    windowStub.fetch = sandbox.fetch;
    vm.createContext(sandbox);
    new vm.Script(source, { filename: 'math-pk.js' }).runInContext(sandbox);
    return { sandbox, elements };
}

const { sandbox, elements } = createSandbox();
const game = sandbox.window.MathPKGame;
assert.ok(game, 'MathPKGame should be exposed');

sandbox.localStorage.setItem('petbank_math_difficulty', 'medium_mul');
game.renderUI('math-pk-container');

const centerHtml = elements.get('arena-center').innerHTML;
assert.match(centerHtml, /练习场/, 'medium_mul lobby should default to practice mode');
assert.match(centerHtml, /开始练习/, 'medium_mul lobby should offer practice start');
assert.match(centerHtml, /开始对战/, 'medium_mul lobby should still expose PK entry');

game.startTraining();
const trainingHtml = elements.get('arena-center').innerHTML;
assert.match(trainingHtml, /每组/, 'training question should explain groups');
assert.match(trainingHtml, /[+]/, 'training question should show repeated addition');
assert.match(trainingHtml, /×/, 'training question should show multiplication notation');
assert.match(trainingHtml, /math-array-row/, 'training question should render visual rows');

console.log('PASS math_pk_multiplication_onboarding');
```

**Step 2: Run test to verify it fails**

Run:

```bash
node prj/math_pk_multiplication_onboarding.test.mjs
```

Expected: FAIL because `game.startTraining` is not exposed and the lobby does not contain practice copy.

**Step 3: Commit**

Do not commit yet. This task intentionally creates a failing test; commit after Task 4 passes.

---

### Task 2: Add Training State and Question Generator

**Files:**
- Modify: `js/math-pk.js`
- Test: `prj/math_pk_multiplication_onboarding.test.mjs`

**Step 1: Add config and state**

In `CONFIG`, add:

```js
MUL_TRAINING_UNLOCK_STREAK: 5
```

In `state`, add:

```js
training: {
    active: false,
    streak: 0,
    totalCorrect: 0,
    currentQuestion: null,
    readyForPk: false
}
```

**Step 2: Add a training generator to `utils`**

Add:

```js
generateMultiplicationTrainingQuestion(streak) {
    const earlySizes = [2, 5, 10];
    const laterSizes = [2, 3, 4, 5, 10];
    const sizes = streak >= 3 ? laterSizes : earlySizes;
    let groups;
    let groupSize;
    let answer;
    do {
        groups = this.getRandomInt(2, streak >= 3 ? 5 : 4);
        groupSize = sizes[this.getRandomInt(0, sizes.length - 1)];
        answer = groups * groupSize;
    } while (answer > 60);
    return {
        text: `${groups} 组，每组 ${groupSize} 个`,
        answer,
        op: '*',
        isMultiplicationTraining: true,
        groups,
        groupSize,
        repeatedAddition: Array(groups).fill(groupSize).join(' + '),
        multiplication: `${groups} × ${groupSize}`
    };
}
```

**Step 3: Run syntax check**

Run:

```bash
node --check js/math-pk.js
```

Expected: PASS.

---

### Task 3: Render the Medium-Mul Practice Lobby

**Files:**
- Modify: `js/math-pk.js`
- Test: `prj/math_pk_multiplication_onboarding.test.mjs`
- Test: `prj/math_pk_difficulty_levels.test.mjs`

**Step 1: Add scoped training styles inside `createContainer`**

Add styles near existing `.arena-lobby` rules:

```css
.mul-mode-switch { display:inline-grid; grid-template-columns:1fr 1fr; gap:6px; padding:5px; border-radius:999px; background:rgba(255,255,255,.12); margin:12px 0 4px; }
.mul-mode-switch button { border:0; border-radius:999px; padding:9px 18px; color:#fff; background:transparent; font-weight:800; cursor:pointer; }
.mul-mode-switch button.active { background:rgba(255,255,255,.24); }
.math-array { display:grid; gap:7px; padding:14px 18px; border-radius:16px; background:rgba(255,255,255,.12); }
.math-array-row { display:flex; justify-content:center; gap:7px; }
.math-array-dot { width:18px; height:18px; border-radius:50%; background:#ffd166; box-shadow:0 2px 8px rgba(0,0,0,.25); }
.mul-explain { display:grid; gap:6px; text-align:center; font-weight:800; }
.mul-explain span { padding:6px 12px; border-radius:999px; background:rgba(15,20,29,.72); }
.mul-feedback { max-width:420px; line-height:1.6; color:rgba(255,255,255,.9); }
```

**Step 2: Branch `_lobby()` for `medium_mul`**

At the start of `render._lobby()`, after computing `difficultyLabel`, add:

```js
if (normalizeDifficulty(state.mathDifficulty) === 'medium_mul') {
    this._multiplicationLobby();
    return;
}
```

**Step 3: Add `_multiplicationLobby()`**

Add to `render`:

```js
_multiplicationLobby() {
    const center = document.getElementById('arena-center');
    if (!center) return;
    const high = localStorage.getItem(CONFIG.STORAGE_KEY_HIGH_SCORE) || 0;
    center.innerHTML = `
        <div class="arena-lobby">
            <h2>乘法启程</h2>
            <p>先看懂“几组几个”，再挑战机器人。</p>
            <div class="mul-mode-switch" aria-label="乘法启程模式">
                <button class="active" type="button" onclick="MathPKGame.startTraining()">练习场</button>
                <button type="button" onclick="MathPKGame.start()">PK</button>
            </div>
            <button class="arena-btn" onclick="MathPKGame.startTraining()">开始练习</button>
            <button class="arena-btn" style="margin-top:10px;background:rgba(255,255,255,.18);" onclick="MathPKGame.start()">开始对战</button>
            <p style="margin-top:14px;font-size:.8rem;opacity:.7;">历史最高分：${high}</p>
        </div>
    `;
    const bar = document.getElementById('arena-robot-bar');
    if (bar) bar.style.display = 'none';
    this._setSide('human', { status: '准备练习', time: '' });
    this._setSide('robot', { status: '等你准备好再 PK', time: '' });
    this._setSideClass('human', '');
    this._setSideClass('robot', '');
}
```

**Step 4: Run tests**

Run:

```bash
node prj/math_pk_multiplication_onboarding.test.mjs
node prj/math_pk_difficulty_levels.test.mjs
```

Expected: first test still FAILS at `startTraining`; existing difficulty test remains PASS.

---

### Task 4: Implement Training Flow and PK Handoff

**Files:**
- Modify: `js/math-pk.js`
- Test: `prj/math_pk_multiplication_onboarding.test.mjs`

**Step 1: Add render method for training questions**

Add:

```js
trainingMatch(question) {
    const center = document.getElementById('arena-center');
    if (!center) return;
    const rows = Array(question.groups).fill(0).map(() => `
        <div class="math-array-row">
            ${Array(question.groupSize).fill(0).map(() => '<i class="math-array-dot"></i>').join('')}
        </div>
    `).join('');
    const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(d =>
        `<button class="arena-key" onclick="MathPKGame._inputDigit(${d})">${d}</button>`).join('');
    center.innerHTML = `
        <div class="arena-qtag">练习场</div>
        <div class="arena-question word">${question.text}，一共有几个？</div>
        <div class="math-array">${rows}</div>
        <div class="mul-explain">
            <span>${question.repeatedAddition} = ?</span>
            <span>${question.multiplication} = ?</span>
        </div>
        <div class="arena-display empty" id="arena-display">输入答案</div>
        <div class="arena-keypad">
            ${keys}
            <button class="arena-key clear" onclick="MathPKGame._clearInput()">⌫ 清除</button>
            <button class="arena-key" onclick="MathPKGame._inputDigit(0)">0</button>
            <button class="arena-key confirm" onclick="MathPKGame._submitAnswer()">✓ 确认</button>
        </div>
        <div class="mul-feedback" id="mul-feedback"></div>
    `;
    this._setSide('human', { status: `连对 ${state.training.streak}`, time: '' });
    this._setSide('robot', { status: '练会再挑战', time: '' });
}
```

**Step 2: Add Game methods**

Add:

```js
startTraining() {
    state.isPlaying = true;
    state.roundClosing = false;
    state.mode = 'training';
    state.currentInput = '';
    state.training.active = true;
    state.training.streak = 0;
    state.training.totalCorrect = 0;
    state.training.readyForPk = false;
    if (state.robotTimer) clearTimeout(state.robotTimer);
    this._nextTrainingQuestion();
},

_nextTrainingQuestion() {
    state.currentInput = '';
    state.roundResolved = false;
    state.roundClosing = false;
    state.currentQuestion = utils.generateMultiplicationTrainingQuestion(state.training.streak);
    state.training.currentQuestion = state.currentQuestion;
    render._setRoundPill(`乘法练习 · 连对 ${state.training.streak} / ${CONFIG.MUL_TRAINING_UNLOCK_STREAK}`);
    render.trainingMatch(state.currentQuestion);
},

_submitTrainingAnswer(selected) {
    const correct = selected === state.currentQuestion.answer;
    const feedback = document.getElementById('mul-feedback');
    if (!correct) {
        state.training.streak = 0;
        state.currentInput = '';
        this._refreshDisplay();
        if (feedback) {
            feedback.innerHTML = `再看一眼：${state.currentQuestion.multiplication} 是 ${state.currentQuestion.groups} 组 ${state.currentQuestion.groupSize} 个，${state.currentQuestion.repeatedAddition} = ${state.currentQuestion.answer}`;
        }
        render._setSide('human', { status: '看图再试一次', time: '' });
        window.sfx && sfx.error();
        return;
    }
    state.training.streak++;
    state.training.totalCorrect++;
    state.currentInput = '';
    if (state.training.streak >= CONFIG.MUL_TRAINING_UNLOCK_STREAK) {
        state.training.readyForPk = true;
        render.toast(`已经连对 ${state.training.streak} 题<small>要不要挑战机器人？</small>`, 'win');
        setTimeout(() => {
            render.hideToast();
            render._multiplicationReady();
        }, 900);
        return;
    }
    render.toast(`答对了！<small>${state.currentQuestion.repeatedAddition} = ${state.currentQuestion.answer}</small>`, 'win');
    setTimeout(() => {
        render.hideToast();
        this._nextTrainingQuestion();
    }, 900);
}
```

**Step 3: Add ready prompt renderer**

Add to `render`:

```js
_multiplicationReady() {
    const center = document.getElementById('arena-center');
    if (!center) return;
    center.innerHTML = `
        <div class="arena-lobby">
            <h2>可以挑战了</h2>
            <p>你已经连续看懂 ${CONFIG.MUL_TRAINING_UNLOCK_STREAK} 道“几组几个”。</p>
            <button class="arena-btn" onclick="MathPKGame.start()">挑战机器人</button>
            <button class="arena-btn" style="margin-top:10px;background:rgba(255,255,255,.18);" onclick="MathPKGame.startTraining()">继续练习</button>
        </div>
    `;
    this._setSide('human', { status: '准备挑战', time: '' });
    this._setSide('robot', { status: '机器人上线', time: '' });
}
```

**Step 4: Route `_submitAnswer()`**

At the top of `_submitAnswer()`, after parsing `selected`, add:

```js
if (state.mode === 'training') {
    this._submitTrainingAnswer(selected);
    return;
}
```

**Step 5: Expose public method**

In `window.MathPKGame`, add:

```js
startTraining: () => Game.startTraining(),
```

**Step 6: Run test to verify it passes**

Run:

```bash
node prj/math_pk_multiplication_onboarding.test.mjs
```

Expected: PASS.

**Step 7: Commit**

```bash
git add js/math-pk.js prj/math_pk_multiplication_onboarding.test.mjs
git commit -m "feat: add multiplication practice onboarding"
```

---

### Task 5: Add Lightweight Math FX Contract Test

**Files:**
- Create: `prj/math_pk_fx_contract.test.mjs`
- Read: `js/math-pk.js`
- Test: `prj/math_pk_multiplication_onboarding.test.mjs`

**Step 1: Write the failing test**

Create `prj/math_pk_fx_contract.test.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const source = fs.readFileSync(path.join(repoRoot, 'js', 'math-pk.js'), 'utf8');

[
    '.mul-streak-meter',
    '.mul-streak-cell',
    '.math-array-row.fx-reveal',
    '.math-array-dot',
    '.math-fx-burst',
    '.math-answer-correct',
    '.math-answer-wrong',
    '@media (prefers-reduced-motion: reduce)',
    'math-row-reveal',
    'math-correct-spark'
].forEach((needle) => {
    assert.ok(source.includes(needle), `math-pk.js should contain Math FX marker: ${needle}`);
});

assert.ok(!/window\.lottie|lottie\.loadAnimation/.test(source), 'P1 Math FX should not depend on Lottie runtime');

console.log('PASS math_pk_fx_contract');
```

**Step 2: Run test to verify it fails**

Run:

```bash
node prj/math_pk_fx_contract.test.mjs
```

Expected: FAIL because Math FX classes and keyframes are not implemented.

---

### Task 6: Implement Practice-First Math FX

**Files:**
- Modify: `js/math-pk.js`
- Test: `prj/math_pk_fx_contract.test.mjs`
- Test: `prj/math_pk_multiplication_onboarding.test.mjs`

**Step 1: Extend inline CSS inside `createContainer`**

Add styles near the multiplication training CSS:

```css
.mul-streak-meter { display:flex; justify-content:center; gap:6px; margin:2px 0 4px; }
.mul-streak-cell { width:28px; height:8px; border-radius:999px; background:rgba(255,255,255,.18); overflow:hidden; }
.mul-streak-cell.active { background:linear-gradient(90deg,#6ee7b7,#ffd166); box-shadow:0 0 12px rgba(255,209,102,.38); }
.math-array-row.fx-reveal { animation:math-row-reveal .32s ease both; animation-delay:calc(var(--row-index, 0) * 70ms); }
.math-array-dot { transition:transform .18s ease, box-shadow .18s ease, background .18s ease; }
.math-array.correct .math-array-dot { animation:math-correct-spark .55s ease both; }
.math-answer-correct { animation:math-answer-pop .42s ease both; }
.math-answer-wrong { animation:arena-shake .35s ease; }
.math-fx-burst { position:absolute; pointer-events:none; width:120px; height:120px; border-radius:50%; background:radial-gradient(circle,rgba(255,209,102,.8),rgba(110,231,183,.25) 42%,transparent 70%); animation:math-fx-burst .7s ease forwards; }
@keyframes math-row-reveal { from{ transform:translateY(8px); opacity:0; } to{ transform:translateY(0); opacity:1; } }
@keyframes math-correct-spark { 0%{ transform:scale(1); } 45%{ transform:scale(1.18); box-shadow:0 0 16px rgba(255,209,102,.75); } 100%{ transform:scale(1); } }
@keyframes math-answer-pop { 0%{ transform:scale(.92); opacity:.7; } 100%{ transform:scale(1); opacity:1; } }
@keyframes math-fx-burst { from{ transform:scale(.45); opacity:.9; } to{ transform:scale(1.3); opacity:0; } }
@media (prefers-reduced-motion: reduce) {
    .math-array-row.fx-reveal,
    .math-array.correct .math-array-dot,
    .math-answer-correct,
    .math-answer-wrong,
    .math-fx-burst { animation:none !important; transition:none !important; }
}
```

**Step 2: Add streak meter renderer**

Add to `render`:

```js
_streakMeter() {
    const total = CONFIG.MUL_TRAINING_UNLOCK_STREAK;
    const active = Math.min(state.training.streak, total);
    return `
        <div class="mul-streak-meter" aria-label="连对 ${active}/${total}">
            ${Array(total).fill(0).map((_, index) => `<i class="mul-streak-cell ${index < active ? 'active' : ''}"></i>`).join('')}
        </div>
    `;
}
```

**Step 3: Update training markup**

In `trainingMatch(question)`, add the streak meter above the question and put row indices on the rows:

```js
const rows = Array(question.groups).fill(0).map((_, index) => `
    <div class="math-array-row fx-reveal" style="--row-index:${index};">
        ${Array(question.groupSize).fill(0).map(() => '<i class="math-array-dot"></i>').join('')}
    </div>
`).join('');
```

Include this in `center.innerHTML`:

```js
${this._streakMeter()}
```

**Step 4: Add correct and wrong visual feedback**

In `_submitTrainingAnswer(selected)`, when wrong:

```js
const display = document.getElementById('arena-display');
if (display) {
    display.classList.add('math-answer-wrong');
    setTimeout(() => display.classList.remove('math-answer-wrong'), 360);
}
```

When correct:

```js
const array = document.querySelector && document.querySelector('.math-array');
if (array) array.classList.add('correct');
const display = document.getElementById('arena-display');
if (display) display.classList.add('math-answer-correct');
```

If the DOM stub cannot support `document.querySelector`, guard the call as shown.

**Step 5: Run tests**

Run:

```bash
node prj/math_pk_fx_contract.test.mjs
node prj/math_pk_multiplication_onboarding.test.mjs
```

Expected: PASS.

**Step 6: Commit**

```bash
git add js/math-pk.js prj/math_pk_fx_contract.test.mjs
git commit -m "feat: add lightweight math pk effects"
```

---

### Task 7: Add Character Asset Contract Test

**Files:**
- Create: `prj/math_pk_character_assets.test.mjs`
- Read: `js/math-pk.js`
- Read: `assets/pets/poses/dog_idle.webp`
- Read: `docs/数学PK乘法启程优化/02-角色资产升级.md`

**Step 1: Write the failing test**

Create `prj/math_pk_character_assets.test.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const source = fs.readFileSync(path.join(repoRoot, 'js', 'math-pk.js'), 'utf8');

const robotAssets = [
    'assets/arena/math-rivals/robot-easy20.webp',
    'assets/arena/math-rivals/robot-easy100.webp',
    'assets/arena/math-rivals/robot-mul.webp',
    'assets/arena/math-rivals/robot-mix.webp',
    'assets/arena/math-rivals/robot-hard.webp'
];

assert.ok(!source.includes('human-kid.png'), 'math PK should not render the old human kid avatar');
assert.ok(source.includes('getMathPkPlayerAvatar'), 'math PK should resolve the current pet avatar');
assert.ok(source.includes('MATH_PK_ROBOT_RIVALS'), 'math PK should define robot rivals by difficulty');
assert.ok(source.includes('assets/pets/poses/dog_idle.webp'), 'math PK should keep dog idle as safe fallback');

robotAssets.forEach((relPath) => {
    assert.ok(source.includes(relPath), `math-pk.js should reference ${relPath}`);
    assert.ok(fs.existsSync(path.join(repoRoot, relPath)), `${relPath} should exist`);
});

console.log('PASS math_pk_character_assets');
```

**Step 2: Run test to verify it fails**

Run:

```bash
node prj/math_pk_character_assets.test.mjs
```

Expected: FAIL because `math-pk.js` still references `human-kid.png` and the new robot assets do not exist.

---

### Task 8: Generate and Validate Robot Rival Assets

**Files:**
- Create: `assets/arena/math-rivals/robot-easy20.png`
- Create: `assets/arena/math-rivals/robot-easy20.webp`
- Create: `assets/arena/math-rivals/robot-easy100.png`
- Create: `assets/arena/math-rivals/robot-easy100.webp`
- Create: `assets/arena/math-rivals/robot-mul.png`
- Create: `assets/arena/math-rivals/robot-mul.webp`
- Create: `assets/arena/math-rivals/robot-mix.png`
- Create: `assets/arena/math-rivals/robot-mix.webp`
- Create: `assets/arena/math-rivals/robot-hard.png`
- Create: `assets/arena/math-rivals/robot-hard.webp`
- Read: `docs/数学PK乘法启程优化/02-角色资产升级.md`

**Step 1: Generate raw Agnes/GPT images**

Use the prompts in `docs/数学PK乘法启程优化/02-角色资产升级.md`.

Important prompt constraints:

```text
transparent background, true alpha channel, no checkerboard pattern, no white background, no gray background, no floor, no shadow base, no text, no watermark
```

Save raw outputs outside app assets first, for example:

```text
.tmp/math-rivals/raw/
```

**Step 2: Remove fake transparent backgrounds**

If any generated image contains a checkerboard or flat background, remove it before publishing. Do not put unvalidated raw images under `assets/arena/math-rivals/`.

Use the local image-processing approach from `gpt-image-pipeline`: trim by alpha or mask, keep 32-48px padding, then export PNG and WebP.

**Step 3: Validate alpha edges**

Run this check after publishing:

```bash
python -c "from PIL import Image; from pathlib import Path; paths=[Path(p) for p in ['assets/arena/math-rivals/robot-easy20.webp','assets/arena/math-rivals/robot-easy100.webp','assets/arena/math-rivals/robot-mul.webp','assets/arena/math-rivals/robot-mix.webp','assets/arena/math-rivals/robot-hard.webp','assets/pets/poses/dog_idle.webp']];\
for p in paths:\
 im=Image.open(p).convert('RGBA'); a=im.getchannel('A'); edge=[a.getpixel((x,y)) for x in range(im.width) for y in (0, im.height-1)] + [a.getpixel((x,y)) for y in range(im.height) for x in (0, im.width-1)]; opaque=sum(1 for v in edge if v>8); bbox=a.getbbox(); print(p, 'bbox=', bbox, 'edge_opaque_px=', opaque); assert bbox and opaque <= 8"
```

Expected: all images report `edge_opaque_px <= 8`.

**Step 4: Commit assets**

```bash
git add assets/arena/math-rivals
git commit -m "assets: add math pk robot rivals"
```

---

### Task 9: Wire Current Pet and Difficulty Robot Avatars

**Files:**
- Modify: `js/math-pk.js`
- Test: `prj/math_pk_character_assets.test.mjs`

**Step 1: Add robot rival config**

Near `DIFFICULTY_LABELS`, add:

```js
const MATH_PK_ROBOT_RIVALS = {
    easy20: { name: '圆圆练习机', image: 'assets/arena/math-rivals/robot-easy20.webp' },
    easy100: { name: '彩键计算机', image: 'assets/arena/math-rivals/robot-easy100.webp' },
    medium_mul: { name: '星阵机器人', image: 'assets/arena/math-rivals/robot-mul.webp' },
    medium_mix: { name: '博士计算机', image: 'assets/arena/math-rivals/robot-mix.webp' },
    hard: { name: '冠军计算机', image: 'assets/arena/math-rivals/robot-hard.webp' }
};
```

**Step 2: Add avatar helper functions**

Add:

```js
function getMathPkPlayerAvatar() {
    const fallback = 'assets/pets/poses/dog_idle.webp';
    try {
        if (window.PetSystem && typeof window.PetSystem.getCurrentStageImage === 'function') {
            return window.PetSystem.getCurrentStageImage() || fallback;
        }
    } catch (e) {}
    return fallback;
}

function getMathPkPlayerName() {
    try {
        if (window.PetSystem && typeof window.PetSystem.getState === 'function' && typeof window.PetSystem.getAllSpecies === 'function') {
            const petState = window.PetSystem.getState();
            const species = window.PetSystem.getAllSpecies().find(item => item.id === petState.species);
            return species && species.name ? species.name : '我的宠物';
        }
    } catch (e) {}
    return '我的宠物';
}

function getMathPkRobotRival(diff) {
    return MATH_PK_ROBOT_RIVALS[normalizeDifficulty(diff)] || MATH_PK_ROBOT_RIVALS.easy20;
}
```

**Step 3: Replace hard-coded avatar HTML**

In `render.createContainer`, before `container.innerHTML`, compute:

```js
const playerAvatar = getMathPkPlayerAvatar();
const playerName = escapeHtml(getMathPkPlayerName());
const robotRival = getMathPkRobotRival(state.mathDifficulty);
const robotName = escapeHtml(robotRival.name);
```

Replace:

```html
<img class="arena-avatar" src="assets/arena/human-kid.png" alt="你">
<div class="arena-name">你</div>
```

with:

```html
<img class="arena-avatar pet-avatar" id="arena-human-avatar" src="${escapeHtml(playerAvatar)}" alt="${playerName}" onerror="this.src='assets/pets/poses/dog_idle.webp'">
<div class="arena-name" id="arena-human-name">${playerName}</div>
```

Replace robot markup with:

```html
<img class="arena-avatar robot-avatar" id="arena-robot-avatar" src="${escapeHtml(robotRival.image)}" alt="${robotName}">
<div class="arena-name" id="arena-robot-name">${robotName}</div>
```

**Step 4: Update score copy**

Change the score pill copy from:

```html
你 <b id="arena-human-score">0</b> : <b id="arena-robot-score">0</b> 机器人
```

to:

```html
宠物 <b id="arena-human-score">0</b> : <b id="arena-robot-score">0</b> 机器人
```

**Step 5: Run tests**

Run:

```bash
node prj/math_pk_character_assets.test.mjs
node prj/math_pk_multiplication_onboarding.test.mjs
node prj/math_pk_difficulty_levels.test.mjs
```

Expected: PASS.

**Step 6: Commit**

```bash
git add js/math-pk.js prj/math_pk_character_assets.test.mjs
git commit -m "feat: use pet avatar in math pk"
```

---

### Task 10: Preserve Existing Difficulty and PK Behavior

**Files:**
- Modify if needed: `prj/math_pk_difficulty_levels.test.mjs`
- Read: `js/math-pk.js`

**Step 1: Run existing difficulty regression**

Run:

```bash
node prj/math_pk_difficulty_levels.test.mjs
```

Expected: PASS. `medium_mul` should still generate multiplication questions for async/PK question sets.

**Step 2: Add a guard if behavior regresses**

If `Game.start()` accidentally routes `medium_mul` back into practice, add or adjust a test to assert `buildAsyncQuestionSet()` still returns `×` questions for `medium_mul`.

Use the existing assertion:

```js
assert.ok(
    mediumMulQuestions.some((question) => /×/.test(question.text)),
    'medium_mul should still include multiplication questions'
);
```

**Step 3: Commit if tests changed**

```bash
git add prj/math_pk_difficulty_levels.test.mjs
git commit -m "test: preserve math pk multiplication difficulty"
```

---

### Task 11: Manual Browser Verification

**Files:**
- Read: `index.html`
- Read: `js/app.js`
- Verify: `js/math-pk.js`

**Step 1: Start a static server**

Run:

```bash
python -m http.server 5173
```

Expected: server starts at `http://localhost:5173`.

**Step 2: Open the app**

Open:

```text
http://localhost:5173/index.html
```

**Step 3: Verify the flow**

Manual checks:

- Go to settings and choose `乘法启程`.
- Enter 数学 PK from 游乐场.
- Confirm the left character is the current pet, not the old boy illustration.
- Confirm the right robot changes when switching each math difficulty in settings.
- Confirm lobby defaults to `练习场`.
- Start practice.
- Confirm visual rows, repeated addition, and multiplication notation are visible.
- Confirm rows animate in and the `连对 0/5` meter is visible.
- Enter a wrong answer and confirm it explains without moving to next question.
- Confirm wrong feedback is gentle: input shakes, explanation is visible, no harsh failure state.
- Enter correct answers until the challenge prompt appears.
- Confirm correct feedback lights the array or answer briefly.
- Click `挑战机器人` and confirm existing 5-round PK starts.
- Confirm no checkerboard or square background is visible around either character.

**Step 4: Stop the server**

Stop the terminal process with `Ctrl+C`.

---

### Task 12: Final Verification

**Files:**
- Verify: `js/math-pk.js`
- Verify: `prj/math_pk_multiplication_onboarding.test.mjs`
- Verify: `prj/math_pk_fx_contract.test.mjs`
- Verify: `prj/math_pk_character_assets.test.mjs`
- Verify: `prj/math_pk_difficulty_levels.test.mjs`

**Step 1: Run all relevant checks**

Run:

```bash
node --check js/math-pk.js
node prj/math_pk_multiplication_onboarding.test.mjs
node prj/math_pk_fx_contract.test.mjs
node prj/math_pk_character_assets.test.mjs
node prj/math_pk_difficulty_levels.test.mjs
```

Expected: all PASS.

**Step 2: Review git diff**

Run:

```bash
git diff -- js/math-pk.js prj/math_pk_multiplication_onboarding.test.mjs prj/math_pk_fx_contract.test.mjs prj/math_pk_character_assets.test.mjs prj/math_pk_difficulty_levels.test.mjs
```

Expected: diff only contains multiplication onboarding, lightweight Math FX, and pet-vs-robot character changes.

**Step 3: Commit final verification notes if docs changed**

```bash
git add docs/数学PK乘法启程优化/README.md docs/数学PK乘法启程优化/02-角色资产升级.md docs/plans/2026-07-06-math-pk-multiplication-onboarding.md
git commit -m "docs: plan multiplication onboarding for math pk"
```
