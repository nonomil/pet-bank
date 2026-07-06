# Agnes 积分图标资产提示词

## 目标

为积分、成长表、兑换页生成一套幼儿更容易理解的卡片图标。当前策略不再使用裁剪人物、熊或工程占位图，统一改为“星星向导 + 大物件奖励徽章”的儿童 App 资产。

## 母版提示词

```text
Create one square children's app reward icon for a preschool habit tracker.
Style: premium cute 3D clay toy illustration, soft rounded shapes, gentle pastel colors, clean glossy highlights, friendly and warm, high readability at 64px.
Composition: one single large centered subject, subject fills about 78% of the canvas, generous safe padding, front-facing 3/4 view, no cropping.
Background: transparent background or perfectly clean warm ivory background, no scene, no floor, no shadow touching the edge.
Text policy: no text, no letters, no numbers, no watermark.
Avoid: no bear, no realistic child, no realistic photo, no flat SVG icon, no emoji style, no messy stickers, no tiny details, no dark outline, no scary expression.
```

如果 Agnes 仍然把熊、动物或小人塞进任务图，改用更硬的物件版约束：

```text
Strict object-only rule: do not draw any character, no animal, no bear, no teddy bear, no mascot, no child, no face, no eyes, no ears, no paws, no arms, no legs.
```

## 单图主题

| 文件名 | 用途 | 主体提示词 |
| --- | --- | --- |
| `kidstar-guide.webp` | 主角/积分总览 | smiling golden star mascot with tiny leaf cape and rosy cheeks, holding a small sparkle wand |
| `kidstar-reading.webp` | 阅读/学习 | open storybook with one golden star bookmark and soft page glow |
| `kidstar-writing.webp` | 练字/日记 | chunky pencil writing on a rounded notebook page with one star sticker |
| `kidstar-math.webp` | 数学练习 | cute abacus and colorful counting beads, one star coin beside it |
| `kidstar-sports.webp` | 运动 | soft toy ball with small sneakers and motion sparkles |
| `kidstar-clock.webp` | 自控/按时 | friendly alarm clock with star hands and calm smile |
| `kidstar-tidy.webp` | 整理/家务 | tidy toy basket with blocks neatly stacked and one star badge |
| `kidstar-explore.webp` | 探索/观察 | rounded compass and small folded map with a star route |
| `kidstar-petcare.webp` | 宠物照护 | soft paw bowl with heart-shaped kibble and a tiny star tag |
| `kidstar-cooking.webp` | 做菜 | cute mixing bowl and wooden spoon with vegetable stars |
| `kidstar-gift-box.webp` | 兑换/盲盒 | chunky gift box with star ribbon and warm glow |

## 质量检查

- 缩到 64px 仍能一眼识别主体。
- 文件名、任务语义、画面主体必须一致。
- 不出现熊、真人、复杂背景或小字。
- 每张图的视觉重量接近，适合放进同一套卡片。

## 本次生成记录

- 模型：Agnes `agnes-image-2.1-flash`
- 规格：`256x256`，导出为 WebP，放入 `assets/ui/points-exchange/`
- 接口注意：当前 Agnes 端点不接受 `response_format` 字段，调用时需省略该字段，由返回的 `url` 下载图片。
