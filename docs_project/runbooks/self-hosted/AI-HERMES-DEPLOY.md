# AI / Hermes 部署执行手册

> 此文档给执行部署的 AI 或 Hermes 使用。目标是安全部署，不丢失现有用户数据。

> 当前发布：`v0.7.42`。本版本仍是“孩子端本地优先 + SQLite 账号/家庭/孩子/快照层”；不要改成每次玩法操作都请求 API。

> 本次像素故事发布的专用验收见 [PIXEL-WORLDS-HERMES.md](./PIXEL-WORLDS-HERMES.md)。

## 不可违反的规则

1. 不删除 `/srv/pet-bank/shared`。
2. 不使用 `git clean -fdx`、`rm -rf /srv/pet-bank` 或全目录覆盖发布。
3. 不将 `server.env`、数据库、备份、JWT 密钥加入 Git。
4. 先验证新 release，再切换 `current`。
5. 数据库只允许向 `prj/petbank-server/db/migrations/` 增加新文件；禁止改写已发布迁移。

## 首次部署

```bash
release_id="$(date +%Y%m%d-%H%M%S)"
release_dir="/srv/pet-bank/releases/$release_id"
git clone https://github.com/nonomil/pet-bank.git "$release_dir"
mkdir -p /srv/pet-bank/shared/{data,backups}
cp "$release_dir/prj/petbank-server/.env.example" /srv/pet-bank/shared/server.env
chmod 600 /srv/pet-bank/shared/server.env
cd "$release_dir"
node scripts/assemble-pages-artifact.mjs site
```

编辑 `server.env`，设置真实 `PETBANK_JWT_SECRET`。不要把真实配置写回仓库。

启动 API：

```bash
cd "$release_dir/prj/petbank-server/deploy"
ln -sfn /srv/pet-bank/shared/server.env ../.env
docker compose -p petbank-api stop api || true
if [[ -f /srv/pet-bank/shared/data/petbank.db ]]; then
  PETBANK_DATA_DIR=/srv/pet-bank/shared/data PETBANK_BACKUP_DIR=/srv/pet-bank/shared/backups "$release_dir/ops/backup-sqlite.sh"
fi
docker compose -p petbank-api up -d --build
curl --fail http://127.0.0.1:3000/api/v1/health
```

确认健康检查成功后才执行：

```bash
ln -sfn "$release_dir" /srv/pet-bank/current
```

Nginx 静态站点根目录必须使用 `/srv/pet-bank/current/site`，绝不能指向仓库根目录或 `/srv/pet-bank/current`。仓库根目录会绕过发布白名单，导致打字防线等独立游戏运行时没有被装配。将 `prj/petbank-server/deploy/nginx-api.conf` 的 `location /api/` 加入该站点配置并执行：

```bash
nginx -t && systemctl reload nginx
curl --fail http://127.0.0.1/app/
curl --fail http://127.0.0.1/parent/
curl --fail http://127.0.0.1/app/playground/typing-defense-runtime/web/index.html
curl --fail http://127.0.0.1/prj/学习机玩法原型/index.html
curl --fail http://127.0.0.1/prj/单词记忆射击场原型/index.html
```

任一检查失败都不要保留新 `current`；先切回上一 release，再处理新 release。

## 每次更新

严格按 [UPGRADE-AND-BACKUP.md](./UPGRADE-AND-BACKUP.md) 执行。任何步骤失败都不要切换 `current`。

## v0.7.40 发布验收

在切换 `current` 前，必须在新 release 中执行：

```bash
node --test prj/petbank-server/test/*.test.mjs
node scripts/test-self-hosted-ops.mjs
node scripts/assemble-pages-artifact.mjs site
```

API 健康检查应返回 `ok: true`、`service: petbank-server` 和 `migrationCount: 3`。切换后还要从外部域名检查：

```bash
curl --fail https://<domain>/api/v1/health
curl --fail https://<domain>/
curl --fail https://<domain>/parent/
curl --fail https://<domain>/app/playground/typing-defense/
curl --fail https://<domain>/app/playground/typing-defense-runtime/web/index.html
curl --fail https://<domain>/app/playground/learning-arcade/
curl --fail https://<domain>/prj/学习机玩法原型/index.html
curl --fail https://<domain>/app/playground/word-memory-map/
curl --fail https://<domain>/prj/单词记忆射击场原型/index.html
```

使用专用测试账号和已有测试孩子做非破坏性 canary：登录、读取家庭/孩子、读取最新快照；再从家长端确认账号入口不显示手机号/邮箱注册，孩子只能挂靠在家庭下。不要在生产家庭中创建临时孩子或临时家庭，除非已有明确清理方案。

账号登录和页面检查通过后，使用测试孩子在本地修改一次积分或宠物状态，确认家长端出现“已同步”或网络异常时出现“待同步”，然后检查 API 返回的快照 revision 递增。若出现 revision 冲突，必须保留旧 release 和冲突记录，不得强制覆盖远端。
