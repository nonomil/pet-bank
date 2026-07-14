# Pixel Worlds / Hermes 执行手册

> 给 Hermes 或其他部署 AI 使用。目标是发布三世界像素故事，并在生图供应商不可用时保持可回滚。

## 1. 发布前阅读和硬规则

1. 先读 `AI-HERMES-DEPLOY.md`、`UPGRADE-AND-BACKUP.md` 和本文件。
2. 不删除 `/srv/pet-bank/shared/`，不把仓库根目录作为 Nginx 根目录。
3. 本版本没有数据库迁移；不得为了故事包创建 SQLite 表或修改 migration。
4. 不把 `docs/生图/`、`.env`、API key、浏览器 profile 或 `tmp/` 发布到 `site`。
5. 生图供应商返回 404/超时是外部素材阻断，不得用随机占位图覆盖已验证素材；保留当前 release 并报告失败响应。

## 2. 新 release 验收

```bash
release_id="$(date +%Y%m%d-%H%M%S)"
release_dir="/srv/pet-bank/releases/$release_id"
git clone https://github.com/nonomil/pet-bank.git "$release_dir"
cd "$release_dir"

node scripts/test-pixel-worlds-contract.mjs
node scripts/test-explore-mode-contract.mjs
node scripts/test-pages-fast-gate-contract.mjs
node scripts/test-static-route-entries.mjs
node scripts/assemble-pages-artifact.mjs site

test -f site/data/story-packs/05-pixel-worlds-story/manifest.json
test -f site/js/pixel-story-engine.js
test -f site/js/pixel-story-map.js
test -f site/assets/story/pixel-worlds-v1/maps/sci-fi.png
test -f site/assets/story/pixel-worlds-v1/maps/forest.png
test -f site/assets/story/pixel-worlds-v1/maps/block.png
test -f site/assets/story/pixel-worlds-v1/maps/detective.png
```

如果服务器带有可用 Chrome/Playwright，再运行：

```bash
PETBANK_BASE_URL="http://127.0.0.1:8765/" node scripts/test-exploration-entry-browser.mjs
PETBANK_BASE_URL="http://127.0.0.1:8765/" node scripts/test-pixel-story-all-chapters-browser.mjs
```

## 3. 静态站点与 API canary

```bash
cd "$release_dir/prj/petbank-server/deploy"
docker compose -p petbank-api up -d --build
curl --fail http://127.0.0.1:3000/api/v1/health

ln -sfn "$release_dir" /srv/pet-bank/current
nginx -t && systemctl reload nginx
curl --fail http://127.0.0.1/
curl --fail http://127.0.0.1/app/
curl --fail http://127.0.0.1/explore/
```

健康检查和静态文件检查都成功后，才向用户报告 release 已切换。故事进度保存在孩子端浏览器 Profile，不进入 SQLite API；不要把“页面可访问”描述成“孩子故事进度已云端同步”。

## 4. 生图重新生成（可选，不阻塞当前发布）

提示词在 `docs/探索地图故事/像素对话故事/04-三世界与侦探小游戏生图提示词.md`。当前使用 TokenX24 的 OpenAI 兼容 GPT-IMAGE-2 接口；密钥从本机 `TOKEN24.md` 读取，不能写进命令历史、Git 或回复：

```powershell
python -X utf8 scripts/token24-image-generate.py `
  --prompt-file "tmp/pixel-worlds-prompts/sci-fi-map.txt" `
  --out "assets/story/pixel-worlds-v1/maps/sci-fi.png" `
  --size 1536x1024 --quality medium
```

先用 `GET https://tokenx24.com/v1/models` 确认响应 200 且包含 `gpt-image-2`，再生成图片。必须检查响应 JSON、HTTP 状态、PNG 尺寸和浏览器 `naturalWidth`；如果出现 401、模型缺失或重复超时，停止重试，保留现有素材并记录供应商错误。不要把失败 JSON 当作图片发布。

本次实测四张地图均成功落盘；请求 `1536x1024` 时服务实际返回 `1536x864` 的 16:9 PNG，验收以实际文件尺寸和浏览器加载结果为准。

## 5. 回滚

```bash
ln -sfn /srv/pet-bank/releases/<previous-release-id> /srv/pet-bank/current
nginx -t && systemctl reload nginx
```

本版本无数据库迁移，回滚只切换 release；不要删除新 release，直到 canary 记录完成。
