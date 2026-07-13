# v0.7.40 自托管发布记录

> 发布日期：2026-07-13
>
> 状态：本地代码与测试已验证；VPS 外部 canary、重启和异机恢复待 Hermes 执行。

## 本次发布内容

- SQLite 账号、家庭、孩子和 revision 快照继续作为自托管后端。
- 孩子端继续使用 `localStorage` 本地优先，保持离线可玩。
- `petbank_points` 和 `petbank_pet` 本地写入后，分别通过 `requestHighPrioritySync('points')`、`requestHighPrioritySync('pet')` 触发 900ms 防抖快照上传。
- 家长端显示已连接、待同步、冲突和最近同步状态。
- 网络失败进入 `petbank_self_hosted_snapshot_outbox_v1`；revision 冲突不会自动覆盖云端，也没有多端自动合并。

## 本地证据

```text
node scripts/test-high-priority-sync.mjs              PASS
node scripts/test-cloud-sync-profile-integration.mjs   PASS
node scripts/test-parent-account-browser.mjs            PASS
node --test prj/petbank-server/test/*.test.mjs         9/9 PASS
node scripts/run-full-regression.mjs                   63/63 PASS
node scripts/test-static-route-entries.mjs             39 routes PASS
node scripts/test-pages-fast-gate-contract.mjs         PASS
node scripts/assemble-pages-artifact.mjs _site_verify  PASS
```

## Hermes 验收边界

Hermes 需要在 VPS 上补做真实部署验证：

1. 新 release 先备份 `/srv/pet-bank/shared/data/petbank.db`，再运行后端测试和静态制品组装。
2. API 健康检查确认 `migrationCount: 3`，确认数据库仍来自 `/srv/pet-bank/shared/data/`。
3. 通过外部域名验证首页、`/parent/`、`/settings/learning` 和 `/api/v1/health`。
4. 用专用测试账号/孩子验证登录、家庭/孩子读取、最新快照读取，以及积分/宠物修改后的 revision 递增。
5. 验证 API/Node 重启后账号和孩子仍存在；确认旧 release 可切回，且不删除 `shared/`。

生产环境未完成上述 canary 前，不把“线上前端已更新”或“云端状态已同步”写成已完成。
