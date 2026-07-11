# PetBank 自托管后端与腾讯云部署

> 对应项目版本：`v0.7.34`

> 目标：在一台腾讯云 2C4G Linux 服务器上部署网站和轻量后端。网站升级不会覆盖账号、家庭和孩子资料。

## 给 AI / Hermes 的最短指令

部署或更新前，先完整阅读：

1. 本文档
2. [AI-HERMES-DEPLOY.md](AI-HERMES-DEPLOY.md)
3. [UPGRADE-AND-BACKUP.md](UPGRADE-AND-BACKUP.md)
4. [API-CONTRACT.md](API-CONTRACT.md)

不得删除 `/srv/pet-bank/shared/`。不得把数据库放进 Git 工作区或 release 目录。数据库变更只能通过新的 `db/migrations/NNN_*.sql` 文件追加。

## 架构

```text
Internet
  -> Nginx (HTTPS, static site, /api reverse proxy)
     -> Node.js API, 127.0.0.1:3000
        -> SQLite, /srv/pet-bank/shared/data/petbank.db
```

后端源代码在 `prj/petbank-server/`。它目前只有数据库初始化和健康检查，目的是先固定发布、数据和备份边界；前端尚未切换到它。

## 必备软件

- Ubuntu 22.04/24.04 或 Debian 12
- Node.js 22 LTS（用于构建静态站点）
- Docker Engine 与 Docker Compose plugin
- Nginx
- 已配置 DNS 的域名和 HTTPS 证书

2C4G 足够。正常运行时只有 Nginx、一个 Node API 容器和 SQLite 文件，不需要 PostgreSQL、Redis 或 Supabase。

## 固定服务器目录

```text
/srv/pet-bank/
  releases/                 # 每次 Git/Hermes 拉取的独立版本
  shared/
    data/petbank.db         # 唯一业务数据库，永不随发版删除
    backups/                # 数据库备份
    server.env              # JWT 密钥等真实配置，永不提交 Git
  current -> releases/...   # 当前启用的网站版本，Nginx 使用 current/site
```

首次准备：

```bash
sudo mkdir -p /srv/pet-bank/{releases,shared/data,shared/backups}
sudo chown -R "$USER":"$USER" /srv/pet-bank
```

后续每次部署都必须使用新的 `releases/<release-id>`，先运行 `node scripts/assemble-pages-artifact.mjs site` 生成静态产物，再更新 `current` 软链接。Nginx 根目录必须是 `/srv/pet-bank/current/site`，不能直接指向仓库根目录。详见 [升级与备份](UPGRADE-AND-BACKUP.md)。

## 环境文件

创建 `/srv/pet-bank/shared/server.env`，权限设为仅部署用户可读：

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
PETBANK_DATA_DIR=/data
PETBANK_JWT_SECRET=replace-with-openssl-rand-hex-32-output
```

生成密钥：

```bash
openssl rand -hex 32
chmod 600 /srv/pet-bank/shared/server.env
```

## 当前验收

启动 API 后执行：

```bash
curl --fail http://127.0.0.1:3000/api/v1/health
```

预期包含：

```json
{"ok":true,"service":"petbank-server","migrationCount":1}
```

这证明容器、持久化数据卷和增量迁移可用，但不代表注册/登录已迁移完成。账号接口上线前必须遵循 [API 契约](API-CONTRACT.md) 并完成端到端测试。
