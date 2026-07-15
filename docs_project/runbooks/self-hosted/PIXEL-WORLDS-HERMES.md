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
node scripts/test-pixel-worlds-assets-contract.mjs
node scripts/test-pixel-story-content-contract.mjs
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

# The asset contract must report 80 unique node scenes / 80 node props / 80 route-specific node icons.
# It also assembles a temporary Pages artifact and verifies the WebP paths.
```

如果服务器带有可用 Chrome/Playwright，再运行：

```bash
PETBANK_BASE_URL="http://127.0.0.1:8765/" node scripts/test-exploration-entry-browser.mjs
PETBANK_BASE_URL="http://127.0.0.1:8765/" node scripts/test-pixel-story-pagination-browser.mjs
PETBANK_BASE_URL="http://127.0.0.1:8765/" node scripts/test-pixel-story-all-chapters-browser.mjs
```

地图交互约定：每条路线分为 4 页，每页最多 5 个节点；未完成前置节点时，后续节点不渲染卡片或气泡。完成当前节点后，刷新地图才显示下一节点。故事舞台按“场景图片 → 图片下方对话栏 → 互动按钮”排列，对话栏不覆盖场景图。

故事内容约定：每个 `05-pixel-worlds-story/levels/*.json` 至少包含 11 段可读内容和 1 个 `activity`；科幻、森林、方块三条主线各 20 节点按四幕推进，侦探 20 节点按“失散 → 追踪 → 拼合 → 回家”组成隐藏支线。内容门禁会拒绝 `。，`、旧模板收尾和路线内超过 4 次的固定对白。学习策略仍是 `recognition-only`，每节点只保留自然识字锚点，不把对白改成数学题或答题统计。

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

提示词在 `docs/探索地图故事/像素对话故事/04-三世界与侦探小游戏生图提示词.md`。当前使用 Bee API 的 OpenAI 兼容 `gpt-image-2` 接口；密钥从本机 key 文档读取，不能写进命令历史、Git 或回复：

```powershell
python -X utf8 .codex/skills/gpt-image-bee-workflow/scripts/bee_image_workflow.py probe `
  --out tmp/pixel-worlds-bee-probe.json
```

先确认模型探针返回包含 `gpt-image-2`，再生成图片。必须检查响应 JSON、HTTP 状态、PNG 尺寸和浏览器 `naturalWidth`；如果出现 401、模型缺失或重复超时，停止重试，保留现有素材并记录供应商错误。不要把失败 JSON 当作图片发布。

本次节点素材使用 Bee API 的 `gpt-image-2` 完成；请求 `1536x1024` 后先校验原始 PNG，再转换为正式 WebP。80 个节点全部有独立场景，验收以实际文件尺寸、可解码性和浏览器 `naturalWidth` 为准。

### 节点素材与分辨率约束

- 四条路线共 80 个节点，每个节点必须使用自己的 `assets/story/pixel-worlds-v1/scenes/<track>/<levelId>.webp`，禁止把旧森林/洞穴背景作为正式节点图。
- 节点场景直接单张请求 `1536x1024`；服务端实际尺寸以返回文件为准，不能把低分辨率拼图裁成背景后放大。
- 角色和道具使用联图节省请求，但当前正式小素材只允许 4x4 联图，实际每格约 `384x256`；8x8 联图只可留在 `tmp/`，不得接入发布制品。
- 生图返回后必须检查原始 PNG 与正式 WebP 的可解码性、尺寸、文件大小和浏览器 `naturalWidth`；失败节点记录在 `tmp/pixel-worlds-bee-scenes.log`，不得用占位图伪装完成。
- Bee API 生图恢复使用单请求串行脚本 `scripts/generate-pixel-worlds-scenes-bee.mjs`；脚本只处理缺失节点，成功后才写入正式 WebP，失败记录后继续。
- 场景背景禁止使用 8x8 联图裁切后放大；正式背景必须单张生成，目标请求尺寸 `1536x1024`，实际返回尺寸以文件检查结果为准。

当前素材状态（2026-07-15）：80/80 个节点已有独立场景 WebP、80/80 个节点道具 WebP、80/80 个路线专属节点图标 WebP；科幻、森林、方块、侦探均为 20/20。图标来自四张 `1536x1024` 路线素材表，经透明化、碎片过滤和语义命名后接入。全部文件均已通过素材契约和发布制品检查，浏览器验证四路线的地图、节点图标、场景背景与道具实际加载。

当前故事状态（2026-07-15）：80/80 个节点已完成剧情文本优化；科幻 → 森林 → 方块 → 回家门的主线转场统一，侦探 20 节点补齐跨世界案件收束。通过 `scripts/test-pixel-story-content-contract.mjs` 后，才可报告内容层完成。

```powershell
$env:PIXEL_SCENE_BEE_DELAY_MS = '5000'
$env:PIXEL_SCENE_BEE_RETRIES = '1'
node scripts/generate-pixel-worlds-scenes-bee.mjs
```

探针必须返回包含 `gpt-image-2` 的模型列表。恢复脚本会跳过已存在的正式 WebP；不要并发运行多个恢复脚本，也不要把响应 JSON、提示词或 API key 发布到 `site`。

## 5. 回滚

```bash
ln -sfn /srv/pet-bank/releases/<previous-release-id> /srv/pet-bank/current
nginx -t && systemctl reload nginx
```

本版本无数据库迁移，回滚只切换 release；不要删除新 release，直到 canary 记录完成。
