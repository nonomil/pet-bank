# 汉字跳台宠物动作包提示词

## 当前临时接入

- 使用现有项目宠物：`assets/banchong2/萌爪伙伴族/边牧-3.webp`
- 用途：替换原临时小人，作为汉字跳台接气泡的当前角色。
- 后续目标：生成同一角色的 `idle / run / jump / catch / celebrate` 动作包，并拆分为透明 PNG。

## 视觉参考图提示词

```text
Create a polished children learning game reference image for a landscape web game, viewport 844x390.

Game: Hanzi platform bubble catcher.
Audience: 5-7 year old children.
Scene: warm forest playground, soft sunlight, readable center play area, three floating platforms, glowing Hanzi bubbles, one cute border-collie puppy mascot jumping to catch a bubble.
Mascot: use the style of a fluffy border-collie puppy in a yellow raincoat, friendly, rounded, expressive, full-body, cute but not babyish, consistent with a pet reward website.
UI: leave top card and text areas blank because HTML will overlay pinyin, Chinese sentence, and score.
Composition: simple, big shapes, no clutter, character visually important, bubbles and platforms clearly separated.
Constraints: no readable text, no numbers, no letters, no Chinese characters inside the image, no watermark, no logo, no scary expression.
```

## 透明动作爆炸图提示词

```text
Create a transparent-background PNG asset explosion sheet for a children learning web game.

Subject: the same cute fluffy border-collie puppy mascot in a yellow raincoat, full-body, consistent style across all poses.
Canvas: transparent true alpha background, no checkerboard, no colored backdrop.
Assets to include, isolated with generous spacing:
1. idle standing pose, facing slightly right
2. running pose, small forward lean
3. jumping upward pose, paws lifted
4. catching pose, reaching upward with happy face
5. celebrate pose, star reward reaction

Style: polished 2.5D children's game art, soft edges, bright eyes, readable silhouette at small size, warm friendly palette.
Shadows: include only tiny soft contact shadows attached to each character, not a shared floor shadow.
Constraints: no readable text, no letters, no numbers, no Chinese characters, no speech bubbles, no watermark, no overlap between parts, complete body visible for every pose.
```

## 拆分命名

```text
pet_runner_idle.png
pet_runner_run.png
pet_runner_jump.png
pet_runner_catch.png
pet_runner_celebrate.png
```

## 接入规则

- HTML 只引用语义文件名，不引用 `part-03.png` 这种编号。
- 动作图保存到 `prj/学习机玩法原型/assets/generated/hanzi-jumper-assets/`。
- 生图后先用拆分脚本检查 alpha，再接入 `PET_JUMPER_ASSETS`。
- 当前玩法先用现有宠物图验证操作，不等待动作包完成。
