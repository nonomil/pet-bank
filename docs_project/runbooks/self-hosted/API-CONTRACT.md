# 自托管 API 契约与演进规则

## 当前已实现

| 方法 | 路径 | 用途 |
|---|---|---|
| `GET` | `/api/v1/health` | 进程、数据库与迁移健康检查 |
| `POST` | `/api/v1/auth/register` | 注册家长账号并签发 access/refresh token |
| `POST` | `/api/v1/auth/login` | 家长登录 |
| `POST` | `/api/v1/auth/refresh` | refresh token 轮换 |
| `POST` | `/api/v1/auth/logout` | 撤销 refresh token |
| `GET` | `/api/v1/auth/me` | 返回当前家长公开资料 |
| `DELETE` | `/api/v1/auth/account` | 使用当前密码删除账号；名下仍有家庭时返回 `409` |
| `GET/POST` | `/api/v1/households` | 查询或创建当前账号所属家庭 |
| `GET` | `/api/v1/households/:id/members` | 查询家庭成员（仅成员可访问） |
| `DELETE` | `/api/v1/households/:id/members/:accountId` | owner 移除家长成员；owner 不可被移除 |
| `POST` | `/api/v1/households/:id/invites` | 家庭 owner 创建家长邀请码 |
| `POST` | `/api/v1/household-invites/redeem` | 已登录家长兑换邀请码 |
| `GET/POST` | `/api/v1/children` | 查询或创建家庭孩子档案 |
| `GET/PATCH` | `/api/v1/children/:id` | 查询或改名孩子档案 |
| `DELETE` | `/api/v1/children/:id` | 家庭 owner 删除孩子档案及其快照 |
| `GET` | `/api/v1/children/:id/snapshots/latest` | 查询最新孩子快照 |
| `POST` | `/api/v1/children/:id/snapshots` | 追加孩子快照，版本冲突返回 `409` |

## 尚未实现的后续接口

后续只能在 `/api/v1/` 下增加接口，不能复用或改变已有响应字段含义：

| 分组 | 预留路径 |
|---|---|
| 社交 | 好友码、好友关系、串门和动态流 |
| PK | 数学/汉字异步 PK 的服务端题组冻结与结算 |

## 数据不变的规则

- 账号主键、家庭主键、孩子主键使用不可变 UUID 字符串。
- `local_profile_id` 仅用于将当前浏览器的孩子档案映射到云端，不得作为跨家庭全局身份。
- 快照使用递增 `revision`，不能覆盖历史版本。
- 新字段只允许增加；删除、改名或改变字段含义必须先兼容一个版本周期。
- 前端切换到自托管 API 前，必须提供一次性导入流程和“导入后恢复验证”。

## 安全底线

- 密码只能存 `password_hash`，不得存明文。
- `identifier` 支持手机号或邮箱；邮箱兼容字段仅用于历史数据，不向客户端暴露内部占位域。
- JWT 密钥只在服务器 `server.env` 中存在，不进入浏览器和 Git。
- 每个家庭查询都必须依据已登录账号校验 `household_members`。
- 任何导入、恢复、邀请和跨家庭访问都必须有端到端测试。
