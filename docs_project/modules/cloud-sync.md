# SQLite 快照同步

> 当前状态：前端不加载云端 SDK、云端配置或同步模块。孩子端继续使用本机 `localStorage`；VPS 上的 Node.js + SQLite 账号服务完成后，再按本页合同接入快照同步。
>
> 唯一实施方案：[家庭账号社交体系 / SQLite 自托管版](../../docs/家庭账号社交体系/SQLite自托管版/README.md)

## 当前运行边界

- 浏览器只负责本地多孩子档案和离线玩法。
- `prj/petbank-server/` 当前提供数据库初始化和 `GET /api/v1/health`。
- 未实现注册、登录、家庭、孩子和快照 API 前，家长设置页不显示账号登录表单，也不报告“同步成功”。
- 不再保留 Supabase 客户端、配置 stub、双写逻辑或前端 service role 配置。

## 目标同步链路

```text
家长端同域 /api/v1
  -> Node.js 22 API
     -> better-sqlite3 / SQLite WAL
        -> children + state_snapshots
```

快照同步完成后，业务模块只调用业务动作，不直接依赖数据库实现：

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

账号接口、真实迁移和 Hermes VPS 发布完成前，本页的“目标同步链路”不能当作已上线能力。
