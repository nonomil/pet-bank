# Hanzi Jumper Redesign Review

## Current Problems

- The stage reads as a horizontal lesson card, not a vertical jumping game.
- The prompt plaque is too large and competes with the platforms.
- The example sentence text is visually louder than the player and the target platform.
- Platforms are spread left-to-right instead of upward, so there is no climb path.
- The player has no clear next landing target.
- The side scenic card feels like unrelated decoration.
- The generated assets mix several lighting and perspective styles.

## Reference Notes

- Doodle Jump and PapiJump both keep the rule surface simple: move left/right and keep jumping upward.
- The core composition is vertical: sparse platforms, high negative space, clear upward motion.
- The screen side wrapping and tilt/left-right movement are part of the play feel, but the visual lesson here should still read as "jump upward".
- HUD should be tiny: score, target, and maybe one icon. Teaching text should not occupy the play field.

## New Art Direction

Use a vertical "jump tower" inside the landscape web viewport. The center 44-52% of the screen is the active play column. Side areas are soft sky/grass background and optional small rewards. The target Chinese character appears as a small top capsule. Platforms are cloud/leaf/wooden ledges arranged diagonally upward, each with one large blank oval area where HTML will overlay a single Hanzi. The answer platform can glow, but the glow must not reveal the answer before interaction in later versions. The character is a cute small mascot, about the height of one platform, placed below the next landing point.

## Improved Full Reference Prompt

Create a polished child-friendly 2D mobile web game screenshot for a Chinese character learning jumping game inspired by Doodle Jump, but do not copy Doodle Jump characters or art. Landscape viewport 844x390. In the center, place a tall narrow vertical jump tower / play column, about 45% of the width and full height. The player climbs upward through sparse floating platforms. Use 5 platforms only, arranged diagonally upward with lots of open air between them. Each platform has a large blank cream oval center for one HTML Chinese character overlay; do not draw text. A cute small learning mascot is mid-jump under the next platform. At the very top, use only a tiny rounded target capsule, no large teaching card, no sentence text. Side areas should be soft sky, clouds, grass, and reward sparkles, but very quiet. Strong gameplay readability: platforms are the main objects, mascot is second, HUD is tiny. Style: modern claymorphism, soft 3D, toy-like, chunky rounded shapes, warm sky blue, mint green, sunny yellow, coral accents, cream centers. Avoid busy backgrounds, avoid large plaques, avoid dark theme, avoid Minecraft, avoid retro console frame, avoid visible letters or readable text.

## Improved Exploded Asset Prompt

Create a transparent PNG exploded asset sheet for the redesigned Chinese character jumping game. No readable text. Components must be isolated with generous transparent spacing and no overlap. Include: 1 tall vertical sky play-column background panel, 1 tiny top target capsule with blank cream center, 1 cute mascot idle pose, 1 cute mascot jump pose, 6 floating platforms in cloud/leaf/wood/lantern styles with blank cream oval centers, 1 platform glow overlay, 1 small star reward, 2 soft clouds, 1 sparkle burst, 1 small score badge. Use one consistent modern claymorphism style: toy-like soft 3D, rounded, pastel sky blue, mint green, sunny yellow, coral, cream. Transparent background must be real alpha, not white or checkerboard. Keep shadows attached to each asset and not clipped.
