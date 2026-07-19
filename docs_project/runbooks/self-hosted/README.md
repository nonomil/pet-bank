# PetBank 自托管后端与腾讯云部署

> 对应项目版本：`v0.7.60`

> 目标：在一台腾讯云 2C4G Linux 服务器上部署网站和轻量后端。网站升级不会覆盖账号、家庭和孩子资料。

## 给 AI / Hermes 的最短指令

部署或更新前，先完整阅读：

1. 本文档
2. [AI-HERMES-DEPLOY.md](./AI-HERMES-DEPLOY.md)
3. [UPGRADE-AND-BACKUP.md](./UPGRADE-AND-BACKUP.md)
4. [API-CONTRACT.md](./API-CONTRACT.md)

Anki Minecraft 词卡是独立静态站，部署前另读 [ANKI-MINECRAFT-VOCAB-HERMES.md](./ANKI-MINECRAFT-VOCAB-HERMES.md)；它不进入主站 Pages 制品，也不使用本手册中的 SQLite API。

主站 Minecraft 单词远征的 Pages 制品、深层路由和浏览器验收见 [MINECRAFT-VOCAB-LEARNING-HERMES.md](./MINECRAFT-VOCAB-LEARNING-HERMES.md)。

像素世界故事的静态验收、生图供应商阻断处理和回滚步骤见 [PIXEL-WORLDS-HERMES.md](./PIXEL-WORLDS-HERMES.md)。

不得删除 `/srv/pet-bank/shared/`。不得把数据库放进 Git 工作区或 release 目录。数据库变更只能通过新的 `db/migrations/NNN_*.sql` 文件追加。

## 架构

```text
Internet
  -> Nginx (HTTPS, static site, /api reverse proxy)
     -> Node.js API, 127.0.0.1:3000
        -> SQLite, /srv/pet-bank/shared/data/petbank.db
```

后端源代码在 `prj/petbank-server/`。当前已提供注册码注册/授权、登录、refresh 轮换、家庭成员、家庭邀请码、孩子档案和 revision 快照 API；浏览器会话通过 HttpOnly Cookie 供 Nginx `auth_request` 检查，好友、串门、PK 和动态流仍未实现。

生产静态访问采用分级门禁：`/parent/`、`/settings` 家庭登录/注册码入口、绘本和游乐场公开；根首页、`/app/` 核心孩子端、`/settings/learning|rules|advanced`、`/parent/works` 和 `/parent/tools` 需要有效授权。配置片段见 `prj/petbank-server/deploy/nginx-api.conf` 与 `nginx-static-gate.conf`，必须包含到同一个 HTTPS `server {}`，不能只部署 API 代理。

本地查看完整内容不需要注册，也不要修改生产环境变量。执行：

```powershell
node scripts/test-mode-server.mjs
```

然后打开 `http://127.0.0.1:7001/app`。该模式只在回环地址注入本地测试标记，绕过浏览器页面访问检查；它不启动 API、不创建账号、不提供家长云端管理能力，也不会绕过 VPS/Nginx 的生产门禁。

注册码不是家庭邀请码。需要新增一个授权时，在 VPS 上执行：

```bash
/srv/pet-bank/current/ops/issue-registration-code.sh --label "家庭 A" --access-days 365
```

把命令输出中的 `code` 通过安全渠道交给用户。查看授权发行记录只显示末四位：

```bash
/srv/pet-bank/current/ops/list-registration-codes.sh
```

查看账号授权状态（只显示用户名、状态和注册码末四位，不显示完整注册码）：

```bash
docker compose -f /srv/pet-bank/current/prj/petbank-server/deploy/compose.yml -p petbank-api exec -T api node src/authorization-cli.mjs list-accounts
```

撤销注册码及其已发授权：

```bash
/srv/pet-bank/current/ops/revoke-registration-code.sh CODE
```

注册码只用于新账号注册资格。账号登录失败时先看 `list-accounts`：`authorizationStatus` 为 `expired` 或 `revoked` 表示账号授权失效，`accessStatus` 为 `suspended` 表示账号被停用；`list-registration-codes.sh` 不能恢复完整注册码。

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

后续每次部署都必须使用新的 `releases/<release-id>`，先运行 `node scripts/assemble-pages-artifact.mjs site` 生成静态产物，再更新 `current` 软链接。Nginx 根目录必须是 `/srv/pet-bank/current/site`，不能直接指向仓库根目录。详见 [升级与备份](./UPGRADE-AND-BACKUP.md)。

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
{"ok":true,"service":"petbank-server","migrationCount":4}
```

这证明容器、持久化数据卷和增量迁移可用。注册/登录、家庭、孩子和快照接口的端到端测试见 `prj/petbank-server/test/api.test.mjs`，完整接口规则见 [API 契约](./API-CONTRACT.md)。
