# Minecraft 词库运行时分片

## 结论

Minecraft 词库继续保留在主站，但不再把 2,168 张卡的源 JSON 作为页面首次进入资源。当前采用同一页面、分片数据、按需请求的方案，先解决网页加载问题，再根据真实使用量决定是否拆成独立项目。

## 分片布局

| 选择 | 首次请求 | 作用 |
|---|---|---|
| 幼儿园/幼小衔接/小学低年级 | `minecraft-vocab-runtime-starter.json` | 低龄词卡和全部远征节点必需卡 |
| Minecraft 初级 | starter + 当前 band | 只加载当前六层之一 |
| 完整词库 | starter + 六个 band | 只有用户主动选择 `all` 才加载 |

源码仍是 `data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json`。运行时分片由 `scripts/build_minecraft_vocab_runtime_shards.cjs` 从源码生成，不能手工编辑分片后作为事实来源。

词卡内容或句子发生批量变化后，先更新源词库，再重建分片；句子音频使用定向刷新，避免把单词/短语音频重复生成：

```powershell
node scripts/build_minecraft_vocab_runtime_shards.cjs
python scripts/generate_minecraft_vocab_narration.py --apply --refresh-sentence
```

长批次中断时可用 `--start N --limit M` 补跑。生成期间 manifest 会标记为 `in-progress`，只有文件完整且 manifest 文本与当前词卡逐字段一致时才会恢复为 `complete`；验收仍需检查 `failures: []` 和逐文件完整性，不能只看旧状态。

## 当前实测

- 源全量 JSON：约 `7.2 MiB`。
- starter：`140` 张，约 `0.44 MiB`。
- 六个 band：`123/312/610/131/269/594` 张，约 `0.40/1.04/2.07/0.44/0.92/2.09 MiB`。
- Pages 制品：约 `417.6 MiB / 6,385 文件`；全量源 JSON 不在制品，主站只发布 `700` 条 starter OGG，完整旁白源池仍保留在仓库。

制品大小不是首屏下载量。首屏还会按页面实际使用请求图片和单卡音频；不能用完整制品大小代替真实网络 waterfall。

## 实施边界

1. `js/minecraft-vocab-loader.js` 统一按选择加载 JSON，并缓存成功 Promise；失败会清除缓存，允许重试。
2. `js/minecraft-vocab-page.js` 初次进入使用 starter；切换 band 使用异步加载并显示切换状态；卡片按 id 去重，远征卡保证 starter 可用。
3. `js/learn-center.js` 的资料包预览读取 starter，避免打开学习中心就读取全量池。
4. `scripts/assemble-pages-artifact.mjs` 只在 `_site` 中删除 `sourceData` 全量源文件，不删除仓库源码。
5. 发布合同检查分片完整覆盖、远征卡可用、starter 音频资源存在、非 starter band 不引用未发布音频、全量源不发布。

## 分阶段验收

```powershell
node scripts/build_minecraft_vocab_runtime_shards.cjs
node scripts/test-minecraft-vocab-runtime-shards.mjs
node scripts/test-minecraft-vocab-publish-contract.mjs
node scripts/assemble-pages-artifact.mjs _site_minecraft_verify
node scripts/test-minecraft-vocab-runtime-shards.mjs _site_minecraft_verify
node scripts/test-minecraft-vocab-publish-contract.mjs _site_minecraft_verify
```

通过标准：默认入口只请求 starter；选择 band 才请求对应分片；`_site_minecraft_verify` 不含 `minecraft-vocab.json`；七个分片均存在；源卡片集合和分片集合一致。

## 下一阶段

主站已完成 starter 音频收口：starter/远征首轮使用静态 OGG，其余 band 不发布本地长尾音频，但保留 `externalNarrationAudio` 稳定 key。配置独立音频包后，先按 starter/band 加载索引，具体 OGG 按播放动作请求；只有 CDN 未配置、索引失败或播放失败时才使用浏览器语音回退。源 MP3/WAV 暂不删除。
