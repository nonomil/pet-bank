# Anki Minecraft 词卡独立部署手册

> 给 Hermes 或其他 AI 执行器使用。此项目是独立静态站，不属于主站 Pages 制品，也不使用 `prj/petbank-server/` 的 SQLite 数据库。

## 目标与边界

- 源码目录：`prj/anki-minecraft-vocab/`
- 本地预览：`http://127.0.0.1:8766/`
- 静态入口：`index.html`
- 运行数据：`data/manifest.json`、`data/decks.json`、`data/cards.json`
- 本地媒体：`assets/media/`
- 当前数据规模：11,241 张卡片、231 个末级牌组、6,847 个媒体映射；提取后的项目约 140.5 MB
- 生产持久目录：无。每个 release 都是可替换的静态文件，`current` 只指向已验证 release

不得执行以下操作：

1. 不把整个 `prj/`、该项目或媒体目录复制进主站 `/srv/pet-bank/current/site`。
2. 不运行 `scripts/assemble-pages-artifact.mjs` 来发布此项目；主站 Pages 白名单刻意不包含它。
3. 不把原始 `.apkg`、浏览器 profile、真实配置、数据库或备份加入 Git。
4. 不删除 `/srv/pet-bank/shared`、已有 release 或用户数据；失败时只切换 `current`。
5. 不猜测或破解网页标记为 Anki 加密的 `≯#...#≮` 字段。

## Hermes 执行流程

### 1. 发布前检查

在仓库根目录执行：

```bash
set -Eeuo pipefail
test -f prj/anki-minecraft-vocab/index.html
test -s prj/anki-minecraft-vocab/data/manifest.json
test -s prj/anki-minecraft-vocab/data/decks.json
test -s prj/anki-minecraft-vocab/data/cards.json
python3 -m unittest discover \
  -s prj/anki-minecraft-vocab/scripts \
  -p 'test_*.py' -v
python3 -m py_compile \
  prj/anki-minecraft-vocab/scripts/extract_apkg.py \
  prj/anki-minecraft-vocab/scripts/test_extract_apkg.py \
  prj/anki-minecraft-vocab/scripts/test_web_contract.py
python3 -m http.server 8766 --bind 127.0.0.1 \
  --directory prj/anki-minecraft-vocab >/tmp/anki-minecraft-vocab-http.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
curl --fail http://127.0.0.1:8766/
curl --fail http://127.0.0.1:8766/data/manifest.json
curl --fail http://127.0.0.1:8766/data/decks.json
curl --fail http://127.0.0.1:8766/data/cards.json >/dev/null
kill "$server_pid" 2>/dev/null || true
trap - EXIT
```

浏览器验收必须确认：首次进入选中根目录并显示 `11,241 / 11,241`；官方词条为 `7,578`；核心单词为 `3,663`；折叠展开后能选到末级目录；搜索、翻卡、图片/音频和移动端目录抽屉可用；新页面会话无控制台错误。

### 2. 创建独立 release

以下路径与主站 release 分开：

```bash
release_id="$(date +%Y%m%d-%H%M%S)"
release_root=/srv/pet-bank/anki-minecraft-vocab/releases
release_dir="$release_root/$release_id"
current_link=/srv/pet-bank/anki-minecraft-vocab/current
mkdir -p "$release_root"
git clone --depth 1 --branch main \
  https://github.com/nonomil/pet-bank.git "$release_dir"
test -f "$release_dir/prj/anki-minecraft-vocab/index.html"
test -s "$release_dir/prj/anki-minecraft-vocab/data/manifest.json"
test -s "$release_dir/prj/anki-minecraft-vocab/data/cards.json"
```

将 Nginx 的独立站点根目录配置为：

```text
/srv/pet-bank/anki-minecraft-vocab/current
```

若使用路径前缀，保持末尾斜杠并使用 alias：

```nginx
location = /anki-minecraft-vocab {
    return 301 /anki-minecraft-vocab/;
}
location /anki-minecraft-vocab/ {
    alias /srv/pet-bank/anki-minecraft-vocab/current/;
    index index.html;
}
```

### 3. 验证后切换 current

不要在验证前改链接：

```bash
python3 -m http.server 8766 --bind 127.0.0.1 \
  --directory "$release_dir/prj/anki-minecraft-vocab" >/tmp/anki-minecraft-vocab-release.log 2>&1 &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
curl --fail http://127.0.0.1:8766/
curl --fail http://127.0.0.1:8766/data/manifest.json
curl --fail http://127.0.0.1:8766/data/decks.json
curl --fail http://127.0.0.1:8766/data/cards.json >/dev/null
kill "$server_pid" 2>/dev/null || true
trap - EXIT

ln -sfn "$release_dir/prj/anki-minecraft-vocab" "$current_link"
nginx -t
systemctl reload nginx
curl --fail https://<domain>/anki-minecraft-vocab/
curl --fail https://<domain>/anki-minecraft-vocab/data/manifest.json
```

如果任一检查失败，不得切换 `current`；如果已经切换，则立即按下一节回滚并保留失败日志。

## 重新提取 APKG

原始 APKG 不在仓库中。只有在用户明确提供输入文件并确认目标输出目录后，才执行：

```powershell
python prj/anki-minecraft-vocab/scripts/extract_apkg.py `
  --input "docs/参考/案例/🍅【我的世界】主题词汇━薯仔的外语小站.apkg" `
  --out-dir prj/anki-minecraft-vocab `
  --copy-media
```

提取器优先使用 `collection.anki21`；输入文件只读，输出前应确认有足够磁盘空间。重新生成后必须重新跑本项目测试和浏览器验收，不得只替换 `cards.json`。

## 回滚

先找出上一个已验证 release，再只切换静态链接：

```bash
ln -sfn /srv/pet-bank/anki-minecraft-vocab/releases/<previous-release-id>/prj/anki-minecraft-vocab \
  /srv/pet-bank/anki-minecraft-vocab/current
nginx -t && systemctl reload nginx
curl --fail https://<domain>/anki-minecraft-vocab/data/manifest.json
```

不要回滚或恢复主站 SQLite；此项目没有自己的数据库。保留失败 release 和日志，等待人工复核后再清理。
