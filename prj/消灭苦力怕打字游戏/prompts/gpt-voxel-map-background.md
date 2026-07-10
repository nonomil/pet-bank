# GPT 地图背景 Prompt：多 lane 弓箭训练场

## 目标

生成可作为网页舞台背景的地图图，不包含角色、不包含 UI、不包含文字。后续网页会叠加多只苦力怕、头顶任务牌、弓箭、键盘和 HUD。

## Prompt

```text
Use case: stylized-concept
Asset type: 16:9 browser game stage background, 1920x1080

Primary request:
Create a clean voxel block world game background for a children's typing defense game. The camera faces a grassy field with three obvious dirt path lanes leading from the horizon toward the bottom foreground where a bow launcher will be placed later. No characters, no weapons, no UI, no text.

Composition:
- Clear horizon around the upper-middle of the image.
- Foreground grass and dirt lanes should provide very obvious grounding points for enemies so that creatures placed on top never look like they are floating.
- Leave the bottom 22% visually calm for the web keyboard panel overlay.
- Leave the upper center readable for target plaques and approaching enemies.
- Add a few blocky trees, square clouds, and distant hills, but keep the center play lanes uncluttered.
- The lanes should widen toward the viewer to imply forward motion and depth.
- The lower foreground should have some block texture variation so slight scrolling or parallax feels natural.

Style:
Original voxel art, bright sunny day, kid-friendly, polished casual game background, crisp shapes, warm greens and sky blues, no dark horror mood.

Constraints:
No Minecraft logo, no exact trademarked mobs, no characters, no UI, no words, no watermark, no dark vignette, no decorative gradient blobs.
```

## 使用说明

生成后保存为 `assets/generated/typing-defense-assets/voxel_map_background.png`，网页中作为 `.stage` 背景图使用；保留现有的 approach meter、任务牌和地面交互层。建议再单独生成一张更近景的地面纹理图，用于做可滚动的前景条带。
