# SQLite 快照同步

> 当前状态：前端不加载 Supabase SDK；家长设置页已加载自托管 API facade，可完成账号、家庭、邀请码和孩子映射。孩子端继续使用本机 `localStorage`，Profile 已在启动恢复、切换/隐藏页上传时调用快照 API。
>
> 唯一实施方案：[家庭账号社交体系 / SQLite 自托管版](../../docs/方案/专题/家庭社交/SQLite自托管版/README.md)

## 当前运行边界

- 浏览器只负责本地多孩子档案和离线玩法。
- `prj/petbank-server/` 当前提供数据库初始化、认证、家庭/成员/邀请码、孩子和 revision 快照 API。
- `js/parent-account.js` 已显示账号管理表单并调用账号/家庭/孩子接口；Profile 生命周期负责孩子状态快照上传和恢复，单个 API 操作成功仍不代表所有本地状态都已同步。
- 不再保留 Supabase 客户端、配置 stub、双写逻辑或前端 service role 配置。

## 目标同步链路

```text
家长端同域 /api/v1
  -> Node.js 22 API
     -> better-sqlite3 / SQLite WAL
        -> children + state_snapshots
```

当前已提供的 API facade（最后两项由 Profile 生命周期调用）：

- `signIn(identifier, password)`
- `signOut()` / `refreshSession()`
- `listChildren()` / `createChild()`
- `pushSnapshot(childId, revision, payload)`
- `restoreLatestSnapshot(childId)`

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
```

账号/家庭/孩子接口和 Profile 启动恢复、切换前 push、切换后 pull 已有本地 API/浏览器测试；当前仍没有离线失败重试 outbox，也没有多端自动合并策略。
