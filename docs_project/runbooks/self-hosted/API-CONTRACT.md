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
- 账号接口使用 `username`；用户名为 3 到 32 位字母、数字或下划线，手机号和邮箱不参与注册/登录。数据库中的旧标识列仅作为迁移兼容字段，不向客户端暴露。
- JWT 密钥只在服务器 `server.env` 中存在，不进入浏览器和 Git。
- 每个家庭查询都必须依据已登录账号校验 `household_members`。
- 任何导入、恢复、邀请和跨家庭访问都必须有端到端测试。

## 前端快照提交语义

- 浏览器在网络失败时将最新本地快照写入 `petbank_self_hosted_snapshot_outbox_v1`，同一 `profileId:childId` 只保留最新待提交记录。
- outbox 重试使用服务端现有 `revision` 契约；`409 SNAPSHOT_REVISION_CONFLICT` 必须保留本地 payload 和 `conflict` 状态，不能静默重试覆盖远端。
- outbox 是设备/家长连接状态，不属于孩子业务快照；Profile 切换和导出不得把它打包进 `petbank_profile_data_*`。
- 当前没有自动多端合并或冲突选择 API；客户端应把冲突报告为待处理，而不是同步成功。
