# Minecraft 完整音频包与 CDN

## 目标

完整 Minecraft 词库有 `10,840` 条生成旁白、约 `131 MiB` 的 OGG/Opus 运行文件。词卡中少量历史 `word` 路径仍指向公共音频目录，缺失时按浏览器语音回退；独立包不伪造这些不存在的源文件。完整包不进入默认 Pages 制品，也不在用户打开普通学习中心时请求；只有部署配置了独立音频根地址时，Minecraft 词库页才请求一个版本化 `manifest.json`。

## 产物

```powershell
node scripts/assemble-minecraft-audio-artifact.mjs tmp/minecraft-audio-artifact v20260719
node scripts/test-minecraft-audio-artifact.mjs tmp/minecraft-audio-artifact
```

产物包含根 `manifest.json`、`indexes/starter.json`、各 band 索引和 `audio/*.ogg`。根 manifest 只描述索引，不列出 10,840 条文件；前端先取 starter 索引，用户选择 Minecraft band 后再取对应 band 索引，点击播放时浏览器才请求具体 OGG。索引用全量词库卡片里的 MP3 路径作为稳定 key，映射到 OGG/Opus 文件，并记录文件大小。源 MP3/WAV 和源全量 JSON 仍保留在仓库，不由该脚本删除。

## CDN 配置

将整个产物目录上传到不可变版本目录，例如 `https://static.example.com/petbank/minecraft-audio/v20260719/`，并在页面加载前配置：

```html
<script>
  window.PetBankConfig = {
    minecraftAudioBaseUrl: 'https://static.example.com/petbank/minecraft-audio/v20260719/'
  };
</script>
```

也可以使用 `window.__PETBANK_MINECRAFT_AUDIO_BASE_URL__` 或 `<meta name="petbank-minecraft-audio-base" content="...">`。默认没有配置，因此主站不会新增音频 manifest 请求。

CDN 应返回 `manifest.json` 的 `application/json`，音频返回 `audio/ogg`，支持 `Range` 和页面来源 CORS。版本目录可使用 `public, max-age=31536000, immutable`；账号、token、Profile、快照和 API 不得上传或缓存。

## 回退与验收

1. 没有 CDN 配置：starter 仍按 Pages 的同源 OGG 播放；band 不把浏览器语音当正常通道，只在 CDN 音频尚未索引、请求失败或播放失败时兜底。
2. manifest 404、JSON 无效或音频播放失败：记录模块告警，并回退本地 starter 或浏览器语音，不阻断词卡学习。
3. CDN 配置成功：词卡原有音频路径通过 manifest 映射到 CDN，不修改 Profile、积分和奖励协议。
4. 每次上传新版本目录后，先运行 artifact 合同，再检查 MIME、Range、CORS、缓存命中和上一版本回滚；不覆盖旧版本目录。

阶段完成标准：默认 Pages 文件数和体积不因完整音频回升；starter/band 索引按选择请求，具体音频按播放请求；索引合并后与全量词库 10,840 条生成旁白一一对应；CDN 正常和失败两条路径均能完成一张词卡学习。
