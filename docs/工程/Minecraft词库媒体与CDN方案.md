# Minecraft 词库媒体与 CDN 方案

## 结论

当前不需要单独购买或维护 CDN 服务器。主站先使用本地静态资源，由 GitHub Pages、Nginx 或自托管静态服务器直接提供。图片数量和访问量明显增长后，再把同一目录同步到对象存储/CDN，通过配置切换，不改变词卡数据结构。

## 参考站方案

MineWords 将词卡文字和媒体分开：

```text
API: word / chinese / phonetic / example
前端: 001 -> https://cdn.../minewords/001.webp
音频: 浏览器 SpeechSynthesis
```

接口没有 `imageUrl` 字段，但前端按卡片序号拼接公开 CDN 地址。当前已抓取 `001.webp` 到 `500.webp`，转为本地 WebP，并按参考站卡片序号写入媒体清单。

## 本项目落地

```text
data/learn/external/mayihaoke/word-cards.json  500 条文字快照
data/learn/external/mayihaoke/media-manifest.json  500 张媒体映射
assets/learn/english-vocab/minecraft-reference/card-001.webp
data/learn/packs/.../minecraft-vocab.json  合并后的学习池
```

媒体优先级：

1. Anki 本地图片/音频。
2. MineWords 本地图片。
3. VoxCPM2 本地 WAV（只覆盖缺少 Anki 音频的卡片，来源由 `audioSource: voxcpm2` 标记）。
4. 浏览器英语发音。
5. 统一文字词卡视觉 fallback。

当前主学习池为 `2,168` 个词，图片覆盖 `2,142` 个，已有 Anki/本地音频覆盖 `1,910` 个；剩余 `258` 个由 `scripts/generate_minecraft_vocab_audio.py` 使用 VoxCPM2 补全后，目标为 `2,168 / 2,168`。MineWords 来源卡片全部有本地图片。

VoxCPM2 静态音频目录和审计清单：

```text
assets/learn/english-vocab/minecraft-audio/card-*.wav
data/vocab/english-minecraft/audio-manifest.json
```

该批处理要求 NVIDIA GPU 和本地 VoxCPM2 权重；没有可用 GPU 时保持浏览器 SpeechSynthesis 回退，不把 edge-tts 生成结果标记为 VoxCPM2。WAV 与图片一样会随 `assets/` 进入 Pages 制品，不要求单独 CDN；媒体规模增大后可把整个版本化目录同步到对象存储，并只替换运行时媒体前缀。

## 稳定字段

不要把图片和数组位置永久绑定。生产数据应保留稳定的 `mediaKey` 或来源序号，同时保存最终本地路径：

```json
{
  "word": "creeper",
  "mediaKey": "minewords-019",
  "image": "assets/learn/english-vocab/minecraft-reference/card-019.webp",
  "audio": "",
  "imageFallback": "themed-text-card"
}
```

## 什么时候启用 CDN

本地静态资源适合当前规模。以下情况出现后再启用 CDN：

- 图片和音频增长到数百 MB 以上；
- 移动端访问量明显增加；
- 需要跨地区缓存和更快的首屏加载；
- 不希望大型媒体文件进入 Git 仓库。

启用时使用版本化目录，例如 `minecraft-vocab/2026-07-15/card-019.webp`，并设置长期缓存：

```text
Cache-Control: public, max-age=31536000, immutable
```

词卡中的 `image` 仍保存本地路径；运行时由 `mediaBaseUrl` 统一替换前缀。CDN 失败时回退本地资源或文字词卡，不能让学习页面整体失败。

## 可重复抓取

```powershell
node scripts/fetch-mayihaoke-minecraft-words.mjs
node scripts/fetch-mayihaoke-minecraft-media.mjs
python -X utf8 scripts/convert-mayihaoke-minecraft-media.py
node scripts/build_minecraft_full_learning_pool.cjs
node scripts/sync_vocab_registry.cjs
node scripts/test-mayihaoke-minecraft-media.mjs
node scripts/test-minecraft-vocab-content.mjs
```

参考站 `/word-map` 是通用英语年龄分级词表，当前单独保存为 `data/learn/external/mayihaoke/word-map.json`，不直接并入 Minecraft 专题池。
