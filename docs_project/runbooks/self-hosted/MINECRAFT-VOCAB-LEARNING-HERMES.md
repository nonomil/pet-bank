# Minecraft 单词远征 Hermes 执行手册

本手册给 AI/Hermes 部署主站 `v0.7.46` 使用。它覆盖主站学习页、Minecraft 视觉素材包与 Pages 制品；完整 Anki 浏览器是另一个独立静态站，必须遵循 [ANKI-MINECRAFT-VOCAB-HERMES.md](./ANKI-MINECRAFT-VOCAB-HERMES.md)。

## 目标和边界

- 主站入口：`/app/learn/minecraft-vocab/`。
- 主站默认学习池：96 张已审查、带本地配图/发音或可回退播放的词卡。
- 参考词表：`data/learn/external/mayihaoke/word-cards.json`，当前 500 条结构化快照；每条有中英短语和中英短句，生产运行不实时请求外站。
- 内容补全脚本：`node scripts/enrich_minecraft_vocab.cjs --apply`；内容门禁：`node scripts/test-minecraft-vocab-content.mjs`。更新词表后必须先跑脚本再跑门禁。
- 完整 Anki 项目：`prj/anki-minecraft-vocab/`，11,241 张卡片，独立 release/current，Pages 制品必须排除。
- 本地视觉包：`assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/`，运行时只使用根目录 `manifest.json` 和 9 张正式 PNG；`prompts/` 和 `tmp/` 原始图不得发布。
- 无数据库迁移；孩子学习状态仍写本地 Profile 快照，奖励走现有 `GameRewardReceipts` 和 `PetBankPoints`。

## AI 执行前检查

```bash
git status --short
node --version
test -f index.html
test -f data/learn/external/mayihaoke/word-cards.json
test -f js/minecraft-vocab-page.js
test -f js/minecraft-vocab-session.js
test -f assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/manifest.json
```

不要执行 `git clean -fdx`、全目录覆盖、删除 `/srv/pet-bank/shared/`，也不要把真实 `server.env`、数据库或浏览器 Profile 带入 release。

## 发布前验证

在 release 工作目录执行：

```bash
node scripts/test-mayihaoke-minecraft-words.mjs
node scripts/test-minecraft-vocab-content.mjs
node scripts/test-minecraft-vocab-visual-assets.mjs
node scripts/test-minecraft-vocab-session.mjs
node scripts/test-page-router-contract.mjs
node scripts/test-static-route-entries.mjs
node scripts/learning-center-smoke.mjs
node scripts/run-full-regression.mjs
node scripts/assemble-pages-artifact.mjs site
```

如果需要浏览器检查，先在仓库根目录启动静态服务：

```bash
python -m http.server 8765 --bind 127.0.0.1
MMWG_E2E_BASE_URL=http://127.0.0.1:8765/app/learn/minecraft-vocab \
  node scripts/test-minecraft-vocab-browser.mjs
```

浏览器验收必须确认：首次打开能看到今日 11 步远征；完成 11 步后成长分增加 10；同一天再次完成不重复发分；刷新后会话状态可恢复；Profile 切换后会话不串号；390px 宽度下底部操作区和文字不横向溢出。

首页、阶段背景、词卡框和完成页必须使用本地无嵌入文字素材；不要把参考站外链图片、prompt、raw 原图、失败 JSON 或密钥材料部署到运行时。若需重新生图，在仓库根目录执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\generate-minecraft-vocab-visuals.ps1
```

该脚本默认让 Python 生成器读取 `docs/生图/生图接口资源key/TOKEN24.md`，不要把 token 复制到命令行、日志或文档。Windows PowerShell 5.1 下不要把中文 key 路径写进脚本默认参数；保留当前“空参数交给 Python 默认值”的写法。

## Pages 制品检查

```bash
rm -rf _site_verify
node scripts/assemble-pages-artifact.mjs _site_verify
test -f _site_verify/app/learn/minecraft-vocab/index.html
test -f _site_verify/js/minecraft-vocab-page.js
test -f _site_verify/js/minecraft-vocab-session.js
test -f _site_verify/assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/manifest.json
test -f _site_verify/assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/study-camp-hero.png
test ! -d _site_verify/assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/prompts
test ! -d _site_verify/prj/anki-minecraft-vocab
```

用临时静态服务打开 `_site_verify/app/learn/minecraft-vocab/`，不要只打开仓库根目录。确认深层入口重定向回相对 `index.html` 后，脚本、样式和图片仍能加载。Nginx 根目录只能是 `/srv/pet-bank/current/site`。

## 生产发布顺序

```bash
release_id="$(date +%Y%m%d-%H%M%S)"
release_dir="/srv/pet-bank/releases/$release_id"
git clone --branch main https://github.com/nonomil/pet-bank.git "$release_dir"
cd "$release_dir"
node scripts/assemble-pages-artifact.mjs site
```

后端按 [AI-HERMES-DEPLOY.md](./AI-HERMES-DEPLOY.md) 启动并检查：

```bash
curl --fail http://127.0.0.1:3000/api/v1/health
curl --fail http://127.0.0.1/app/learn/minecraft-vocab/
curl --fail http://127.0.0.1/app/
```

只有静态制品、API health、Minecraft 深层路由和至少一个现有主站入口都通过，才执行：

```bash
ln -sfn "$release_dir" /srv/pet-bank/current
nginx -t && systemctl reload nginx
```

## 回滚

若 API health、深层资源、奖励重复、Profile 隔离或外部 canary 失败：

1. 不删除新 release，也不改动 `/srv/pet-bank/shared/`。
2. 将 `/srv/pet-bank/current` 回切到上一已验证 release。
3. 重新加载 Nginx，验证根首页、`/app/`、`/app/learn/minecraft-vocab/` 和 `/api/v1/health`。
4. 保留失败 release、测试输出和失败原因，修复后使用新的 release-id 重试。

## 独立 Anki 站

主站发布不会部署或更新 Anki 站。若同时发布 Anki 站：

- 使用 `/srv/pet-bank/anki-minecraft-vocab/releases/<release-id>` 和 `/srv/pet-bank/anki-minecraft-vocab/current`。
- 先验证 `index.html`、`data/manifest.json`、`data/decks.json`、`data/cards.json`，再切换 current。
- 不复制 `.apkg` 到 Pages，不连接 SQLite，不删除旧 release 或原始素材。
