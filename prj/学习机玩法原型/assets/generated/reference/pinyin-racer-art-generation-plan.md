# 拼音赛车生图与素材落地计划

## 工具分工

### Agnes

用于探索整体视觉，不直接作为运行时网页资产：

- 赛道构图和镜头方向
- S 弯、分叉、桥、隧道、坡道的氛围参考
- 主题统一性检查
- 首轮网页接入后的构图修正建议

### GPT Image 2 / Bee

用于生产最终可接入素材，调用配置只从 `docs/GPT生图/GPT生图模型key.md` 读取：

- 长条赛道背景
- 空白赛道段背景
- 透明/色键道具爆炸图
- 赛车动作帧和反馈特效

密钥不写入 prompt、代码、manifest 或提交记录。

## 生成批次

1. `reference-forest-sbend`：森林 S 弯完整构图。
2. `reference-coast-bridge`：海边桥与分叉构图。
3. `reference-space-skybridge`：太空高架与终点环构图。
4. `track-backgrounds`：三套长赛道 strip 和空白段背景。
5. `route-gates`：声母门、韵母门、声调门、图片补给站、听音门、终点门。
6. `road-props`：箭头、路锥、桥栏、隧道灯、泥地、加速带。
7. `car-feedback`：待机、加速、左右漂移、护盾、氮气、完成姿态。

## 统一约束

- 图片内禁止出现文字、字母、数字、汉字、拼音、logo、水印。
- 文字和拼音全部由 HTML/CSS 覆盖。
- 背景必须清楚表现道路边界、行驶方向和可选路线。
- 爆炸图每张只放 4-8 个组件，组件之间留足裁切间距。
- 色键图使用纯 `#00ff00`，并在发布前检查 RGBA 与边缘透明度。

## 目录和流水线

```text
assets/generated/reference/pinyin-racer-gpt-image-2-<timestamp>/
  prompts/
  raw/
  selected/
  clean/
  split/
assets/generated/pinyin-racer-track-assets/
  manifest.json
  _preview_contact_sheet.jpg
  gate_initial.png
  gate_final.png
  boost_pad.png
  tunnel_light.png
  shield_bubble.png
  nitro_burst.png
```

标准顺序：完整参考图 -> 选定构图 -> 长赛道背景 -> 透明爆炸图 -> 去色/裁切 -> 语义重命名 -> manifest -> 网页接入 -> 浏览器视觉复核。

## 验收

- 至少三套主题长赛道背景可加载。
- 至少五类路线设施有语义 PNG。
- 透明素材为 RGBA，边缘无绿色残留。
- 赛道背景没有烧录文字。
- 网页在桌面和 `844x390` 横屏下能看清道路、赛车和下一题设施。
