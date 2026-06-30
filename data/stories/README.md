# 探索故事文本（数据驱动）

> 每个场景一个 JSON，含事件序列 narrate/discover/math/choice/encounter。
> exploration-detail.js 启动时并发加载本目录 12 个文件 -> sceneEvents。
> 硬编码 sceneEvents 作兜底（fetch 失败回退）。

## 文件结构

每个 {scene}.json:
```json
{
  "id": "forest",
  "name": "神秘森林",
  "chapter": 1, "chapter_name": "起点花园",
  "events": [
    { "id": "forest.narrate0", "type": "narrate", "text": "..." },
    { "id": "forest.discover1", "type": "discover", ... },
    { "id": "forest.math2", "type": "math", "mathType": "arithmetic", "difficulty": "easy", ... },
    { "id": "forest.choice3", "type": "choice", "options": [...] },
    { "id": "forest.encounter4", "type": "encounter", ... }
  ]
}
```

## 文本-语音同步（已实现）

VoiceSystem (js/voice.js) 的 AUTOPLAY_RULES 监听 #galgameText：
galgame 对话框文字变化 -> 自动 speak(text) -> 查 assets/voice/map.json（文本 md5 -> mp3）命中则播预生成，否则降级 VoxCPM2 服务 / Web Speech。

新增/修改文本后，用 voxCPM2 生成对应 mp3 并登记 map.json（文本 -> md5 文件名），即可自动播报。

## 章节（03 章节结构）

1 起点花园(forest) / 2 森林边界(beach,candy) / 3 海边集市(waterfall,underwater) / 4 高地洞窟(mountain,cave,desert,castle,volcano) / 5 星空终点(space,stargarden)

## 审查

可用 codex 审查本目录 + docs/叙事重构/，评估文案/节奏/教育性/儿童适配。
