# Minecraft 单词卡学习接入设计

## 背景

当前仓库已经具备三块可复用能力：

- `prj/anki-minecraft-vocab/` 保存从 APKG 提取出的完整 Anki 独立浏览器，作为素材档案和深度浏览入口。
- `data/learn/packs/english-mc-hybrid-2026/` 已有 96 张可播放的混合词卡：参考站起步词与 Minecraft 核心词各自保留来源标记。
- `LearnCenter`、`EnglishVocabProgress`、Profile 快照和 `GameRewardReceipts` 已提供学习渲染、词卡进度隔离和奖励去重基础。

本次接入的目标是把这些能力收口成主站里的 Minecraft 单词学习体验：孩子可以从学习中心进入“今日远征”，按固定而短的节奏完成词卡练习；有效完成后只通过统一奖励 receipt 获得成长积分和宠物经验；完整 Anki 档案仍保持独立部署，不进入 Pages 主制品。

## 方案

### 数据层

1. 保留 `prj/anki-minecraft-vocab/` 原样作为完整素材浏览器，不将原始 `.apkg` 放入仓库。
2. 通过参考站公开结构化接口抓取本地快照，保存原始来源、抓取时间和字段映射；不把未获授权的参考站原图、音频或完整 HTML 直接打包。
3. 主站继续使用 96 张已审查的本地可播放词卡作为默认学习池；完整参考站词表作为本地审查和后续扩充素材，不在首次会话一次性加载。
4. 词卡的 `id`、`word`、`translation`、`example`、`exampleZh`、`image`、`audio` 和 `sourceProvider` 字段保持向后兼容。外部追加词必须去重、检查必填字段，并默认不自动激活。

### 主站入口与页面

新增 `minecraft-vocab` 页面路由，属于学习 tab 的叶子页，路径为 `/app/learn/minecraft-vocab`，并提供深层 Pages 入口。入口从学习中心 Minecraft 卡片进入，页面不取代现有资料包、故事章节或 Anki 独立站。

页面分为两个明确状态：

- **今日远征首页**：显示本日 11 个任务、复习/新词/主动回忆/场景句四段进度、已掌握数量、连续学习和可获得成长分；首屏使用已有 Minecraft 学习封面和本地词卡视觉素材。
- **学习会话**：一张卡一个动作，移动端底部固定操作区；图片、单词、音标/中文、音频、释义切换和错误反馈都在同一张卡内完成。所有按钮有键盘焦点和可读标签，不用 emoji 充当功能图标。

### 学习节奏

每个本地日生成稳定、可恢复的会话队列：

1. 复习热身 2 张：优先选择 `learning` 词，其次选择最近复习的已掌握词。
2. 新词输入 5 张：从当前尚未见过的词中按稳定顺序选择。
3. 主动回忆 3 张：先显示图像/中文，孩子输入或选择英文；提交后显示正确答案。
4. 场景句 1 张：在 Minecraft 语境例句中完成词语选择。

会话一共 11 个有效动作。每次动作先调用 `EnglishVocabProgress.record()` 并检查 `persisted`；保存失败时停止推进并给出重试提示。会话状态另外保存当前日期、阶段、队列和已完成动作，按 Profile 隔离，刷新或切换页面后可以恢复。

### 奖励规则

完成全部 11 个动作后调用 `GameRewardReceipts.claim()`：

- `source`: `minecraft-vocab`
- `eventId`: `session:<localDate>`
- `points`: 10
- 由现有奖励桥同时发放等额宠物经验

同一 Profile 同一自然日只能成功领取一次。任何词卡进度写入失败、会话状态写入失败或奖励 API 不可用，都不能显示完成或发放积分。

### 生命周期与兼容

- 新模块使用 `MinecraftVocabSession` 命名空间，并由 `runtime-loader` 按页面加载。
- 离开 `minecraft-vocab` 页面时停止音频和会话事件，不保留跨页面 timer。
- 新增 `petbank_minecraft_vocab_session_v1_{profileId}` 注册为 Profile 快照键；不会触碰账号、设备或主站积分键。
- 现有 `learn-lesson` 词卡页和 `EnglishVocabProgress` 保留，独立页复用它们的数据和进度，不产生第二套词卡账本。

## 验证

1. 先为会话规划、Profile 隔离、奖励去重和失败回滚写 Node 合同测试，并确认测试在实现前按预期失败。
2. 为路由、runtime bundle、深层静态入口和数据 manifest 增加合同检查。
3. 用浏览器测试验证桌面和 390px 移动端：入口、首屏、四阶段节奏、音频/图片、答题推进、刷新恢复、完成发分、重复完成不重复发分、切换 Profile 隔离。
4. 运行学习中心 smoke、主站全量回归、后端单测、静态路由检查和 Pages 制品组装，确认独立 Anki 项目仍不进入 Pages 制品。
5. 更新 `CHANGELOG.md`、学习中心模块说明、数据契约和 Hermes 部署文档，记录参考站来源及媒体授权边界。

## 非目标

- 不把完整 11,241 张 Anki 卡全部加载进主站首屏。
- 不破解 Anki 标记为加密的字段。
- 不未经授权镜像参考站原图、音频、完整卡片 HTML。
- 不改造现有积分账本或 Profile swap 机制。
