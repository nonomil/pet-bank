# GPT 参考游戏画面 Prompt：多目标弓箭打字 / 数学训练

## 目标

生成一张可作为网页改版参考的 16:9 游戏主画面。它不是最终素材切图，而是帮助确定整体玩法构图、目标牌位置、弓箭旋转、地图背景和低龄 UI 密度。

## Prompt

```text
Use case: stylized-concept
Asset type: kid-friendly browser game reference screen, 16:9 landscape

Primary request:
Create a polished reference mockup for a children's typing and arithmetic defense game. The scene is a bright voxel block world inspired by sandbox block games, but use original generic blocky monsters and props, not exact copyrighted characters. Three green blocky exploding monsters are walking toward the bottom of the screen from different depths. Each monster is firmly planted on the ground lane, with its feet touching the terrain, never floating.

Gameplay composition:
- Bottom center: a blocky bow launcher on the ground, aiming upward toward one selected monster.
- Show one arrow in flight along a clear diagonal trajectory toward the selected monster.
- Above every monster head: a dark small task plaque with a short target placeholder. Use simple white block glyphs or abstract marks only; the final webpage will render real text.
- One monster is highlighted as the current target with a warm outline and a small impact flash.
- Other monsters remain readable but less prominent.
- The monsters approach in perspective: far monsters are smaller and higher, near monsters are larger and lower.

UI layout:
- Top bar: heart icons, star rewards, score counters, simple progress bar.
- Bottom panel: compact learning-machine style keyboard, with one highlighted key.
- Keep the interface child-friendly and uncluttered. Use large targets, high contrast, and no dense instructions.

World/background:
- Sunny voxel grass field with a clear horizon, blocky dirt path lanes, a few block trees and square clouds.
- The terrain should make the ground line obvious so enemies feel anchored.
- No dark horror mood; it should feel playful and safe.

Style:
Original voxel game art, rounded enough for children, bright daylight, crisp readable silhouettes, polished casual web game UI, no marketing hero layout, no decorative gradient orbs, no text-heavy panels.

Constraints:
No real Minecraft logo, no exact Creeper replica, no watermarks, no readable long text, no floating monsters, no photorealism, no busy background behind task plaques.
```

## 负向提示

```text
Avoid: exact Minecraft branding, exact Creeper face copy, horror lighting, tiny UI, floating enemies, overcomplicated menus, illegible text, long paragraphs, sci-fi weapons, realistic guns, circular CSS-looking explosion rings.
```

## 生成后检查

- 目标牌是否真的在怪物头上。
- 弓箭是否明显指向被选中的怪物。
- 怪物脚底是否压住地面线。
- 同屏信息是否适合幼小衔接孩子一眼理解。
- 背景是否能作为网页舞台参考，而不是单纯插画。

