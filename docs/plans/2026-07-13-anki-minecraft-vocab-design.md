# Anki Minecraft 词卡网页设计

## 目标

在 `prj/anki-minecraft-vocab/` 建立一个独立的静态词卡浏览项目，从参考 `.apkg` 的现代 `collection.anki21` 数据库提取牌组目录、卡片字段和媒体资源，提供目录浏览、搜索、翻卡和音频播放。项目不直接污染主站的 `data/vocab/`，待字段恢复和版权边界确认后再导出精简运行时词库。

## 已确认事实

- 参考包同时包含 `collection.anki2` 和 `collection.anki21`。
- `collection.anki2` 是旧版兼容占位库，只有 1 条“请更新 Anki”提示；真实数据在 `collection.anki21`。
- 现代库包含 11,241 条笔记、11,241 张卡片和约 6,847 个媒体文件。
- 牌组树包含官方词条、核心单词、基础认读、听音辨意、主动输出以及 Minecraft 分类和英语等级分类。
- 参考网页提供公开目录说明，声明官方词条、核心单词、图片、音频、听写检测和词频等能力；本地包中的部分字段以 `≯#...#≮` 形式保存，不能未经确认直接当作明文发布。

## 架构

```text
APKG
  -> scripts/extract_apkg.py
  -> collection.anki21 + media map + deck tree
  -> prj/anki-minecraft-vocab/data/*.json
  -> prj/anki-minecraft-vocab/assets/media/*
  -> static index.html + app.js + styles.css
```

提取脚本只读取用户指定的 `.apkg`，优先选择 `collection.anki21`，解析 `col/decks/models/notes/cards`，将 HTML 字段转为保留原始 HTML 与纯文本的 JSON。媒体文件名通过 `media` 映射解析，网页仅允许引用提取目录内的文件。

## 网页范围

- 左侧/顶部目录筛选：按牌组树折叠、显示数量、选择目录。
- 主区域：当前目录的卡片列表，显示单词/标题、释义可用性、图片和音频状态。
- 卡片详情：正面/背面切换，HTML 安全渲染，播放本地音频，显示所属目录和媒体引用。
- 搜索：对提取出的纯文本、原始字段和牌组路径做客户端过滤。
- 状态：空目录、无明文释义、媒体缺失、加载失败都要显式反馈。
- 页面必须可直接由 `python -m http.server` 提供，不能依赖主站 runtime loader。

## 字段与加密边界

先保留全部字段，不尝试猜测或破解 `≯#...#≮` 字段。解析结果包含 `fieldsRaw`、`fieldsText` 和 `encryptedFieldNames`，确保后续找到模板/密钥时可以重新处理，而无需重新拆包。音频和图片引用属于可验证媒体关系，可以先用于网页展示。

## 目录来源

网页目录以 `collection.anki21` 的牌组路径为事实来源，并用用户提供的 Anki 中文资源网页面作为展示结构和统计文案参考。外部页面只做调研来源，不在网页运行时依赖其接口，也不批量复制其描述图片。

## 验证

- 提取测试：确认选择 `collection.anki21`、笔记/卡片数量、牌组路径、字段数量和媒体映射。
- 数据测试：确认 JSON 可解析、每张卡有稳定 id、媒体路径不越界、HTML 字段未发生意外转义。
- 浏览器测试：确认目录折叠、筛选、搜索、翻卡、音频按钮和移动端布局。
- 运行测试：使用静态服务打开，不使用 `file://`。

