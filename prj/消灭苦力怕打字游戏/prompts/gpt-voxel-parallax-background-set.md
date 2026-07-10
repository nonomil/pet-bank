# GPT 背景 Prompt：分层滚动地图素材组

## 目标

生成一组可用于网页 2D 视差滚动的体素风背景图。不是一整张完成图，而是 3 张可叠加的背景层，方便做“地面移动、视角轻微推进”的动画效果，减少画面单调感。

## 推荐分层

1. `sky_far.png`
   只包含天空、远山、远处方块云，不包含树、不包含地面。

2. `mid_hills_trees.png`
   只包含中景树、丘陵、远处草地边缘，不包含前景地面 lane，不包含角色。

3. `ground_lanes_near.png`
   只包含近景草地、三条 dirt lane、近景草块边缘。这个层后续最适合做轻微滚动或循环平移。

## 统一约束

```text
Use case: stylized-concept
Asset type: layered browser game background set for parallax animation

Visual direction:
Bright kid-friendly voxel block world, sunny daytime, clean readable silhouettes, original block-world style for a children's typing defense game.

Global constraints:
- No characters
- No monsters
- No weapons
- No UI
- No text
- No logos
- No watermark
- No exact Minecraft branding
- No dark horror mood
- No heavy fog
- No strong vignette
```

## Prompt A：天空远景层

```text
Create the far background layer for a children's voxel typing-defense game.

Only include:
- clean blue sky
- soft gradient daylight
- a few square voxel clouds
- very distant low hills near the horizon

Do not include:
- trees in the foreground
- ground lanes
- characters
- UI

Composition:
- 16:9 landscape
- horizon around upper-middle to middle
- keep center area open for enemy silhouettes and task plaques
- leave lower third visually simple because other layers will cover it

Output should work as a static far layer behind other scrolling layers.
```

## Prompt B：中景树丘层

```text
Create the middle background layer for a children's voxel typing-defense game.

Only include:
- mid-distance blocky trees
- grassy hills
- small shrubs
- distant terrain edges

Do not include:
- front ground lane
- characters
- weapons
- text

Composition:
- 16:9 landscape
- trees should stay mostly on left and right sides, leaving the central lanes readable
- shapes should be distinct but not busy
- the bottom edge should fade naturally into the near-ground layer that will be placed in front

Output should feel slightly closer than the sky layer and suitable for slower parallax movement.
```

## Prompt C：近景地面 lane 层

```text
Create the near-ground foreground layer for a children's voxel typing-defense game.

Only include:
- bright blocky grass ground
- three obvious dirt path lanes widening toward the viewer
- a few subtle grass tufts or block texture details
- maybe a couple of low grass-edge blocks near the far left and far right corners

Do not include:
- trees crossing the center
- characters
- UI
- text

Composition:
- 16:9 landscape
- center lane must be very readable
- side lanes must also be clear so enemies can stand on them without looking like they float
- bottom area should be visually calm enough to sit behind a keyboard panel
- lane texture should repeat cleanly enough that slight horizontal or vertical scrolling will not look broken

Output should feel like a dedicated gameplay ground layer, not a full illustration.
```

## 直接复制给 GPT 的简版总提示词

```text
请帮我生成一组儿童网页小游戏用的体素风背景素材，16:9，明亮白天，原创方块世界风格，不要角色、不要武器、不要 UI、不要文字、不要水印、不要 Minecraft logo。需要分成 3 张图：

1. 天空远景层：只有蓝天、方块云、非常远的低山，中心留空。
2. 中景树丘层：左右两侧有树和丘陵，中间保持干净，不要前景地面。
3. 近景地面层：只有草地和 3 条明显的 dirt lane，lane 从远处向前景变宽，方便网页里放 3 只怪，脚底必须能压在地面上，看起来不能悬浮。

整体风格要适合幼小衔接儿童英语/数学打字射击游戏，清爽、可爱、辨识度高，不要恐怖气氛，不要画满细节。近景地面层要适合做轻微滚动动画，纹理尽量自然衔接。
```

## 接入建议

- `sky_far.png`：最慢移动，几乎不动。
- `mid_hills_trees.png`：轻微横向或纵向慢移。
- `ground_lanes_near.png`：最明显的滚动层，可做慢速向下或纹理循环位移。
- 如果 GPT 一次很难稳定出三张一致风格图，先生成一张总参考图，再按同风格分别出三层。
