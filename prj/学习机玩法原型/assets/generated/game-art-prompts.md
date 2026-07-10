# 学习机三游戏美术参考提示词

本文件用于 Agnes/GPT 生图。原则：图片只做舞台、角色、道具参考，不把文字做死在图里；所有学习内容仍由 JSON 和题库渲染。

## 单词射击

Use case: stylized-concept + transparent asset pack  
Asset type: sci-fi English typing shooter reference and reusable transparent UI sprites  
Primary request: a 16:9 landscape Typing Attack style word-shooter stage, with a sleek interceptor ship at lower-left firing neon beams toward multiple floating sci-fi targets on the right; targets are shield pods, orbit spheres, drone balloons, energy clouds, cargo crates, and hex cubes with blank dark center panels for HTML words  
Style/medium: polished light-sci-fi 2.5D web game UI, cool blue lighting, clean silhouettes, no childish toy proportions, no horror tone  
Composition/framing: horizontal combat lane, clear areas for top word queue, Chinese hint, enemy layer, pickup layer, weapon HUD, and impact FX  
Color palette: electric blue, cyan, white metal, deep navy, small amber accents  
Constraints: no readable text, no fake text, no letters, no numbers, no pinyin, no Chinese characters, no logos, no cockpit UI text burned into the asset  
Avoid: cute mascot ship, oversized rounded toy props, muddy dark background, cluttered cockpit interior, realistic military insignia  
Detailed prompts: `assets/generated/reference/word-shooter-scifi-prompts.md`

## 拼音贪吃蛇

Use case: stylized-concept  
Asset type: pinyin snake game board reference  
Primary request: a cute snake game board for kids, green garden grid, friendly snake head with eyes, rounded body segments, four biscuit-like food tiles where Chinese characters can be overlaid by HTML  
Style/medium: 2D casual game illustration, bright and clean, preschool friendly  
Composition/framing: top-down square board, clear 10 by 10 grid feeling, large snake and food objects  
Color palette: grass green, cream, lemon yellow, light blue, small coral accents  
Constraints: no embedded text, no Chinese characters in the image, leave food tiles blank for web text overlay  
Avoid: realistic reptile texture, dense background, dark palette

## 汉字跳台接气泡

Use case: stylized-concept  
Asset type: hanzi platform bubble catcher game reference  
Primary request: a landscape forest playground game scene for learning Chinese characters, three floating platforms, glowing bubbles where HTML Chinese characters can be overlaid, a cute project-style pet mascot jumping to catch the correct bubble  
Style/medium: polished 2D children's web game illustration, soft forest playground, friendly reward-game feeling  
Composition/framing: 16:9 horizontal viewport, top area reserved for pinyin and sentence prompt card, center reserved for pet mascot and bubbles, bottom kept simple for feedback  
Color palette: leaf green, warm sunlight, sky blue, cream white, small gold reward accents  
Constraints: no readable text, no letters, no Chinese characters in the generated image, no logos, leave bubbles and prompt card blank for HTML overlay  
Avoid: vertical Doodle Jump layout, busy platform patterns, tiny mascot, realistic cliffs, scary expressions

宠物动作包单独记录在 `assets/generated/reference/pet-runner-prompts.md`，用于生成 `idle/run/jump/catch/celebrate` 透明动作。

## 调研摘录

- Snake / 贪吃蛇：保留蛇头前进、吃食物变长、格子空间和方向键控制。
- 横版轻跑酷 / 跳台：保留左右换平台、跳起接取、背景前进感。
- 汉字对对碰：保留“提示 -> 匹配汉字”的认知闭环，不保留左右两列布局。
