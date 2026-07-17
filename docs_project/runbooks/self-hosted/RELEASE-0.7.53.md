# v0.7.53 发布记录

> 发布日期：2026-07-16
>
> 范围：Minecraft 单词卡双语旁白、逐卡媒体与内容审计、翻面学习 UI 和 Pages 资源门禁；无数据库迁移。

## 交付内容

- Minecraft 学习池 2,168 张卡全部保留图片、单词、中文释义、短语、短语中文、场景句和场景句中文。
- 每张卡接入六类音频：单词、英文短语、英文场景句、中文释义、中文短语、中文场景句。已有 Anki/Edge-TTS 单词音频复用，新增五类旁白使用 Edge-TTS 静态 MP3。
- 旁白清单 `data/vocab/english-minecraft/narration-manifest.json` 为 `complete`，覆盖 2,168 张卡、13,008 个引用；新旁白目录约 189 MB。
- 学习卡正面支持单词发音，点击卡片翻面后，短语、英文场景句和三个中文区块各有独立播放按钮；缺少静态文件时保留浏览器语音回退。
- 增加逐卡完整性门禁，检查每张卡的 512×512 PNG、内容字段、音频文件、清单映射和本地路径；浏览器门禁覆盖桌面/移动端、真实翻面、下一步任务和积分结算。
- Pages 组装器补放行既有运行时资源 `assets/ui/playground-bg.webp`，修复学习机发布制品的背景 404。

## 验证结果

```text
node scripts/test-minecraft-vocab-card-completeness.mjs: PASS (2168 cards)
node scripts/test-minecraft-vocab-narration.mjs: PASS (2168 cards, 13008 clips)
node scripts/test-minecraft-vocab-audio.mjs: PASS (2168/2168)
node scripts/test-minecraft-vocab-content.mjs: PASS
node scripts/test-minecraft-vocab-media.mjs: PASS
node scripts/test-minecraft-vocab-browser.mjs: PASS
node scripts/test-static-route-entries.mjs: PASS (41 routes)
node scripts/test-pages-fast-gate-contract.mjs: PASS
node scripts/assemble-pages-artifact.mjs _site_verify: PASS
node prj/学习机玩法原型/scripts/test-word-shooter-published-artifact.mjs: PASS
```

## 已知回归阻断

项目全量入口 `node scripts/run-full-regression.mjs` 已通过其前置项目测试和 Minecraft 相关测试，但当前工作树在 `pixel worlds story audio contract` 处停止：`data/story-packs/05-pixel-worlds-story/audio-manifest.json` 仍为 `partial`。这属于另一项故事音频任务，不能归因于本版本的 Minecraft 词卡改动；发布前若要求全量回归全绿，需要先完成该故事包音频。

## Hermes 部署

1. 先执行 `node scripts/test-minecraft-vocab-card-completeness.mjs` 和 `node scripts/test-minecraft-vocab-narration.mjs`。
2. 执行 `node scripts/assemble-pages-artifact.mjs _site_verify`，确认制品包含 `assets/learn/english-vocab/minecraft-narration/` 和双语清单。
3. 生产发布只切换已验收的 Pages 制品；不要把 `tmp/`、原始素材、模型缓存或 API key 带入 release。
4. 无需数据库迁移；学习进度仍使用现有 Profile 本地快照，奖励仍走 `PetBankPoints` 和现有 receipt 服务。
