# GPT 多动作苦力怕素材爆炸图提示词

用途：给 `消灭苦力怕打字游戏` 生成一张可裁切的 4x3 透明背景动作资产表。生成后把原图保存为：

```text
prj/消灭苦力怕打字游戏/assets/generated/reference/gpt-creeper-multi-action-sheet.png
```

然后运行：

```powershell
python .\prj\消灭苦力怕打字游戏\tools\split_gpt_creeper_action_sheet.py
```

## 直接粘贴到 ChatGPT 的提示词

Please generate a single transparent-background PNG asset sheet for a child-friendly typing defense game.

Subject: one Minecraft-inspired blocky green exploding monster, creeper-like, voxel cube body, square head, four short rectangular legs, pixel texture, consistent character design in every cell. Front-facing with slight 3/4 top-down game perspective, same lighting and same size in every cell.

Important walking requirement:
- The monster must always show four separate blocky feet.
- In the walking frames, the feet must move forward and backward in depth, not merely slide left and right.
- Use alternating gait: left front foot forward while right front foot back, then center, then right front foot forward while left front foot back, then center.
- Back feet should also counter-move, slightly higher/darker when behind and lower/brighter when forward, so the walk reads clearly in a small game sprite.

Canvas and layout:
- 4 columns x 3 rows sprite sheet.
- Transparent background.
- No text, no labels, no watermark, no UI, no ground.
- Each cell has one full-body character centered with safe padding.
- Keep the feet visible in all walking frames.

Required cells, left to right, top to bottom:
1. idle neutral stance.
2. walk frame A: left front foot forward/down and brighter, right front foot back/up and darker; back feet counter-move.
3. walk frame B: all four feet close to center, body slightly up.
4. walk frame C: right front foot forward/down and brighter, left front foot back/up and darker; back feet counter-move.
5. walk frame D: all four feet close to center, body slightly down.
6. danger mid: body lightly red-tinted, nervous flicker pose.
7. danger near: stronger red tint, angry face, about to explode.
8. attack warning: crouched tense pose, charged glow.
9. hit reaction: struck by arrow, bright impact flash, body breaking into small green cubes but still readable.
10. explosion frame 1: small orange-white blast with green cube fragments.
11. explosion frame 2: large blocky explosion, orange white core, grey smoke, green cube fragments.
12. explosion frame 3: fading smoke and scattered green cubes.

Style:
- Cute but exciting, suitable for a 5-7 year old.
- Pixelated voxel game art, crisp square edges, not realistic.
- Thick readable silhouette, high contrast.
- Avoid horror, gore, weapons, text, logos.
- Do not draw a background.
