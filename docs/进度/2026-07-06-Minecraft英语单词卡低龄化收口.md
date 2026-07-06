# 2026-07-06 · Minecraft 英语单词卡低龄化收口

## 背景

这一轮是在 `english-mc-hybrid-2026` 英语资料包基础上继续推进：先把外部 Minecraft 英语阅读资源纳入本地学习闭环，再把单词学习界面从“信息很多的资料页”收口成更适合幼小衔接孩子使用的卡片式体验。

核心判断：

- 孩子入口要先看图、听音、点一个明确动作
- 单页展示词量要少，避免 20 多张卡同时出现
- 奖励反馈要轻量可见，例如星星、阶段进度和兑换券
- 图片优先使用参考网页资源，后续再逐步替换为统一生成图

## 本轮完成

### 1. 英语资料包补成“故事 + 小测 + 单词卡”

- `data/learn/packs/english-mc-hybrid-2026/manifest.json`
  - 新增 `minecraft-vocab` 模块入口
  - 资料包模块数从 4 个扩展到 5 个
- `data/learn/packs/english-mc-hybrid-2026/modules/mcbook56-story.json`
  - 前三章补齐每章 3 道轻测验
  - 完成本地小测后再进入学习完成闭环
- `data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json`
  - 首批沉淀 24 个 Minecraft 场景词
  - 每张词卡包含中英例句、干扰项、图片、音频和来源字段

### 2. 单词学习界面低龄化

- `js/learn-center.js`
  - 词卡从多列网格改为一页一张大卡
  - 增加 `认识了`、`再看一次`、`下一张` 三个主要动作
  - 支持本地 mp3 点读播放
  - 支持星星进度、6 阶段导航、掌握统计和兑换券反馈
- `css/learn-center.css`
  - 新增大图词卡、星星进度、低龄化按钮和移动端适配
  - 移动端保持单列，不产生横向滚动
- `js/english-vocab-progress.js`
  - 新增词卡掌握状态、连续答对计数与 10 词兑换券

### 3. 参考资源、图片与配音落地

- `scripts/crawl_mayihaoke_resources.mjs`
  - 抓取 mayihaoke 静态资源快照，保留路由、chunk、候选词和资源线索
- `data/learn/external/mayihaoke/resources.json`
  - 固化本次参考资源快照，便于后续复核和重新裁图
- `assets/learn/english-vocab/`
  - 落地参考图裁切与统一词卡封面
  - 24 个单词补齐本地英文 mp3，来源为 `prj/tts` 的 `edge_tts`

## 涉及文件

- `CHANGELOG.md`
- `css/learn-center.css`
- `js/learn-center.js`
- `js/english-vocab-progress.js`
- `js/runtime-loader.js`
- `data/learn/external/mayihaoke/resources.json`
- `data/learn/packs/english-mc-hybrid-2026/manifest.json`
- `data/learn/packs/english-mc-hybrid-2026/modules/mcbook56-story.json`
- `data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json`
- `assets/learn/english-vocab/`
- `scripts/crawl_mayihaoke_resources.mjs`
- `scripts/learning-center-smoke.mjs`
- `prj/english_vocab_progress.test.mjs`
- `prj/learning_center_english_quiz_vocab_contract.test.mjs`
- `prj/mayihaoke_resource_snapshot_contract.test.mjs`
- `docs/plans/2026-07-06-minecraft-english-quiz-vocab.md`
- `docs/英语学习/Minecraft--英语学习.md`

## 验证

本轮提交前使用以下命令验收：

```bash
node prj/english_vocab_progress.test.mjs
node prj/learning_center_english_quiz_vocab_contract.test.mjs
node prj/mayihaoke_resource_snapshot_contract.test.mjs
node scripts/learning-center-smoke.mjs
git diff --check
```

验收重点：

- 词卡进度、连续掌握与兑换券状态可独立读写
- 英语资料包 manifest、章节 quiz 与 vocab 数据结构完整
- mayihaoke 参考资源快照可复查
- 学习中心 smoke 覆盖导航、英语包、测验门禁、词卡与移动端关键结构
- `git diff --check` 不出现需要修复的空白错误

结果：

- 词卡进度契约、英语 quiz/vocab 数据契约、mayihaoke 资源快照契约均通过
- `learning-center-smoke` 通过 `104/104`
- `git diff --check` 仅提示 Windows CRLF 转换，没有需要修复的空白错误

## 当前结论

Minecraft 英语模块已经从“外部阅读入口”推进到“本地可记录、可点读、可奖励”的轻学习闭环。当前 UI 更接近低龄孩子能接受的一页一卡模式，后续可以继续往两个方向扩展：

1. 用 Agnes 统一生成缺失词卡图，替换临时通用封面
2. 在当前卡片壳上继续实验“小霸王学习机”式单词/打字/拼音游戏入口
