# v0.7.44 发布记录

> 发布日期：2026-07-14
>
> 范围：`prj/anki-minecraft-vocab/` 独立 Anki Minecraft 词卡工作台；主站 Pages、账号和 SQLite 部署边界不变。

## 本次发布内容

- 全量处理 11,241 张卡片，保留 231 个末级牌组和原始目录层级。
- 为每张卡生成稳定的 `content`：英文词条、中文释义、中英短语、中英短句、分类和来源。
- 不破解 `≯#...#≮`；原始加密字段不进入网页正文。
- 移除 `哈基米薯仔.png`、`show-*`、长哈希截图及未引用图片 1,186 张；每卡最多保留一张有效图片和一个音频。
- 规范化后 manifest：11,241 cards、231 decks、4,956 curated media、0 encrypted runtime fields。
- Hermes 可执行配置位于 `prj/anki-minecraft-vocab/hermes.yaml`，生产站继续使用独立 `release/current` 链接。

## 验证入口

```powershell
node --check prj/anki-minecraft-vocab/scripts/normalize-anki-minecraft-vocab.mjs
python -m unittest discover -s prj/anki-minecraft-vocab/scripts -p "test_*.py" -v
python -m py_compile prj/anki-minecraft-vocab/scripts/*.py
```

浏览器验收需确认根目录、官方词条、核心单词、搜索短语/短句、折叠目录、图片/音频和移动端抽屉；真实 VPS 域名验收仍由 Hermes 在目标服务器执行，未执行前不得写成线上已发布。
