# PetBank 自托管后端

这是宠物积分系统的轻量云端后端。它与前端发布目录分离，负责未来的家长账号、家庭、孩子档案和云端状态快照。

当前已经可运行的能力：

- SQLite 数据库与增量迁移
- 数据库文件强制放在发布目录之外
- `GET /api/v1/health` 健康检查
- Docker Compose 和 Nginx 反向代理模板

当前尚未接入前端的能力：注册、登录、家庭邀请、孩子同步和恢复。账号接口完成安全测试、迁移校验和回滚演练后，才能接入家长端，不能把未完成的接口直接上线。

## 本地验证

```bash
node --test test/*.test.mjs
set PETBANK_DATA_DIR=%CD%\\var\\data
set PETBANK_JWT_SECRET=local-development-secret-with-more-than-32-characters
node src/main.mjs
```

访问 `http://127.0.0.1:3000/api/v1/health`，应返回 `{ "ok": true }`。

## 服务器原则

- 发布代码：`/srv/pet-bank/releases/<release>/`
- 持久化数据：`/srv/pet-bank/shared/data/petbank.db`
- 密钥：`/srv/pet-bank/shared/server.env`
- 备份：`/srv/pet-bank/shared/backups/`

详细流程见 [部署手册](../../docs_project/runbooks/self-hosted/README.md)。
