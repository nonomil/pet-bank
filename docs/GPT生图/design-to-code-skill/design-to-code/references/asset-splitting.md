# 素材拆分参考：多联图裁切 -> 透明PNG -> 分层PSD

本文件是分支B（素材拆分）的详细操作参考，由 SKILL.md 按需调用，不用每次都读。

## 1. 拆图脚本包结构

```
split_asset_sheet.py                 # 本地拆图脚本
boxes_example_for_current_sheet.json # 当前这张多联图的裁切坐标（每次针对新图要重新标注坐标）
README.md                            # 使用说明
```

依赖：
```bash
pip install pillow opencv-python numpy
```

运行示例：
```bash
python split_asset_sheet.py 原图.png \
  --config boxes_example_for_current_sheet.json \
  --out out_assets \
  --remove-checkerboard \
  --trim \
  --pad 8
```

参数说明：
- `--config`：JSON坐标文件，定义每个子元素在原图中的裁切框（x/y/宽/高）。
- `--remove-checkerboard`：把边缘连通的棋盘格图案转成透明（AI生成的"透明背景"有时是画出来的棋盘格而非真alpha透明）。
- `--trim`：裁掉元素周围多余的透明留白。
- `--pad`：裁完后统一留出的边距像素。

输出类似：
```
background_playground.png
avatar_shiba.png
coin_badge_1280.png
card_math.png
card_hanzi.png
card_cards.png
card_ranking.png
```

## 2. 分层PSD合成

### 2.1 manifest 坐标配置示例

`psd_manifest_example.json`：
```json
{
  "canvas": {"width": 1844, "height": 853},
  "layers": [
    {"name": "00_background_playground", "file": "../split_ui_assets_current/background_playground.png", "x": 0, "y": 0, "size": [1844, 853]},
    {"name": "10_card_math", "file": "../split_ui_assets_current/card_math.png", "x": 270, "y": 230, "size": [620, 240]},
    {"name": "11_card_hanzi", "file": "../split_ui_assets_current/card_hanzi.png", "x": 920, "y": 230, "size": [620, 240]},
    {"name": "12_card_cards", "file": "../split_ui_assets_current/card_cards.png", "x": 270, "y": 490, "size": [620, 240]},
    {"name": "13_card_ranking", "file": "../split_ui_assets_current/card_ranking.png", "x": 920, "y": 490, "size": [620, 240]},
    {"name": "20_avatar_shiba", "file": "../split_ui_assets_current/avatar_shiba.png", "x": 65, "y": 35, "size": [145, 145]},
    {"name": "21_coin_badge_1280", "file": "../split_ui_assets_current/coin_badge_1280.png", "x": 1530, "y": 45, "size": [250, 118]}
  ]
}
```

图层顺序按编号排列，数字越小越靠底层（背景在最底部，头像/徽章等最上层元素编号最大）。命名建议用两位数前缀分组，比如 `00_` 背景、`1x_` 卡片、`2x_` 前景装饰，方便在Photoshop图层面板里一眼看出层级关系。

### 2.2 生成命令

```bash
pip install pillow numpy
python create_layered_psd.py --manifest psd_manifest_example.json --out output.psd
```

### 2.3 让图像模型直接输出PSD时的prompt模板（备用方案，精度不如脚本合成）

只有在没有脚本环境、必须靠图像模型本身合成PSD时才用这个，优先级低于2.1/2.2的脚本方案：

```
请将这些已经拆分好的 PNG 图片重新合成为一个可在 Photoshop 中打开的 PSD 文件。

要求如下：
1. 每一张输入图片都作为 PSD 中的独立图层，不要合并图层。
2. 图层名称沿用原文件名，或按以下图层清单命名：
   00_background_playground
   10_card_math
   11_card_hanzi
   12_card_cards
   13_card_ranking
   20_avatar_shiba
   21_coin_badge_1280
3. 保留指定画布尺寸，所有元素的位置、大小、比例与原图一致。
4. 图层上下顺序按编号排列，背景层放最底部，头像和金币放最上层。
5. 自动去除与画布边缘连通的纯白背景或棋盘格背景，但不要误删元素内部的白色内容。
6. 边缘适当柔化，避免明显白边。
7. 最终输出一个可继续编辑的 PSD 文件，而不是扁平合成图。
8. 请检查最终 PSD 预览是否尽量还原原图，避免出现图层偏移、尺寸变化、顺序错误、白底残留或元素误删。
```

## 3. 常见坑

- **透明背景其实是棋盘格图案**：不是真alpha，`--remove-checkerboard` 只能处理边缘连通的部分，最稳做法是重新生图时prompt明确要求 `transparent background, no checkerboard pattern`。
- **PSD里文字不可编辑**：脚本合成的PSD图层都是像素图层，不是Photoshop原生文字层。卡片里的中文/图标/数字文字如果要能直接改，需要另外在Photoshop/Figma里重建文本层。
- **每张新图坐标都要重新标**：`boxes_example_for_current_sheet.json` / `psd_manifest_example.json` 里的坐标是针对具体某一张图标注的，换图后必须重新量坐标，不能直接复用旧坐标文件。
