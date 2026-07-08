# Minecraft 核心题库扩容实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** 把正式学习包里的 `minecraft-vocab` 从当前 24 张 starter 词卡，扩成一套适合 6 岁左右孩子的 Minecraft 核心题库；保留现有 mayihaoke 起步词，增量导入 `minecraft_words_apk-main` 的精选词，并让学习机原型与正式题库共用同一套筛选规则。

**Architecture:** 不直接导入外部仓库 1874 条原始 Minecraft 词，而是保留现有 24 张 mayihaoke starter 卡作为低门槛起步层，再从 `minecraft_words_apk-main` 的 Minecraft 词库里筛选 56-72 张 child-friendly core 卡，形成总量 80-120 张的正式题库。实现上先抽出一个共享的外部词库筛选器，再分别生成正式学习包 `minecraft-vocab.json` 和学习机原型 `minecraft-typing-expanded.json`，避免两边各写一套规则。

**Tech Stack:** 静态 JSON、Node.js 合同测试、CommonJS 生成脚本、现有学习中心 smoke 脚本、学习机原型验证脚本。

---

## 范围与边界

- 保留当前 `minecraft-vocab.json` 里已有的 24 张 starter 卡，不删、不重命名 ID。
- 第一版目标总量控制在 **80-120 张**，推荐落地到 **96 张左右**。
- 导入优先来源：
  1. `G:\StudyCode\宠物积分系统\data\learn\packs\english-mc-hybrid-2026\modules\minecraft-vocab.json`
  2. `G:\StudyCode\宠物积分系统\prj\学习机玩法原型\scripts\build_minecraft_typing_pack.cjs`
  3. `G:\UserCode\minecraft_words\minecraft_words_apk-main\js\vocabularies\minecraft\*.js`
- 第一版明确**不使用** `recommended_additions_top200.csv` 作为主来源，因为它偏通用高频词，不是 Minecraft 主题核心词库。
- 第一版允许新增 core 卡先使用 `audio = ""` + `audioVoice = "web-speech-fallback"`；本地批量 TTS 作为后续增量任务，不阻塞扩题库落地。

## 题库筛选规则

- 词长优先 `3-8` 个字母。
- 只保留低龄可玩的具体词：`block`、`item`、`tool`、`animal`、`food`、`plant`、`environment`、`color`、`general/common` 中的短词。
- 必须有可用中文翻译。
- 必须能生成基础例句和 3 个干扰项。
- 优先保留有图片引用的词。
- 过滤掉：
  - 太长的专有词或进阶词
  - 重复词
  - 中文缺失词
  - 图像缺失且语义不直观的词
  - 过于抽象、像百科目录而不像儿童游戏题库的词

### Task 1: 为“扩题库”建立失败合同测试

**Files:**
- Create: `prj/minecraft_core_vocab_expansion_contract.test.mjs`
- Modify: `prj/learning_center_english_quiz_vocab_contract.test.mjs`
- Read: `data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json`

**Step 1: Write the failing test**

新增一份专门的扩题库合同测试，要求正式词包满足：

- `id = minecraft-vocab`、`type = vocab`
- `cards.length >= 80 && cards.length <= 120`
- 当前 24 张 starter 卡的 `id` 全部仍然存在
- 至少有 40 张 `level = core` 的外部导入词
- `word` 全局去重，且统一为小写英文字母
- 每张卡都包含 `translation`、`example`、`exampleZh`、`distractors`
- 外部导入卡至少包含 `sourceProvider = minecraft_words_apk-main`、`sourceFile`、`category`
- 顶层元数据不再只写死 `sourceProvider = mayihaoke`，而改成支持 mixed/multi-source 语义

同时放宽旧合同测试里对顶层来源的单一断言，改为验证：

- 仍保留 mayihaoke starter 来源
- 正式包允许混合来源
- `minecraft-vocab` 仍满足学习中心运行时所需字段

**Step 2: Run tests to verify they fail**

Run:

```bash
node "G:\StudyCode\宠物积分系统\prj\minecraft_core_vocab_expansion_contract.test.mjs"
node "G:\StudyCode\宠物积分系统\prj\learning_center_english_quiz_vocab_contract.test.mjs"
```

Expected:

- 新合同测试失败，提示正式词包仍只有 24 张卡
- 旧合同测试失败或待调整，提示顶层来源仍是单一 `mayihaoke`

### Task 2: 抽出共享筛选器并先用 fixture 走一轮 TDD

**Files:**
- Create: `scripts/minecraft_vocab_selector.cjs`
- Create: `prj/minecraft_vocab_selector_contract.test.mjs`
- Modify: `prj/学习机玩法原型/scripts/build_minecraft_typing_pack.cjs`

**Step 1: Write the failing selector test**

用一小组内联 fixture 行为测试共享筛选器，至少覆盖：

- 正常短词被保留
- 重复词只保留优先来源的一条
- 过长词被过滤
- 缺少中文的词被过滤
- 不在 allowlist 的 category 被过滤
- 每个保留词都能生成 3 个干扰项

Run:

```bash
node "G:\StudyCode\宠物积分系统\prj\minecraft_vocab_selector_contract.test.mjs"
```

Expected: FAIL，提示 `scripts/minecraft_vocab_selector.cjs` 不存在，或导出的 `selectCuratedMinecraftCards` 未实现。

**Step 2: Write the minimal implementation**

在 `scripts/minecraft_vocab_selector.cjs` 中导出共享方法，至少包括：

- `loadExternalMinecraftRows(sourceRoot, files)`
- `normalizeMinecraftWord(word)`
- `selectCuratedMinecraftCards(rows, options)`
- `buildDistractors(cards)`

优先复用现有 `build_minecraft_typing_pack.cjs` 已验证过的规则：

- 短词优先
- 图片优先
- 低龄 category allowlist
- 来源优先级排序

**Step 3: Run the selector test to verify it passes**

Run:

```bash
node "G:\StudyCode\宠物积分系统\prj\minecraft_vocab_selector_contract.test.mjs"
```

Expected: PASS，确认共享筛选逻辑已经稳定。

### Task 3: 生成正式 `minecraft-vocab` 核心扩展包

**Files:**
- Create: `scripts/build_minecraft_core_vocab.cjs`
- Modify: `data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json`

**Step 1: Keep the starter layer as seed**

生成脚本先读取当前正式包，把现有 24 张 starter 卡作为种子保留：

- `id`
- 本地 `image`
- 本地 `audio`
- mayihaoke 的 `sourceRoute/sourceChunk/sourceCandidateId`

这些 starter 卡保持不动，避免学习中心历史记录和现有资源断链。

**Step 2: Append curated core cards from external repo**

从下列来源读取候选词：

- `G:\UserCode\minecraft_words\minecraft_words_apk-main\js\vocabularies\minecraft\minecraft_basic.js`
- `G:\UserCode\minecraft_words\minecraft_words_apk-main\js\vocabularies\minecraft\minecraft_blocks.js`
- `G:\UserCode\minecraft_words\minecraft_words_apk-main\js\vocabularies\minecraft\minecraft_items.js`
- `G:\UserCode\minecraft_words\minecraft_words_apk-main\js\vocabularies\minecraft\minecraft_items_2.js`
- `G:\UserCode\minecraft_words\minecraft_words_apk-main\js\vocabularies\minecraft\minecraft_entities.js`
- `G:\UserCode\minecraft_words\minecraft_words_apk-main\js\vocabularies\minecraft\minecraft_environment.js`

把筛出的 core 卡追加到正式包中，并给它们补齐：

- `id`
- `word`
- `translation`
- `level = core`
- `difficulty`
- `category`
- `tags`
- `example`
- `exampleZh`
- `image`
- `imageSource`
- `sourceProvider = minecraft_words_apk-main`
- `sourceFile`
- `phrase`
- `phraseTranslation`
- `audio = ""`
- `audioVoice = "web-speech-fallback"`

顶层元数据调整为可表达 mixed source，例如：

- `sourceProvider = mixed`
- `sourceProviders = ["mayihaoke", "minecraft_words_apk-main"]`
- 更新 `description`

**Step 3: Run the builder**

Run:

```bash
node "G:\StudyCode\宠物积分系统\scripts\build_minecraft_core_vocab.cjs"
```

Expected: 输出生成摘要，例如 starter 数、core 数、总数、类别分布。

**Step 4: Run contract tests to verify they pass**

Run:

```bash
node "G:\StudyCode\宠物积分系统\prj\minecraft_core_vocab_expansion_contract.test.mjs"
node "G:\StudyCode\宠物积分系统\prj\learning_center_english_quiz_vocab_contract.test.mjs"
```

Expected: PASS。

### Task 4: 让学习机原型复用同一套筛选器

**Files:**
- Modify: `prj/学习机玩法原型/scripts/build_minecraft_typing_pack.cjs`
- Regenerate: `prj/学习机玩法原型/assets/generated/minecraft-typing-expanded.json`
- Optional Modify: `prj/学习机玩法原型/README.md`

**Step 1: Repoint the prototype builder**

把当前原型脚本里的内联筛选逻辑收口到 `scripts/minecraft_vocab_selector.cjs`，只保留原型特有参数：

- 仍只取短词
- 仍强调打字用的 3-7/3-8 字母词
- 仍输出原型自己的 `typing-expanded` 标记

**Step 2: Regenerate the prototype pack**

Run:

```bash
node "G:\StudyCode\宠物积分系统\prj\学习机玩法原型\scripts\build_minecraft_typing_pack.cjs"
```

Expected: 重新生成 `minecraft-typing-expanded.json`，并与正式题库共享主要筛选来源与排序逻辑。

**Step 3: Verify the prototype contract still passes**

Run:

```bash
node "G:\StudyCode\宠物积分系统\prj\学习机玩法原型\verify.mjs"
```

Expected: PASS，确保正式题库扩容不会把学习机原型带坏。

### Task 5: 做一次主线验证并记录结果

**Files:**
- Optional Create: `docs/plans/test-reports/2026-07-08-minecraft-core-vocab-expansion.md`

**Step 1: Run the full verification set**

Run:

```bash
node "G:\StudyCode\宠物积分系统\prj\minecraft_vocab_selector_contract.test.mjs"
node "G:\StudyCode\宠物积分系统\prj\minecraft_core_vocab_expansion_contract.test.mjs"
node "G:\StudyCode\宠物积分系统\prj\learning_center_english_quiz_vocab_contract.test.mjs"
node "G:\StudyCode\宠物积分系统\prj\学习机玩法原型\verify.mjs"
```

如果本地 8000 端口静态服务已启动，再补：

```bash
node "G:\StudyCode\宠物积分系统\scripts\learning-center-smoke.mjs"
```

**Step 2: Record the acceptance snapshot**

记录：

- 正式题库总数
- starter / core 分布
- top 8 类别分布
- 仍然缺本地 mp3 的 core 卡数量
- 是否需要下一步接 `prj\tts` 批量补音频

Expected: 形成一份可以复查的扩题库落地结果，而不是只留下生成后的 JSON 文件。
