# Minecraft 英语测验与单词卡实施计划

> **给 Claude:** 必需子技能：使用 superpowers:executing-plans 来逐任务实施此计划。

**目标：** 在现有 `english-mc-hybrid-2026` 资料包上增加章节轻测验、Minecraft 单词卡、掌握状态和兑换奖励小闭环。

**架构：** 继续复用 LearnCenter 的资料包、lesson、progress 和 reward 底座。数据层给英语 lesson 增加 `quiz`，再新增 `minecraft-vocab` 模块；运行时新增测验渲染、词卡进度和英语兑换记录，不引入第二套积分系统。

**技术栈：** 静态 JSON 数据、原生 JavaScript、localStorage `petbank_*` 键、现有 Playwright 冒烟脚本、Node.js 合同测试。

---

### 任务 0：抓取 mayihaoke 静态资源快照

**文件：**
- 创建：`prj/mayihaoke_resource_snapshot_contract.test.mjs`
- 创建：`scripts/crawl_mayihaoke_resources.mjs`
- 生成：`data/learn/external/mayihaoke/resources.json`

**步骤 1：编写失败的测试**

测试要求 `resources.json` 包含：

- `provider = mayihaoke`
- `baseUrl = https://mayihaoke.com`
- `entryScript`
- `routes`，至少包含 `/mcbook56/read/:chapter?`、`/mcbookstarters/read/:chapter?`、`/minewords`、`/cambridge-vocab`
- `chunks`，至少包含一个 Chapter1 chunk
- `assets`
- `candidateWords`，至少 20 个候选词

运行：`node prj/mayihaoke_resource_snapshot_contract.test.mjs`

预期：失败，提示 `mayihaoke resource snapshot should exist`。

**步骤 2：实现静态抓取脚本**

脚本通过公开静态资源抓取：

1. 首页 HTML。
2. Vite 入口 JS。
3. 入口 JS 中的懒加载 chunk。
4. 路由、chunk、资源引用和第一批候选词。

运行：`node scripts/crawl_mayihaoke_resources.mjs`

预期：生成 `data/learn/external/mayihaoke/resources.json`。

**步骤 3：验证快照合同**

运行：`node prj/mayihaoke_resource_snapshot_contract.test.mjs`

预期：输出 `PASS - mayihaoke resource snapshot contract`。

### 任务 1：补英语测验与词卡数据合同测试

**文件：**
- 创建：`prj/learning_center_english_quiz_vocab_contract.test.mjs`
- 读取：`data/learn/packs/english-mc-hybrid-2026/manifest.json`
- 读取：`data/learn/packs/english-mc-hybrid-2026/modules/mcbook56-story.json`
- 读取：`data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json`

**步骤 1：编写失败的测试**

```javascript
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packRoot = path.join(repoRoot, 'data/learn/packs/english-mc-hybrid-2026');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(packRoot, relativePath), 'utf8'));
}

const manifest = readJson('manifest.json');
const story = readJson('modules/mcbook56-story.json');
const vocab = readJson('modules/minecraft-vocab.json');

assert.equal(manifest.packType, 'hybrid');
assert.ok(manifest.modules.some(module => module.id === 'minecraft-vocab'), 'manifest should expose minecraft-vocab module');

const quizLessons = story.lessons.filter(lesson => lesson.quiz);
assert.ok(quizLessons.length >= 3, 'first three story lessons should include quiz data');

for (const lesson of quizLessons.slice(0, 3)) {
  assert.ok(Number(lesson.quiz.passScore) >= 1, `${lesson.id} should define passScore`);
  assert.ok(Array.isArray(lesson.quiz.questions) && lesson.quiz.questions.length >= 3, `${lesson.id} should define at least 3 questions`);
  for (const question of lesson.quiz.questions) {
    assert.ok(question.id && question.type && question.prompt, 'question should include id/type/prompt');
    assert.ok(Array.isArray(question.choices) && question.choices.length >= 3, `${question.id} should include choices`);
    assert.ok(question.choices.includes(question.answer), `${question.id} answer should be one of choices`);
  }
}

assert.equal(vocab.id, 'minecraft-vocab');
assert.equal(vocab.type, 'vocab');
assert.ok(Array.isArray(vocab.cards) && vocab.cards.length >= 20, 'minecraft-vocab should start with at least 20 cards');

for (const card of vocab.cards) {
  assert.ok(card.id && card.word && card.translation, 'card should include id/word/translation');
  assert.ok(card.example && card.exampleZh, `${card.id} should include bilingual example`);
  assert.ok(Number(card.difficulty) >= 1, `${card.id} should include difficulty`);
  assert.ok(Array.isArray(card.distractors) && card.distractors.length >= 3, `${card.id} should include distractors`);
}

console.log('PASS - english quiz and vocab data contract');
```

**步骤 2：运行测试以验证它失败**

运行：`node prj/learning_center_english_quiz_vocab_contract.test.mjs`

预期：失败，提示 `minecraft-vocab.json` 不存在，或 `manifest should expose minecraft-vocab module`。

### 任务 2：新增词卡模块并把它接入 manifest

**文件：**
- 修改：`data/learn/packs/english-mc-hybrid-2026/manifest.json`
- 创建：`data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json`

**步骤 1：修改 manifest**

在 `moduleCount` 从 `4` 改成 `5`，并在 `modules` 数组末尾加入：

```json
{
  "id": "minecraft-vocab",
  "title": "Minecraft 单词卡",
  "emoji": "🔤",
  "duration": "20 词起步",
  "summary": "从故事里沉淀高频词，按难度复习，掌握后可兑换英语主题奖励。"
}
```

**步骤 2：创建最小词卡数据**

创建 `minecraft-vocab.json`，结构如下，先补足 20 张卡：

```json
{
  "id": "minecraft-vocab",
  "type": "vocab",
  "title": "Minecraft 单词卡",
  "cards": [
    {
      "id": "mc-word-block",
      "word": "block",
      "translation": "方块",
      "level": "starter",
      "difficulty": 1,
      "sourceModuleId": "mcbook56-story",
      "sourceLessonId": "chapter-01",
      "example": "I see a block.",
      "exampleZh": "我看见一个方块。",
      "image": "",
      "tags": ["minecraft", "object", "starter"],
      "distractors": ["door", "stone", "sword"]
    }
  ]
}
```

**步骤 3：运行测试**

运行：`node prj/learning_center_english_quiz_vocab_contract.test.mjs`

预期：仍失败，因为 `mcbook56-story` 尚未补 quiz。

### 任务 3：给前三个英语章节补 quiz 字段

**文件：**
- 修改：`data/learn/packs/english-mc-hybrid-2026/modules/mcbook56-story.json`

**步骤 1：给每个 lesson 增加 3 题**

在 `chapter-01` 增加：

```json
"quiz": {
  "passScore": 2,
  "questions": [
    {
      "id": "chapter-01-q1",
      "type": "en-to-zh",
      "prompt": "I see a block.",
      "choices": ["我看见一个方块。", "我打开一扇门。", "我跑向朋友。"],
      "answer": "我看见一个方块。",
      "explain": "block 是方块。"
    },
    {
      "id": "chapter-01-q2",
      "type": "word-to-zh",
      "prompt": "world",
      "choices": ["世界", "石头", "光"],
      "answer": "世界",
      "explain": "world 表示世界。"
    },
    {
      "id": "chapter-01-q3",
      "type": "zh-to-en",
      "prompt": "你好",
      "choices": ["hello", "door", "run"],
      "answer": "hello",
      "explain": "hello 是打招呼。"
    }
  ]
}
```

按同样结构给 `chapter-02`、`chapter-03` 各补 3 题，题目优先围绕已有 `support.keywords`。

**步骤 2：运行数据合同测试**

运行：`node prj/learning_center_english_quiz_vocab_contract.test.mjs`

预期：通过，输出 `PASS - english quiz and vocab data contract`。

### 任务 4：为 LearnCenter 增加 quiz 渲染测试

**文件：**
- 修改：`scripts/learning-center-smoke.mjs`

**步骤 1：在英语资料包流程里加入 quiz 断言**

找到 `const englishPackFlow = await page.evaluate(async () => { ... })`，在打开 `chapter-01` 后读取：

```javascript
const quizBlock = lessonPage?.querySelector('[data-learn-quiz]');
const quizQuestions = lessonPage?.querySelectorAll('[data-learn-quiz-question]').length || 0;
const completeDisabledBeforeQuiz = !!completeBtn?.disabled;
```

返回对象增加：

```javascript
hasQuizBlock: !!quizBlock,
quizQuestions,
completeDisabledBeforeQuiz
```

外层增加检查：

```javascript
check('英语 lesson 页面显示章节轻测验', englishPackFlow.hasQuizBlock);
check('英语 lesson 轻测验至少 3 题', englishPackFlow.quizQuestions >= 3, `questions=${englishPackFlow.quizQuestions}`);
check('英语 lesson 测验通过前不能直接打勾', englishPackFlow.completeDisabledBeforeQuiz);
```

**步骤 2：运行冒烟测试以验证失败**

先启动静态服务：`python -m http.server 8000`

另一个终端运行：`node scripts/learning-center-smoke.mjs`

预期：新增 3 项失败，因为 UI 尚未渲染 quiz。

### 任务 5：实现 lesson quiz 渲染与通过状态

**文件：**
- 修改：`js/learn-center.js`

**步骤 1：新增 quiz 存储键**

在 `STORAGE_KEYS` 增加：

```javascript
quizAttempts: 'petbank_learning_quiz_attempts'
```

**步骤 2：新增读取和保存函数**

放在现有 storage helper 附近：

```javascript
function getQuizAttempts() {
  return readJson(STORAGE_KEYS.quizAttempts, {});
}

function saveQuizAttempts(attempts) {
  writeJson(STORAGE_KEYS.quizAttempts, attempts || {});
}

function getQuizKey(packId, moduleId, lessonId) {
  return `${packId}:${moduleId}:${lessonId}`;
}

function isQuizPassed(packId, moduleId, lessonId) {
  const attempts = getQuizAttempts();
  return !!attempts[getQuizKey(packId, moduleId, lessonId)]?.passed;
}
```

**步骤 3：新增渲染函数**

```javascript
function renderLessonQuiz(packId, moduleId, lessonId, lesson) {
  const quiz = lesson?.quiz;
  if (!quiz || !Array.isArray(quiz.questions) || !quiz.questions.length) return '';
  const passed = isQuizPassed(packId, moduleId, lessonId);
  return `
    <section class="learn-card learn-quiz" data-learn-quiz>
      <div class="learn-card-head">
        <h3>章节轻测验</h3>
        <span>${passed ? '已通过' : `答对 ${quiz.passScore || 1} 题即可打勾`}</span>
      </div>
      <div class="learn-quiz-list">
        ${quiz.questions.map((question, index) => `
          <div class="learn-quiz-question" data-learn-quiz-question data-question-id="${question.id}">
            <p>${index + 1}. ${question.prompt}</p>
            <div class="learn-quiz-choices">
              ${(question.choices || []).map(choice => `
                <button class="learn-btn learn-btn-secondary" type="button" data-learn-quiz-choice="${choice}">${choice}</button>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>
      <button class="learn-btn learn-btn-primary" type="button" data-learn-action="submit-quiz">${passed ? '已通过测验' : '提交测验'}</button>
    </section>
  `;
}
```

**步骤 4：接入 renderLessonBody 后方**

在 lesson 页 HTML 中，把 `renderLessonBody(...)` 后面追加：

```javascript
${renderLessonQuiz(packId, moduleId, lessonId, lesson)}
```

**步骤 5：禁用完成按钮**

计算：

```javascript
const quizRequired = !!lesson?.quiz;
const quizPassed = !quizRequired || isQuizPassed(packId, moduleId, lessonId);
```

完成按钮 disabled 条件改为：

```javascript
${completed || !quizPassed ? 'disabled' : ''}
```

**步骤 6：运行冒烟测试**

运行：`node scripts/learning-center-smoke.mjs`

预期：quiz 渲染相关断言通过，但提交测验交互还没有完成。

### 任务 6：实现 quiz 提交交互

**文件：**
- 修改：`js/learn-center.js`
- 修改：`scripts/learning-center-smoke.mjs`

**步骤 1：给选择按钮加选中状态**

在 `renderLesson` 事件绑定区域增加：

```javascript
container.querySelectorAll('[data-learn-quiz-choice]').forEach(button => {
  button.addEventListener('click', () => {
    const question = button.closest('[data-learn-quiz-question]');
    question?.querySelectorAll('[data-learn-quiz-choice]').forEach(item => item.classList.remove('is-selected'));
    button.classList.add('is-selected');
  });
});
```

**步骤 2：提交时判分**

```javascript
const quizBtn = container.querySelector('[data-learn-action="submit-quiz"]');
if (quizBtn) {
  quizBtn.addEventListener('click', () => {
    const quiz = lesson?.quiz;
    let correct = 0;
    (quiz.questions || []).forEach(question => {
      const block = container.querySelector(`[data-question-id="${question.id}"]`);
      const selected = block?.querySelector('[data-learn-quiz-choice].is-selected')?.dataset.learnQuizChoice || '';
      if (selected === question.answer) correct += 1;
    });
    const passed = correct >= (Number(quiz.passScore) || 1);
    const attempts = getQuizAttempts();
    attempts[getQuizKey(packId, moduleId, lessonId)] = {
      passed,
      correct,
      total: quiz.questions.length,
      updatedAt: new Date().toISOString()
    };
    saveQuizAttempts(attempts);
    showToast(passed ? `测验通过：答对 ${correct} 题` : `再试一次：答对 ${correct} 题`);
    void renderLesson(containerId || 'learn-lesson-container');
  });
}
```

**步骤 3：扩展冒烟脚本**

在英语 lesson 页面里点击正确答案，然后提交，检查完成按钮变可用。

运行：`node scripts/learning-center-smoke.mjs`

预期：英语章节仍只发一次积分，且测验通过前不能打勾。

### 任务 7：实现单词卡进度工具

**文件：**
- 创建：`js/english-vocab-progress.js`
- 修改：`index.html`

**步骤 1：新增进度模块**

```javascript
(function () {
  const KEY = 'petbank_learning_vocab_progress';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function write(data) {
    localStorage.setItem(KEY, JSON.stringify(data || {}));
  }

  function get(cardId) {
    const data = read();
    return data[cardId] || { seen: 0, correct: 0, wrong: 0, streak: 0, status: 'new' };
  }

  function record(cardId, isCorrect) {
    const data = read();
    const item = get(cardId);
    item.seen += 1;
    if (isCorrect) {
      item.correct += 1;
      item.streak += 1;
    } else {
      item.wrong += 1;
      item.streak = 0;
    }
    item.status = item.streak >= 2 ? 'mastered' : (item.seen > 0 ? 'learning' : 'new');
    item.updatedAt = new Date().toISOString();
    data[cardId] = item;
    write(data);
    return item;
  }

  function stats(cards) {
    const data = read();
    return (cards || []).reduce((acc, card) => {
      const status = data[card.id]?.status || 'new';
      acc[status] = (acc[status] || 0) + 1;
      acc.total += 1;
      return acc;
    }, { total: 0, new: 0, learning: 0, mastered: 0 });
  }

  window.EnglishVocabProgress = { read, write, get, record, stats };
})();
```

**步骤 2：在 index.html 引入**

放在 `js/learn-center.js` 之前或之后均可，但要保证词卡页面调用前已加载：

```html
<script src="js/english-vocab-progress.js"></script>
```

**步骤 3：新增单元测试**

创建 `prj/english_vocab_progress.test.mjs`，参考 `prj/hanzi_learning_regression.test.mjs` 的 vm 加载方式，验证连续答对 2 次进入 `mastered`。

运行：`node prj/english_vocab_progress.test.mjs`

预期：通过。

### 任务 8：LearnCenter 渲染 vocab 模块

**文件：**
- 修改：`js/learn-center.js`
- 修改：`css/learn-center.css`

**步骤 1：在 renderLessonBody 增加类型分支**

```javascript
if (module?.type === 'vocab') return renderVocabWorksheet(module, lesson);
```

**步骤 2：新增 renderVocabWorksheet**

```javascript
function renderVocabWorksheet(module) {
  const cards = Array.isArray(module?.cards) ? module.cards : [];
  const stats = window.EnglishVocabProgress?.stats?.(cards) || { total: cards.length, new: cards.length, learning: 0, mastered: 0 };
  return `
    <section class="learn-card learn-vocab" data-learn-vocab>
      <div class="learn-card-head">
        <h3>Minecraft 单词卡</h3>
        <span>已掌握 ${stats.mastered}/${stats.total}</span>
      </div>
      <div class="learn-vocab-grid">
        ${cards.slice(0, 20).map(card => `
          <article class="learn-vocab-card" data-vocab-card="${card.id}">
            <strong>${card.word}</strong>
            <span>${card.translation}</span>
            <p>${card.example}</p>
            <button class="learn-btn learn-btn-secondary" type="button" data-learn-vocab-practice="${card.id}">练一下</button>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}
```

**步骤 3：增加样式**

给 `.learn-vocab-grid` 固定响应式列宽，给 `.learn-vocab-card` 固定最小高度，避免按钮和文字导致布局跳动。

**步骤 4：运行 smoke**

运行：`node scripts/learning-center-smoke.mjs`

预期：学习中心无 pageerror，英语资料包仍可打开。

### 任务 9：英语兑换奖励最小闭环

**文件：**
- 修改：`js/learn-center.js`
- 可选修改：`js/card-collection.js`

**步骤 1：新增英语奖励存储键**

```javascript
englishRewards: 'petbank_learning_english_rewards'
```

**步骤 2：新增兑换判断**

掌握数量达到 10 时写入：

```javascript
{
  "minecraft-card-common-10": {
    "type": "card-token",
    "title": "Minecraft 普通卡兑换券",
    "createdAt": "..."
  }
}
```

**步骤 3：先做领取记录，不急着打通所有卡池**

P0 可以先在 LearnCenter 内展示“已获得兑换券”。等卡片目标确定后，再把兑换券消费接入现有卡片掉落或背包。

**步骤 4：补测试**

在 `prj/learning_center_english_quiz_vocab_contract.test.mjs` 或新增运行时测试里验证掌握 10 个词只会生成一次兑换记录。

### 任务 10：最终验证

**文件：**
- 所有上述修改文件

**步骤 1：运行数据合同测试**

运行：`node prj/learning_center_english_quiz_vocab_contract.test.mjs`

预期：`PASS - english quiz and vocab data contract`

**步骤 2：运行词卡进度测试**

运行：`node prj/english_vocab_progress.test.mjs`

预期：`PASS - english vocab progress checks`

**步骤 3：运行学习中心冒烟**

启动服务：`python -m http.server 8000`

运行：`node scripts/learning-center-smoke.mjs`

预期：全部通过。

**步骤 4：人工检查**

打开 `http://127.0.0.1:8000`，依次检查：

- 学习中心能看到英语资料包。
- 英语 lesson 有外部阅读按钮和章节轻测验。
- 测验通过前完成按钮不可点。
- 测验通过后只发一次成长分。
- Minecraft 单词卡能展示 20 张词卡。
- 单词掌握记录切换孩子后相互隔离。

**步骤 5：提交**

```bash
git add docs/英语学习/Minecraft--英语学习.md docs/plans/2026-07-06-minecraft-english-quiz-vocab.md data/learn/packs/english-mc-hybrid-2026 js/learn-center.js js/english-vocab-progress.js css/learn-center.css index.html prj/learning_center_english_quiz_vocab_contract.test.mjs prj/english_vocab_progress.test.mjs scripts/learning-center-smoke.mjs
git commit -m "feat: add minecraft english quiz and vocab plan"
```
