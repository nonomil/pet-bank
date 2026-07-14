# Hermes 快速部署卡

本目录是独立静态站。它不写主站 `data/vocab/`，不进入主站 Pages 制品，也不连接自托管 SQLite。

## 本地验收

```powershell
node --check scripts/normalize-anki-minecraft-vocab.mjs
python -m unittest discover -s scripts -p "test_*.py" -v
python -m http.server 8766 --bind 127.0.0.1
```

打开 <http://127.0.0.1:8766/>，确认根目录 `11,241`、官方词条 `7,578`、核心单词 `3,663`、清洗后媒体 `4,956`，再检查搜索能命中中文/短语/短句、折叠目录、翻卡、图片/音频和移动端抽屉。

如果刚从 APKG 重新提取数据，必须先在项目目录执行：

```powershell
node scripts/normalize-anki-minecraft-vocab.mjs --apply --prune-media
```

规范化完成后再运行测试；不要直接把刚提取的原始 `cards.json` 部署到 Hermes。

本工作台 CSS 会引用仓库根目录的视觉包：

```text
assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/workbench-bg.png
assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/detail-bg.png
```

独立 release 必须一并携带这两张图片，或保持与主站 release 的相对目录结构一致。不要把 `prompts/`、`tmp/minecraft-vocab-visual-raw/` 或 Token24 key 文件复制到生产目录。

## 生产规则

- 使用独立目录 `/srv/pet-bank/anki-minecraft-vocab/releases/<release-id>` 和链接 `/srv/pet-bank/anki-minecraft-vocab/current`。
- 先验证 `index.html`、`data/manifest.json`、`data/decks.json`、`data/cards.json`，再切换 `current`。
- Nginx 根目录只能指向 `current`，不要指向仓库根目录或主站 `site/`。
- 失败只回切上一个 release；不要删除共享目录、原始素材、数据库或用户数据。

完整命令、Nginx 示例和重新提取流程见 [`docs_project/runbooks/self-hosted/ANKI-MINECRAFT-VOCAB-HERMES.md`](../../docs_project/runbooks/self-hosted/ANKI-MINECRAFT-VOCAB-HERMES.md)。
