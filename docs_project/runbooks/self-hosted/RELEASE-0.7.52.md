# v0.7.52 发布记录

> 发布日期：2026-07-15
>
> 范围：探索地图 UI 收口、绘本入口迁移、故事/绘本浏览器验收和本地临时制品清理；无数据库迁移。

## 交付内容

- 探索地图移除重复顶部说明和模式切换条，三世界标签移动到地图上方。
- 保留原有侦探小游戏入口、解锁条件和当前像素地图内的进入链路。
- 地图继续使用分页小地图；对话栏位于场景图片下方，支持移动端布局和键盘切换。
- 绘本入口迁移到“学习”页面的“绘本”选项卡，通过桥接模块加载绘本目录和阅读器入口。
- 完成 8 本绘本入口、故事章节、首页入口和静态深层路由检查。
- 修复 Pages 制品组装器未放行 8 张现有 playground 卡片 `.webp` 素材的问题，避免静态制品缺图。
- 清理本地 `tmp/`、历史 `_site_*` 验证目录、`docs.zip` 和未引用根目录截图；这些内容不属于 Pages 发布制品。

## 本地验证入口

```powershell
node scripts/test-picturebooks-contract.mjs
node scripts/test-learning-picturebook-tab-browser.mjs
node scripts/test-pixel-story-map-layout-browser.mjs
node scripts/test-pixel-story-browser.mjs
node scripts/test-home-explore-layout.mjs
node scripts/test-pixel-story-all-chapters-browser.mjs
node scripts/test-pixel-story-stage-shell.mjs
node scripts/test-pixel-dialogue-story-contract.mjs
node scripts/test-static-route-entries.mjs
node scripts/test-pages-fast-gate-contract.mjs
git diff --check
```

需要浏览器的测试应先启动 `node scripts/local-server.mjs`，默认地址为 `http://127.0.0.1:7000/`。首页真实入口回归使用 `node scripts/test-home-browser.mjs`，覆盖 `/app`、顶部导航、首页主线、三张探索地图和侦探 bonus。测试截图和报告只允许写入 `tmp/`，不应写入根目录、`docs_project/` 或 Pages 制品目录。

## 本次验证结果

```text
picturebooks portal contract: PASS (8 stories)
pixel dialogue story contract: PASS (4 chapters)
learning picturebook tab browser: PASS (8 portal cards, no errors)
pixel story map layout browser: PASS (desktop/mobile, no failures)
pixel story browser: PASS (3 worlds, 60 nodes, 20 detective nodes, no errors)
home explore layout browser: PASS (3 modes, 12 forest nodes, no errors)
pixel story all chapters browser: PASS (4 chapters, no errors)
pixel story stage shell browser: PASS (desktop shell and map layout, no errors)
static route entries: PASS (41 routes)
Pages fast gate workflow contract: PASS
Pages artifact assembly: PASS (required entries and assets present, forbidden entries absent)
git diff --check: PASS
```

## Hermes 发布步骤

1. 在新 release 目录执行上面的契约、浏览器和 Pages fast gate 验证。
2. 执行 `node scripts/assemble-pages-artifact.mjs _site_verify`，确认主站首页、`/app/learn/`、绘本入口和探索地图深层入口存在。
3. 检查 `_site_verify/` 不包含 `tmp/`、`docs.zip`、历史 `_site_*` 目录、测试截图或 API key。
4. Nginx 只指向 `/srv/pet-bank/current/site`；切换前验证根首页、`/app/learn/`、绘本入口、探索入口和 API health。
5. 保留旧 release；失败时只回切 `current`，不删除 `/srv/pet-bank/shared/`，不修改 SQLite migration。

## 数据与回滚边界

- 本版本没有 SQLite migration，也没有新增线上后端依赖。
- 绘本和故事内容仍是静态发布资源；加载失败必须显示页面内 fallback，不能把失败响应当作成功内容。
- 本次根目录清理只涉及已确认的本地临时产物，不影响 `assets/`、`data/`、`docs/`、`docs_project/` 和用户已有未提交修改。
- 回滚使用上一版 Pages release；不要恢复已清理的测试制品，它们不是运行时资源。
