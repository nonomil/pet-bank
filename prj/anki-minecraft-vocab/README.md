# Minecraft Anki 词卡工作台

这是一个独立的 `prj/` 项目，用于浏览参考 Anki 包中的牌组目录、卡片字段和本地媒体。它不属于主站学习中心，也不会自动写入 `data/vocab/`。

## 当前数据

- 现代数据库：`collection.anki21`
- 笔记/卡片：11,241 / 11,241
- 末级牌组：231
- 媒体映射：6,847
- 官方词条：7,578 张，9 个主题
- 核心单词：3,663 张，基础认读/听音辨意/主动输出各 1,221 张

参考目录页：<https://file.ankichinas.cn/card/6a04e490ea980mB8>

## 重新提取

不要把原始 APKG 复制进本项目。使用仓库中的参考文件重新生成 JSON 和媒体：

```powershell
python scripts/extract_apkg.py `
  --input "../../docs/参考/案例/🍅【我的世界】主题词汇━薯仔的外语小站.apkg" `
  --out-dir . `
  --copy-media
```

提取器会优先使用 `collection.anki21`。`collection.anki2` 是新版 Anki 为旧客户端留下的兼容占位库，只有一条“请更新 Anki”的提示。

## 启动网页

在本目录启动静态服务：

```powershell
python -m http.server 8766 --bind 127.0.0.1
```

然后访问 <http://127.0.0.1:8766/>。由于页面通过 `fetch()` 读取 JSON，不能使用 `file://` 直接打开。

## 字段说明

当前包的部分词义、例句和单词字段以 `≯#...#≮` 形式保存。提取器保留原始字段、纯文本和媒体引用，但不会猜测或破解字段。网页会展示可恢复的目录、图片、音频和明文；加密字段会显示状态提示。

## 测试

```powershell
python -m unittest discover -s scripts -p "test_*.py" -v
```

Hermes 独立静态部署入口：[DEPLOY-HERMES.md](./DEPLOY-HERMES.md)，机器可读配置：[hermes.yaml](./hermes.yaml)。
