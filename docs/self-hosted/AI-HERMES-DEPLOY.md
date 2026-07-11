# AI / Hermes 部署执行手册

> 此文档给执行部署的 AI 或 Hermes 使用。目标是安全部署，不丢失现有用户数据。

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
docker compose up -d --build
curl --fail http://127.0.0.1:3000/api/v1/health
```

确认健康检查成功后才执行：

```bash
ln -sfn "$release_dir" /srv/pet-bank/current
```

Nginx 静态站点根目录使用 `/srv/pet-bank/current/site`；将 `prj/petbank-server/deploy/nginx-api.conf` 的 `location /api/` 加入该站点配置并执行 `nginx -t && systemctl reload nginx`。

## 每次更新

严格按 [UPGRADE-AND-BACKUP.md](UPGRADE-AND-BACKUP.md) 执行。任何步骤失败都不要切换 `current`。
