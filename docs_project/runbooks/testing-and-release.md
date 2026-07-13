# 运行与验证入口

> 当前基线：2026-07-13。测试文件是否存在、回归顺序和 Pages 门禁以代码脚本和 workflow 为准；本文件只描述怎么选入口。

## 1. 本地启动

项目依赖 HTTP 服务读取 `data/`、学习包和故事 JSON；不要直接用 `file://` 作为完整验收方式。

```powershell
# Windows 一键启动
.\启动服务.bat

# 或手动启动
python -m http.server 8765 --bind 127.0.0.1
```

默认地址：`http://127.0.0.1:8765/`。需要自定义地址时设置 `PETBANK_BASE_URL`，但必须确保 `index.html` 可访问。

## 2. 快速检查

```powershell
# 不需要本地服务的静态/契约检查
node scripts/test-pixel-story-contract.mjs
node scripts/test-high-priority-sync.mjs
node --check js/app.js
node scripts/test-pages-fast-gate-contract.mjs
node scripts/test-regression-runner-integrity.mjs
node scripts/test-no-legacy-account-runtime.mjs
node scripts/test-static-route-entries.mjs
node prj/runtime_loader_route_base_contract.test.mjs
node prj/route_aware_shell_contract.test.mjs
node prj/profile_isolation_journey_simulation.mjs

# 轻量浏览器 smoke，需要本地服务和可用 Chrome
node scripts/smoke.mjs
```

## 3. 全量回归

```powershell
node scripts/run-full-regression.mjs
```

runner 会：

1. 先检查 `PETBANK_BASE_URL/index.html` 可访问。
2. 按 `scripts/run-full-regression.mjs` 中的 `TASKS` 顺序执行。
3. 每项使用 `PETBANK_REGRESSION_TASK_TIMEOUT_MS`（默认 120 秒）超时控制。
4. 首个失败即停止并报告任务名；不要只看最后一行。

runner 是当前回归清单的唯一来源。新增测试后要么接入 runner，要么在对应专项 runbook 记录；不要手工复制一份长期清单到文档。

浏览器截图和临时报告默认写 `tmp/test-artifacts/`，可用 `PETBANK_TEST_ARTIFACT_DIR` 指定。不要把测试产物写入 `docs/发布/`。

## 4. 按改动范围选择验证

| 改动范围 | 最小验证 |
| --- | --- |
| 每日任务/宝箱/日期 | `node scripts/test-daily-state.mjs` |
| 英语词汇/profile | `node scripts/test-english-vocab-profile-scope.mjs` |
| 奖励/积分/重复结算 | `node scripts/test-core-reward-policy.mjs`、`node scripts/test-game-reward-receipts.mjs`、`node scripts/test-task-reward-events.mjs` |
| 首页/孩子主线/复盘 | `node scripts/test-child-journey-home.mjs`、`node scripts/test-child-journey-feedback.mjs`、`node prj/growth_review_insights_contract.test.mjs` |
| 宠物/照料/成长 | `node scripts/test-pet-care-daily-state.mjs`、`node scripts/test-pet-growth-feedback.mjs`、`node scripts/test-pet-growth-history.mjs` |
| 路由/深层页面 | `node scripts/test-static-route-entries.mjs`、`node prj/route_aware_shell_contract.test.mjs`、`node scripts/test-playground-entry-shell.mjs` |
| 学习中心 | `node scripts/learning-center-smoke.mjs` |
| 独立小游戏 | 对应原型目录的 `verify.mjs`/simulation，以及 runner 中的同名任务 |
| Pages 资源/发布 | fast gate + `node scripts/assemble-pages-artifact.mjs _site_verify` |
| 自托管后端 | `node --test prj/petbank-server/test/*.test.mjs` |
| 积分/宠物高优先级自动同步 | `node scripts/test-high-priority-sync.mjs`、`node scripts/test-parent-account-browser.mjs` |
| 跨模块/全局改动 | 启动静态服务后 `node scripts/run-full-regression.mjs` |

## 5. GitHub Pages 门禁

`.github/workflows/deploy.yml` 当前顺序是：

```text
checkout
  -> Node.js 20
  -> Pages fast gate
  -> assemble-pages-artifact
  -> upload/deploy
```

fast gate 必须在制品组装前执行，并包含：

- `scripts/test-pages-fast-gate-contract.mjs`
- `node --check js/app.js`
- 静态路由入口检查
- runtime loader 路由基址合同
- route-aware shell 合同
- Profile 隔离模拟

不要把依赖本地 HTTP 服务的 full regression 塞进 Pages fast gate。发布资源改动还要检查 `_site_verify` 中的主站、深层入口、学习机、像素探险和打字防线运行资源。

## 6. 后端验证

当前后端验证配置、数据库路径、迁移幂等、认证/家庭/孩子/快照 API 和自托管运维脚本：

```powershell
node --test prj/petbank-server/test/*.test.mjs
node scripts/test-self-hosted-ops.mjs
node --check prj/petbank-server/src/config.mjs
node --check prj/petbank-server/src/database.mjs
node --check prj/petbank-server/src/server.mjs
```

启动服务前必须配置生产数据目录和足够长度的 JWT secret。健康检查通过只证明进程、数据库和迁移可用；它不证明生产 canary、Profile 自动快照同步、冲突恢复或备份恢复演练已完成。

## 7. 完成前检查

```powershell
git diff --check
git status --short
git diff --stat
```

确认：

- 没有真实 `.env`、数据库、备份、密钥或浏览器 profile 进入变更。
- 没有把 `tmp/`、`_site*`、参考资料或原始素材发布。
- 新 key/路由/bundle/测试已同步契约文档。
- 失败测试已经说明是环境前置、路径/编码还是代码断言，而不是直接跳过。
