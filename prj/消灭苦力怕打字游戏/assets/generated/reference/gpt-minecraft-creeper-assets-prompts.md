# GPT Minecraft-Style Creeper Asset Prompts

## Visual Reference Prompt

Create a visual reference image for a children's typing defense game, landscape mobile game viewport.

The game shows a blocky voxel green explosive monster approaching from the far grass field toward the player at the bottom, while a simple bow launcher waits at the bottom. The visual style must be very close to classic voxel sandbox game art: cube-based body parts, square head, rectangular body, four rectangular legs, pixelated green camouflage texture, hard orthographic edges, chunky block shadows, crisp pixel details, and no smooth rounded cartoon surfaces.

Audience: children age 5 to 7. The monster should be readable, cute enough for kids, but still clearly game-like and tense. The UI text areas must be blank because HTML will overlay all letters, pinyin, Chinese text, numbers, and scores.

Composition: bright blue sky, blocky grass ground, the monster centered on the approach path, one far tiny version and one near larger version as a visual concept, big empty space above the monster for a target bubble. Keep the image playful, simple, high contrast, and not scary.

Strict style constraints:
- voxel / pixel art / block game sprite feeling
- cube head, rectangular body, four block legs
- hard edges, no soft plush toy look
- pixelated green texture, not smooth gradients
- orthographic game asset lighting
- no text, no letters, no numbers, no watermark
- no realistic animal, no round mascot, no glossy clay render
- do not make it look like a generic cute 3D monster

## Transparent Asset Sheet Prompt

Create a transparent-background PNG asset sheet for a children's typing defense game. True alpha transparency, no checkerboard, no colored background, no floor plane. Isolated complete assets with generous spacing. No text, no letters, no numbers, no pinyin, no Chinese characters, no watermark.

Style must be very close to classic voxel sandbox game sprites: blocky cube forms, pixelated green camouflage texture, hard orthographic edges, square head, rectangular body, four rectangular legs, chunky pixel shadows contained inside each asset. Avoid smooth rounded cartoon 3D and avoid plush/toy shapes.

Create exactly these seven isolated assets, arranged in a clean 4-column sheet:

1. `creeper_generated_far`: small far-distance green voxel explosive monster, walking forward, four block legs visible, calm green.
2. `creeper_generated_mid`: medium-distance version, same character and proportions, walking forward, slightly larger, clear pixel face.
3. `creeper_generated_near`: near large version, same character, more detail, feet planted on an invisible ground line, strong block shadow under feet.
4. `creeper_generated_danger`: near large danger version, same character, red/orange warning glow and red pixel cracks, angry glowing eyes, still blocky.
5. `creeper_explosion_0`: first explosion frame, white/yellow flash with green voxel fragments, compact burst.
6. `creeper_explosion_1`: second explosion frame, larger orange/yellow ring, many cube fragments flying outward, strongest readable explosion.
7. `creeper_explosion_2`: final explosion frame, smoke puffs plus fading cube fragments, still stylized voxel, transparent around smoke.

Important consistency rules:
- All monster frames must look like the same character.
- The monster must have a square head and four block legs, not arms.
- Feet must align visually as if standing on the same ground line.
- Use hard pixel/voxel texture; avoid smooth gradients except small lighting on cube faces.
- Keep each asset fully inside its transparent cell with padding so nothing is cropped.
- No background, no scenery, no text, no labels.

Negative prompt: smooth 3D mascot, round body, soft toy, furry creature, realistic creature, glossy plastic, anime, watercolor, flat vector icon, tiny unreadable face, white background, checkerboard background, text.
