# SQLite 快照同步

> 当前状态：前端不加载 Supabase SDK；家长设置页已加载自托管 API facade，可完成账号、家庭、邀请码和孩子映射。孩子端继续使用本机 `localStorage`，Profile 已在启动恢复、切换/隐藏页上传时调用快照 API；网络失败会进入本地 outbox 并按退避策略重试。
>
> 唯一实施方案：[家庭账号社交体系 / SQLite 自托管版](../../docs/方案/专题/家庭社交/SQLite自托管版/README.md)

## 当前运行边界

- 浏览器只负责本地多孩子档案和离线玩法。
- `prj/petbank-server/` 当前提供数据库初始化、认证、家庭/成员/邀请码、孩子和 revision 快照 API。
- `js/parent-account.js` 已显示账号管理表单并调用账号/家庭/孩子接口；Profile 生命周期负责孩子状态快照上传和恢复，单个 API 操作成功仍不代表所有本地状态都已同步。
- `app.js:saveAppState()` 和 `PetSystem.save()` 在本地写入成功后会通过 `ProfileManager.requestHighPrioritySync()` 防抖触发高优先级快照上传，当前覆盖积分和宠物状态；不会把玩法点击改成阻塞式 API 请求。
- 不再保留 Supabase 客户端、配置 stub、双写逻辑或前端 service role 配置。

## 目标同步链路

```text
家长端同域 /api/v1
  -> Node.js 22 API
     -> better-sqlite3 / SQLite WAL
        -> children + state_snapshots
```

当前已提供的 API facade（最后两项由 Profile 生命周期调用）：

- `register(username, password, displayName)` / `login(username, password)`
- `logout()` / `refresh()`
- `listChildren()` / `createChild()`
- `pushSnapshot(childId, revision, payload)`
- `latestSnapshot(childId)`

## 离线失败与冲突边界

- outbox 使用 `petbank_self_hosted_snapshot_outbox_v1`，按 `profileId:childId` 合并同一孩子的最新本地快照，最多保留 20 条记录。
- 网络失败会保留 `pending` 记录并按退避时间重试；`online`、`visibilitychange` 和 `pagehide` 会触发 flush。
- 积分或宠物保存后的自动上传使用短防抖窗口合并连续变化；本地写入始终先完成，离线时仍可继续使用孩子端。
- 服务端返回 revision 冲突时，Profile 会读取远端最新快照；只有当积分、宠物、奖励等所有非词卡业务键逐字一致时，才自动合并 `petbank_learning_vocab_progress_{profileId}` 和 `petbank_learning_vocab_review_events_{profileId}`，并用远端 revision + 1 重试上传。
- 词卡进度按卡片 `updatedAt/lastReviewedAt` 选择较新状态，review events 按 `reviewId` 去重；合并后的快照也会写回当前 Profile。合并失败或检测到非词卡差异时，仍保留 `conflict`，由家长选择本地、云端或导出备份，不能把冲突报告为“已同步”。

## 冲突和安全约束

- access token 短时有效，refresh token 使用随机不透明值并轮换；数据库只保存 refresh token 哈希。
- 密码只保存强哈希，不接受浏览器提交的明文快照或管理员密钥。
- 快照使用递增 `revision`；版本落后时返回 `409`，不静默覆盖较新的数据。
- `local_profile_id` 只做本机档案映射，不能当作跨家庭身份。
- 所有账号、家庭、孩子接口必须在服务端校验成员权限。

## 验证入口

```bash
node --test prj/petbank-server/test/*.test.mjs
node --check prj/petbank-server/src/server.mjs
curl --fail http://127.0.0.1:3000/api/v1/health
node scripts/test-cloud-sync-profile-integration.mjs
node scripts/test-cloud-sync-outbox.mjs
node scripts/test-high-priority-sync.mjs
```

账号/家庭/孩子接口和 Profile 启动恢复、切换前 push、切换后 pull 已有本地 API/浏览器测试；outbox 存储和 Profile 网络失败/重试/冲突持久化已有专项测试；词卡冲突自动合并也有集成测试。通用业务状态仍没有自动合并策略，生产 canary 仍需 Hermes 在目标 VPS 执行。
