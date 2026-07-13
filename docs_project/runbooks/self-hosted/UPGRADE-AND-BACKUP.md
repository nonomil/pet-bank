# 升级、回滚与备份

## 更新不会丢数据的原因

代码在 `/srv/pet-bank/releases/<release-id>`，数据在 `/srv/pet-bank/shared/data/petbank.db`。两者是不同目录。更新 release 或切换 `current` 不会移动数据库文件。

## 备份

在发布数据库迁移前，先做停机一致性备份。当前规模很小，短暂停 API 是可接受且最容易复核的方式：

```bash
cd /srv/pet-bank/current/prj/petbank-server/deploy
docker compose -p petbank-api stop api
stamp="$(date +%Y%m%d-%H%M%S)"
cp /srv/pet-bank/shared/data/petbank.db "/srv/pet-bank/shared/backups/petbank-$stamp.db"
docker compose -p petbank-api start api
curl --fail http://127.0.0.1:3000/api/v1/health
```

每日至少保留一个备份，并把备份同步到腾讯云 COS 或另一台机器。不要把唯一备份留在同一台服务器。

## 标准更新顺序

```bash
release_id="$(date +%Y%m%d-%H%M%S)"
release_dir="/srv/pet-bank/releases/$release_id"
git clone https://github.com/nonomil/pet-bank.git "$release_dir"
cd "$release_dir"
node scripts/assemble-pages-artifact.mjs site
```

发布的静态根目录只能是 `$release_dir/site`。切换 `current` 前确认独立游戏运行时已进入制品：

```bash
test -f "$release_dir/site/app/playground/typing-defense-runtime/web/index.html"
test -f "$release_dir/site/prj/学习机玩法原型/index.html"
test -f "$release_dir/site/prj/单词记忆射击场原型/index.html"
```

1. 备份数据库。
2. 在新 release 中运行后端测试：`node --test prj/petbank-server/test/*.test.mjs`。
3. 将共享配置链接到新 release：`ln -sfn /srv/pet-bank/shared/server.env "$release_dir/prj/petbank-server/.env"`。
4. 在新 release 启动 API 并访问 `/api/v1/health`。
5. 若健康检查和页面检查成功，执行 `ln -sfn "$release_dir" /srv/pet-bank/current`。
6. 切换并重载 Nginx 后，检查 `typing-defense`、`learning-arcade`、`word-memory-map` 三个宿主路径，以及各自运行时 HTML 都返回成功状态。部署脚本的本机静态检查失败会自动恢复上一 release；外部 HTTPS 检查失败时仍须人工决定回滚或继续排查。
7. 保留前一个 release，至少确认一次真实登录和同步后再清理。

## 回滚

前端或 API 出问题时，仅切回上一个已验证 release：

```bash
ln -sfn /srv/pet-bank/releases/<previous-release-id> /srv/pet-bank/current
```

不要用数据库回滚替代代码回滚。SQLite schema 迁移应保持向后兼容；破坏性改动必须单独发布、单独备份和单独演练恢复。

## 数据库恢复

仅在确认数据损坏且已停止 API 后恢复：

```bash
docker compose -p petbank-api stop api
cp /srv/pet-bank/shared/backups/petbank-<timestamp>.db /srv/pet-bank/shared/data/petbank.db
docker compose -p petbank-api start api
curl --fail http://127.0.0.1:3000/api/v1/health
```
