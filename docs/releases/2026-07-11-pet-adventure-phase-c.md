# 探索短章节 Phase C 发布记录

## 本阶段交付

- 其余 9 个场景补齐 `shortText`、`detailText`、`petMood`：糖果、瀑布、珊瑚、沙漠、雪山、洞窟、城堡、火山、太空。
- 全部 12 个场景统一使用短句优先，旧 `text` 字段和事件 ID 保留兼容。
- 故事加载增加版本查询参数和 `cache: no-store`，避免静态服务器/浏览器缓存旧文案。
- 故事加载改为单场景容错，一个文件失败不会阻塞其他场景。
- `data/stories/README.md` 增加短句、详情和宠物情绪字段规范。

## 测试

通过：

- `node scripts/test-pet-adventure-retention.mjs`
- 全量 `data/stories/*.json` 解析校验
- `node --check js/exploration-detail.js`
- `node --check js/travel-memory.js`
- `node scripts/test-pages-fast-gate-contract.mjs`

## 真实浏览器验收

服务器：`python -m http.server 9077 --bind 127.0.0.1`

- 糖果王国桌面 `1280x720`：显示“甜雾里有发光便签！”、详情默认折叠、`mood-surprised`、无横向溢出。
- 糖果王国移动 `390x844`：短句、情绪和折叠详情正常，无横向溢出。
- 控制台：`0 errors`。

截图：

- `docs/releases/pet-adventure-phase-c-desktop.png`
- `docs/releases/pet-adventure-phase-c-mobile.png`

## 仍未完成

- 三节点 `see → choose → return` 和刷新断点存档尚未落地；当前仍保留原有五事件序列，只增加表现层兼容字段。
- 纪念徽章、旅行卡、冰箱贴和宠物卡牌仍待按 `docs/plans/2026-07-11-travel-memory-asset-plan.md` 生成并验收。
- 新短句尚未补本地语音映射，VoiceSystem 可能记录缺失音频 warning，但无运行时 error。
