# Word Shooter image prompts

These prompts are based on the 2026-07-07 typing-shooter research in `docs/打字游戏方案/2026-07-07-单词射击调研与图片参考.md`.

Project rule: generated images must not contain readable text. English words, Chinese meanings, word queues, progress, and accessibility labels are rendered by HTML/CSS/JSON.

## Full reference

Create a polished 16:9 landscape reference image for a children's English typing shooter web game for ages 5 to 7. The game is a friendly learning arcade, not a combat game. A cute pet pilot in a small toy spaceship sits at the lower-left, facing right, launching soft colorful energy dots toward one large blank target object on the right side. Add two or three smaller upcoming blank target objects behind it, with clear spacing and no crowding. The target objects can be balloons, paper planes, treasure boxes, small planets, clouds, or toy cubes, each with an empty cream center area where HTML words can be overlaid later.

Use a bright sky-and-space playground scene with soft 2.5D clay game UI, rounded toy-like shapes, warm yellow, sky blue, mint green, coral, and cream. Keep the center readable and uncluttered. Leave clear empty UI areas for a top word queue, a current word panel, a small Chinese meaning card, and a reward/combo badge. Show gentle sparkles, star rewards, and harmless confetti-style hit feedback. No scary weapons, no fire explosions, no dark heavy arcade palette, no brand references, no Minecraft logo, no readable text, no letters, no numbers, no pinyin, no Chinese characters.

## Exploded transparent asset sheet

Create one transparent PNG exploded asset sheet for the same children's English typing shooter web game. True transparent alpha background, no checkerboard, no paper texture, no colored canvas, no scene background. All components must be isolated complete objects with generous transparent spacing, no overlap, no cropped shadows, and at least 80 px transparent padding around each object. Use the same polished soft 2.5D children's web game style as the full reference: bright sky blue, mint green, warm yellow, coral, cream, rounded toy-like shapes, soft shadows.

Include exactly these reusable components:

1. one friendly pet pilot toy spaceship idle pose, facing right
2. one matching spaceship shooting pose, facing right
3. one matching pet pilot celebration pose
4. one large blank balloon target with an empty cream center for HTML words
5. one blank paper-plane target with an empty cream center for HTML words
6. one blank treasure-box target with an empty cream center for HTML words
7. one blank small-planet target with an empty cream center for HTML words
8. one blank soft-cloud target with an empty cream center for HTML words
9. one blank toy-cube target with an empty cream center for HTML words
10. three soft energy bullets in different colors
11. one small sparkle hit burst
12. one star pop completion burst
13. one harmless confetti shard burst
14. one blank long word-queue panel
15. one blank current-word panel
16. one blank small meaning-card panel
17. one star reward badge
18. one combo badge
19. one pet-point reward token
20. one small rounded back button without icon text

Strict constraints: no readable text, no fake text, no letters, no numbers, no pinyin, no Chinese characters, no logos, no official game brands, no realistic guns, no missiles, no fire, no smoke clouds that look violent, no dark horror or combat mood.

## Suggested semantic asset names

```text
spaceship_idle.png
spaceship_shoot.png
pet_celebrate.png
target_balloon_blank.png
target_paper_plane_blank.png
target_treasure_box_blank.png
target_planet_blank.png
target_cloud_blank.png
target_cube_blank.png
bullet_blue.png
bullet_yellow.png
bullet_coral.png
hit_sparkle_burst.png
complete_star_burst.png
confetti_shards.png
panel_word_queue_blank.png
panel_current_word_blank.png
panel_meaning_card_blank.png
badge_star_reward.png
badge_combo_blank.png
token_pet_point.png
button_back_blank.png
```

## Integration notes

- Use the full reference to choose the final layout only.
- Use the transparent sheet for actual webpage assets after split, semantic rename, and alpha validation.
- Overlay the active English word on target objects with HTML, not image text.
- Keep current `wordQueue`, `typingProjectileLayer`, `typingShardLayer`, and `aimTypingGun` behavior; replace visual shells gradually.

## 2026-07-07 workflow outputs

Preflight:

```text
prj/gpt-image-workflow/output/20260707-word-shooter-preflight/preflight.json
```

Browser handoff for the full reference image:

```text
prj/gpt-image-workflow/output/20260707-word-shooter-reference-handoff/browser_prompt.txt
prj/gpt-image-workflow/output/20260707-word-shooter-reference-handoff/browser_handoff.md
```

Browser handoff for the transparent asset sheet:

```text
prj/gpt-image-workflow/output/20260707-word-shooter-assets-handoff/browser_prompt.txt
prj/gpt-image-workflow/output/20260707-word-shooter-assets-handoff/browser_handoff.md
```

Preflight result: Python, `browser-act`, and core pipeline scripts are available. No `IMAGE_API_KEY` is configured, so the logged-in browser handoff route was used for this run.

Actual 2026-07-07 result:

```text
Reference image:
prj/学习机玩法原型/assets/generated/reference/word-shooter-reference-chatgpt.png

Raw ChatGPT asset sheet:
prj/gpt-image-workflow/output/20260707-word-shooter-assets-handoff/downloads/selected/word-shooter-assets-chatgpt.png

Checkerboard-cleaned sheet:
prj/学习机玩法原型/assets/generated/reference/word-shooter-assets-sheet-chatgpt-clean.png

Published asset pack:
prj/学习机玩法原型/assets/generated/word-shooter-assets/
```

Quality note: the ChatGPT asset sheet visually matched the prompt, but the downloaded PNG still had a baked checkerboard background. The repo pipeline fixed this by running `remove-bg` with `checkerboard`, then `split`, semantic rename, and `publish-transparent`. See `prj/gpt-image-workflow/output/20260707-word-shooter-run-notes.md`.
