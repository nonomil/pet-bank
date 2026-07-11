# 自托管 API 契约与演进规则

## 当前已实现

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/v1/health` | 进程、数据库与迁移健康检查 |

## 预留接口

后续只能在 `/api/v1/` 下增加接口，不能复用或改变已有响应字段含义：

| 分组 | 预留路径 |
|---|---|
| 认证 | `/api/v1/auth/register`、`/api/v1/auth/login`、`/api/v1/auth/refresh`、`/api/v1/auth/logout` |
| 家庭 | `/api/v1/households`、`/api/v1/households/:id/members` |
| 孩子 | `/api/v1/children`、`/api/v1/children/:id` |
| 同步 | `/api/v1/children/:id/snapshots` |

## 数据不变的规则

- 账号主键、家庭主键、孩子主键使用不可变 UUID 字符串。
- `local_profile_id` 仅用于将当前浏览器的孩子档案映射到云端，不得作为跨家庭全局身份。
- 快照使用递增 `revision`，不能覆盖历史版本。
- 新字段只允许增加；删除、改名或改变字段含义必须先兼容一个版本周期。
- 前端切换到自托管 API 前，必须提供一次性导入流程和“导入后恢复验证”。

## 安全底线

- 密码只能存 `password_hash`，不得存明文。
- JWT 密钥只在服务器 `server.env` 中存在，不进入浏览器和 Git。
- 每个家庭查询都必须依据已登录账号校验 `household_members`。
- 任何导入、恢复、邀请和跨家庭访问都必须有端到端测试。
