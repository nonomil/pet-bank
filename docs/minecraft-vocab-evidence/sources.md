# 来源记录

抓取日期：2026-07-20（Asia/Shanghai）

## NGSL 1.2

- 标题：New General Service List 1.2
- 页面：https://www.newgeneralservicelist.com/new-general-service-list
- 数据：https://www.newgeneralservicelist.com/s/NGSL_12_stats.csv
- 来源层级：词表维护方官网及其直接下载文件
- 本地快照：`raw/NGSL_12_stats.csv`
- SHA-256：`2098bab8955a120a9766c6282a51d7d578c6cb0a7d946600d2ffb73ba25a0b44`
- 关键摘录：官方页面说明 NGSL 1.2 是一个 2809-word list，并说明该版本于 2023 年 4 月发布；CSV 的列为 `Lemma,SFI Rank,SFI,Adjusted Frequency per Million (U)`。
- 用途：为通用英语 lemma 提供可复核 rank；不把 Minecraft 专有名词强行映射为常用词。
- 使用边界：外部表仅用于分类证据，不直接替代项目中文释义、例句、图片或音频。

## Cambridge YLE 阶段锚点

- Pre A1 Starters：https://www.cambridgeenglish.org/exams-and-tests/starters/
  - 关键摘录：页面将 Pre A1 Starters 描述为 Cambridge English Young Learners 三个资格中的第一个，并面向 children。
- A1 Movers：https://www.cambridgeenglish.org/exams-and-tests/movers/
  - 关键摘录：页面将 A1 Movers 描述为三个儿童资格中的第二个。
- A2 Flyers：https://www.cambridgeenglish.org/exams-and-tests/flyers/
  - 关键摘录：页面将 A2 Flyers 描述为三个儿童资格中的第三个。
- 来源层级：Cambridge English 官方考试页面。
- 用途：给项目已有幼儿园、幼小衔接和低年级词表提供阶段锚点。
- 使用边界：当前官方页面可核实阶段关系，但没有直接提供可用于逐词匹配的公开词表下载链接；因此运行字段使用 `curriculum-proxy`，不是官方逐词命中。

## Oxford 3000/5000 CEFR 快照

- 页面：https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000
- 抓取方式：读取公开 HTML 中的 `li[data-hw][data-ox3000][data-ox5000]`，按词面去重并保留最低 CEFR 等级。
- 本地快照：`raw/OXFORD_3000_5000_CEFR.csv`
- 快照 SHA-256：`fbf7bb33b5eff306183c149d82cff3211a24c9becec086ee9a9c83123dba8213`
- 原始 HTML SHA-256：`74b471082c6b02ce3bf51e662c4b63a86905d1f4e2d6eed0db480b8e705d0b26`
- 关键摘录：Oxford 页面说明 Oxford 3000 是 3000 个核心词，按 Oxford English Corpus 频率和学习者相关性选择，并为词条标注 CEFR A1-B2；页面同时说明可以按 CEFR 筛选、浏览和下载词表。
- 用途：给运行卡片提供 exact CEFR/通用学习词表交叉证据。
- 使用边界：Oxford 3000/5000 面向英语学习者，不是 Cambridge YLE 年龄清单，也不对 Minecraft 专有词做语境频率认证。

## 项目内部词表

- `data/vocab/单词库_分级/01_幼儿园/幼儿园完整词库.js`
- `data/vocab/单词库_分级/04_我的世界/minecraft_basic.js`
- `data/vocab/单词库_分级/03_小学_高年级/小学低年级基础.js`
- 来源层级：本项目已存在的课程词表。
- 用途：逐词匹配项目阶段；与 Cambridge 页面结合后形成可审计的年龄代理证据。
- 使用边界：这些文件不是 Cambridge 官方词表，不能在产品文案中写成官方年龄认证。

外部图片、音频和 Minecraft 官方素材没有复制进本目录，也不进入 Pages 发布制品；本资料包只保留词库分类证据。
