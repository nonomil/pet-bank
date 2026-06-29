# banchong 宠物生图提示词（补全 54 张）

> **用途**：本项目的 `assets/banchong/` 下有 **9 只 banchong 宠物的图完全缺失**（共 54 张：9 只 × 6 阶段）。本文档给出**可直接复制到 ChatGPT 网页版（GPT-IMAGE-2）手动生图**的完整英文 prompt，确保新生成的 54 张图与现有 banchong 视觉风格统一。
>
> **配套文档**：[./PVZ + Minecraft 宠物生图提示词.md](./PVZ%20+%20Minecraft%20宠物生图提示词.md)（PVZ/Minecraft 系，结构同本文件，可对照）。
> **基准规格**：[../规格/需求规格书.md](../规格/需求规格书.md)。
> **养成-死亡-救援参考**：[../参考/精灵乐园设计借鉴分析.md](../参考/精灵乐园设计借鉴分析.md)。

---

## 1. 使用说明

### 1.1 这份文档解决什么问题

`data/pets.json` 里登记了 9 只 banchong 宠物（啵啵龙虾 / 守护小萌 / 数码火吉 / 沁蓝灵鹿 / 炎炎烈狮 / 琉光虹虎 / 翡翠翼龙 / 苍玉仙狐 / 白鹿），但：

- 它们的 `imageUrl` / `imageStages` 路径仍指向 `/assets/images/pet/{英文-slug}-N.webp`（旧占位 slug）；
- `assets/banchong/{族名}/` 下**不存在**这 9 只宠物的任何 webp 文件；
- 因此前端加载时全部 404，必须靠 GPT-IMAGE-2 生成补齐。

> 注意：另有约 **83 只** banchong 宠物的图**已在** `assets/banchong/` 内，只需修 `pets.json` 路径（英文 slug → 中文名）即可显示，**无需生图**——见本文末 §7。

### 1.2 生图流程（ChatGPT 网页版）

1. 打开 [https://chat.openai.com](https://chat.openai.com)，确认模型选择 **GPT-IMAGE-2**（或同档图像模型）。
2. 复制本文档第 §4 中对应宠物的 6 条英文 prompt（0–5 阶段各一条），**逐条**粘贴发送。
3. GPT-IMAGE-2 每条 prompt 会生成 1 张图；下载保存为 `.png`（暂存）。
4. 用任意工具（如 [squoosh.app](https://squoosh.app) / Photoshop / 在线 webp 转换）将 png 转成 **`.webp`**。
5. 按 **命名规范**（§2.4）重命名，存放到 **对应族目录**（§2.5）。
6. 全部 54 张就位后，按 §5 修改 `data/pets.json` 对应 9 只宠物的 `imageUrl` 与 `imageStages[0..5]`。
7. 刷新前端，在「图鉴 / 宠物小屋」里验证 9 只宠物 6 阶段图都能正常显示、与同族其他宠物风格一致。

### 1.3 关键提醒

- **每条 prompt 末尾的「统一风格后缀」一个字都不要删**——那是 54 张图视觉统一的命根子。
- 同一只宠物的 6 条 prompt **必须连续生成**（同一会话、同一风格种子），避免阶段之间颜色/比例漂移。
- 如某阶段生成结果不满意，**只重发那一条**，不要重发整组，以免前后不一致。

---

## 2. 统一风格规范

### 2.1 整体风格基调（从现有 banchong 图提炼）

现有 banchong 系列（山海族 / 敦煌族 / 星瞳族 / 旅行族 / 灵兽族）的统一基调是：

> **「东方奇幻水彩绘本 + 萌系拟人神兽」**：柔和水彩晕染、低饱和高级灰底色 + 一抹族色高饱和点缀、圆润 Q 版化比例（大头大眼短肢）、白色或极浅色背景、姿态温和可亲（不凶恶）、带族特色神秘元素（光环/纹路/星点/灵气），整体像一张可收集的「神兽图鉴卡」。

族与族之间靠**族色 + 族元素**区分，但画风（笔触、比例、背景、光影）保持一致，确保拼在一起是一套。

### 2.2 统一风格后缀（每条 prompt 结尾必须带）

以下这段**英文关键词串**作为「风格签名」，复制粘贴到每条 prompt 末尾（占位 `{suffix}` 在 §4 各 prompt 中已写好，等价于下面这段）：

```
Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

> 每条 prompt 都已把这段拼进结尾，下文不再重复列。

### 2.3 尺寸 / 比例 / 负面词

- **尺寸**：方形 **1024×1024**（GPT-IMAGE-2 默认，对应现图比例，便于前端裁切）。
- **背景**：**纯白/极浅灰**（不要场景、不要地面、不要影子以外的环境）。
- **构图**：角色居中、全身、面朝镜头偏 3/4 侧。
- **负面词**（已在后缀内置）：`no text, no watermark, no signature, no border, no frame`。
- 额外注意：`no realistic photo style, no scary fangs, no blood, no weapon gore`（避免跑成写实恐怖风）。

### 2.4 命名规范

```
{中文名}-{0..5}.webp
```

例：`啵啵龙虾-0.webp`、`啵啵龙虾-5.webp`。中文名与 `pets.json` 的 `name` 字段完全一致，`-N` 对应 `stage`（0=蛋/幼体，5=终极形态）。

### 2.5 存放路径

```
assets/banchong/{族名}/{中文名}-{N}.webp
```

9 只目标宠物的族归属与目标目录：

| 宠物 | 族 | 目标目录 |
|---|---|---|
| 啵啵龙虾 | 双钳族 | `assets/banchong/双钳族/` |
| 守护小萌 | 守护系 | `assets/banchong/守护系/` |
| 数码火吉 | 守护系 | `assets/banchong/守护系/` |
| 沁蓝灵鹿 | 灵兽族 | `assets/banchong/灵兽族/` |
| 炎炎烈狮 | 灵兽族 | `assets/banchong/灵兽族/` |
| 琉光虹虎 | 灵兽族 | `assets/banchong/灵兽族/` |
| 翡翠翼龙 | 灵兽族 | `assets/banchong/灵兽族/` |
| 苍玉仙狐 | 灵兽族 | `assets/banchong/灵兽族/` |
| 白鹿 | 山海族 | `assets/banchong/山海族/` |

> `双钳族` 与 `守护系` 目录目前不存在，需手动新建。

---

## 3. 6 阶段渐进定义（0 → 5）

为保证同一只宠物 6 张图「连贯进化」，每阶段形态严格按下表递进。族色与族元素从阶段 1 开始显现，阶段 0（蛋）只含**暗示性族元素**。

| 阶段 | 别名 | 体型 | 表情 | 族元素强度 | 关键特征 |
|---|---|---|---|---|---|
| **0** | EGG 蛋/幼体 | 最小，蛋形或幼崽 | 闭眼/睡眼 | 极弱（仅壳面纹路暗示） | 圆润蛋壳，壳上有族色斑点/纹路，裂缝里透出微光或小芽 |
| **1** | HATCH 破壳幼体 | 小，幼崽比例（头身比 1:1） | 大眼好奇 | 弱（族色初现） | 刚出壳/睁眼，族色仅占身体一小部分，肢体短圆 |
| **2** | JUVENILE 少年 | 中，头身比 1:2 | 自信微笑 | 中（族色成型） | 族元素完整显现（角/翼/纹/钳等雏形），开始有姿态感 |
| **3** | ADULT 成年 | 大，头身比 1:3 | 沉稳威严 | 强（族元素成熟） | 族元素完全成熟，体型舒展，开始带光环/灵气雏形 |
| **4** | PRIME 完全体 | 更大 | 王者气度 | 极强（族元素 + 光效） | 多重族元素（如多尾/双翼/巨型钳），周身环绕光晕/粒子 |
| **5** | ULTIMATE 终极 | 最大，史诗感 | 神圣庄严 | 巅峰（族元素 + 神格化） | 神格化形态，族元素超量（九尾/四翼/双钳巨化），全身圣光环绕，眼神带神性 |

**核心规律**：随阶段递增 → 体型增大、族色加深、族元素增多/变大、光效增强、神性提升。**6 张图拼在一起必须看出一条进化链**。

---

## 4. 9 只真缺宠物生图 prompt（核心，54 条）

> 下方每只宠物 6 条 prompt 全部为**完整可用英文 prompt**，结尾已带统一风格后缀。直接复制粘贴即可。
> 每只的族特色元素基于宠物名 + 族推断，并与现有 banchong 同族风格对齐。

---

### 4.1 啵啵龙虾（双钳族）—— 龙虾，巨型双钳，海洋甲壳

**族色**：珊瑚红 + 深海蓝点缀。**族元素**：对称巨钳、甲壳节段、海洋气泡。

#### Stage 0 — 啵啵龙虾-0.webp

```
A small round egg with coral-red shell patterned like lobster segments, tiny deep-sea-blue speckles, a faint crack glowing soft aqua, a single tiny claw-shaped nub peeking out. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 1 — 啵啵龙虾-1.webp

```
A tiny baby lobster creature just hatched, chibi proportions, coral-red carapace with deep-sea-blue stripes, two small stubby claws, huge curious glossy eyes, tiny bubbles floating around it. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 2 — 啵啵龙虾-2.webp

```
A juvenile lobster creature, coral-red segmented carapace, two clearly formed claws of equal size, deep-sea-blue limb tips, confident smile, small bubbles and water droplets orbiting it. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 3 — 啵啵龙虾-3.webp

```
An adult lobster creature standing proud, fully formed coral-red armored carapace with deep-sea-blue joints, two large powerful symmetrical claws held high, majestic stance, faint aquatic aura shimmering around it. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 4 — 啵啵龙虾-4.webp

```
A prime lobster creature with oversized twin claws crackling with soft energy, coral-red and deep-sea-blue iridescent armor plating, water whirlpool forming beneath it, glowing bubbles spiraling upward, regal powerful pose. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 5 — 啵啵龙虾-5.webp

```
An ultimate divine lobster emperor, colossal twin claws glowing with sacred aqua light, full coral-red and deep-sea-blue ceremonial armor with golden trim, crown of swirling water, halo of ocean spirits, divine majestic aura, eyes radiating godly serenity. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

---

### 4.2 守护小萌（守护系）—— 萌系守护者

**族色**：奶白 + 樱花粉点缀。**族元素**：心形护盾光环、毛绒圆滚体型、守护之翼小翅膀。

#### Stage 0 — 守护小萌-0.webp

```
A small round egg with milky-white shell, soft cherry-blossom-pink heart patterns, a faint glowing crack, a tiny wing-shaped mark on top. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 1 — 守护小萌-1.webp

```
A tiny fluffy ball-shaped guardian creature, milky-white fur with cherry-blossom-pink cheeks, two tiny stubby wings, big sparkling innocent eyes, a faint heart-shaped glow floating above its head. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 2 — 守护小萌-2.webp

```
A juvenile fluffy guardian creature, round chubby milky-white body, small pink angel wings formed, holding a small translucent heart shield, warm caring smile, soft pink petals drifting around. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 3 — 守护小萌-3.webp

```
An adult guardian creature, plump milky-white furry body with flowing pink-tipped fur, fully formed feathered angel wings, holding a glowing heart-shaped shield, gentle protective gaze, soft halo ring above head. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 4 — 守护小萌-4.webp

```
A prime guardian creature radiating warm protective light, large fluffy milky-white body with flowing cherry-blossom-pink wings, both wings spread wide holding a brilliant heart shield, shower of soft pink petals and light orbs, serene guardian pose. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 5 — 守护小萌-5.webp

```
An ultimate divine guardian seraph, magnificent milky-white fluffy form wrapped in cherry-blossom-pink robes of light, six-feathered angel wings spread in full glory, holding a sacred heart shield blazing with holy radiance, golden halo crown, eyes full of divine compassion. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

---

### 4.3 数码火吉（守护系）—— 数码电子 + 火焰 + 吉祥

**族色**：电子青 + 烈焰橙。**族元素**：电路纹路、像素化火焰、吉祥符纹。

#### Stage 0 — 数码火吉-0.webp

```
A small round egg with dark shell etched in glowing cyan circuit lines, fiery-orange pixelated flame patterns, a crack emitting sparks of digital fire. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 1 — 数码火吉-1.webp

```
A tiny digital-fire creature just hatched, blocky cyan-circuit body with small orange flame tuft on head, pixel-edged limbs, big curious glowing eyes, faint sparks dancing around. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 2 — 数码火吉-2.webp

```
A juvenile digital-fire guardian, cyan-circuit armored body with clear orange flame mane flowing like pixelated ribbons, auspicious swirl patterns on chest, confident grin, small data-sparks orbiting. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 3 — 数码火吉-3.webp

```
An adult digital-fire guardian, sleek cyan-circuit carapace with full orange flame mane and tail, glowing auspicious symbol on forehead, balanced warrior stance, circuit lines pulsing with light. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 4 — 数码火吉-4.webp

```
A prime digital-fire guardian wreathed in roaring pixelated flames, intricate cyan-circuit armor glowing bright, twin orange fire ribbons spiraling from shoulders, auspicious halo forming, sparks and embers cascading. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 5 — 数码火吉-5.webp

```
An ultimate divine digital-fire deity, full-body cyan-circuit sacred armor ablaze with halo of pixelated orange flames, six fire ribbons orbiting like a mandala, glowing auspicious crown symbol, transcendent calm expression, holographic data petals falling. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

---

### 4.4 沁蓝灵鹿（灵兽族）—— 沁蓝水色 + 灵鹿

**族色**：沁水蓝 + 银白。**族元素**：水纹鹿角、流光蹄、水波涟漪。

#### Stage 0 — 沁蓝灵鹿-0.webp

```
A small round egg with pale aqua-blue shell, flowing water-ripple patterns in silver-white, a glowing droplet-shaped crack, tiny dew drops beading on the surface. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 1 — 沁蓝灵鹿-1.webp

```
A tiny fawn creature just hatched, soft aqua-blue fur with silver-white spots, two small nubs where antlers will grow, large gentle eyes, small water droplets floating around. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 2 — 沁蓝灵鹿-2.webp

```
A juvenile spirit deer, aqua-blue coat with silver-white underbelly, two small water-patterned antlers forming, hooves leaving tiny ripples, calm curious gaze, faint mist curling at its feet. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 3 — 沁蓝灵鹿-3.webp

```
An adult spirit deer standing graceful, full aqua-blue coat, elegant branching water-patterned antlers dripping luminous droplets, silver-white flowing tail, water ripples echoing beneath hooves. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 4 — 沁蓝灵鹿-4.webp

```
A prime spirit deer radiating aqueous light, magnificent aqua-blue coat with silver-white flowing mane, grand water-patterned antlers fanning out like a fountain, glowing water stream orbiting its body, hooves treading on a floating ripple platform. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 5 — 沁蓝灵鹿-5.webp

```
An ultimate divine spirit deer god, ethereal aqua-blue translucent coat, immense water-patterned antlers branching like a sacred willow, body wreathed in floating water ribbons and luminous mist, silver-white divine halo, eyes of serene godhood, ripples blooming into lotus shapes. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

---

### 4.5 炎炎烈狮（灵兽族）—— 烈火 + 狮

**族色**：烈焰红橙 + 金。**族元素**：火焰鬃毛、金瞳、火焰尾。

#### Stage 0 — 炎炎烈狮-0.webp

```
A small round egg with fiery-red-orange shell, golden flame-flicker patterns, a glowing crack emitting tiny embers, warmth radiating from the surface. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 1 — 炎炎烈狮-1.webp

```
A tiny lion cub creature just hatched, soft golden-orange fur with a small flame tuft on its head, big round curious eyes, faint embers dancing around. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 2 — 炎炎烈狮-2.webp

```
A juvenile lion creature, golden-orange fur with a forming flame mane around its head, bright golden eyes, small flame-tip tail, proud confident stance, soft embers drifting. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 3 — 炎炎烈狮-3.webp

```
An adult lion creature standing proud, full golden-orange flame mane blazing around its face, sharp golden eyes, strong muscular body, flame-tip tail curling, faint heat shimmer surrounding. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 4 — 炎炎烈狮-4.webp

```
A prime lion creature wreathed in roaring flames, magnificent golden-orange flame mane flowing like a wildfire, blazing ember crown, powerful regal pose, fire vortex spiraling at its feet, eyes burning with inner light. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 5 — 炎炎烈狮-5.webp

```
An ultimate divine lion sun-god, colossal golden-orange body wrapped in solar flames, mane a blazing sun-corona, ember crown of divinity, golden godly eyes radiating power, halo of fire spirits, commanding sacred stance. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

---

### 4.6 琉光虹虎（灵兽族）—— 琉璃光 + 彩虹 + 虎

**族色**：琉璃透明 + 七彩虹光。**族元素**：水晶半透明身体、彩虹纹路、棱镜光斑。

#### Stage 0 — 琉光虹虎-0.webp

```
A small round egg with translucent crystal shell refracting rainbow light, prismatic rainbow stripes swirling inside, a glowing crack splitting light into spectrum, tiny rainbows dancing on surface. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 1 — 琉光虹虎-1.webp

```
A tiny tiger cub creature just hatched, semi-translucent crystal body with faint rainbow stripes, big sparkling curious eyes, small prismatic light spots scattered around. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 2 — 琉光虹虎-2.webp

```
A juvenile tiger creature, semi-translucent crystal body with clear rainbow stripes, rainbow light refracting from its back, bright confident eyes, prismatic glints trailing its paws. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 3 — 琉光虹虎-3.webp

```
An adult tiger creature, fully crystalline semi-translucent body with vivid rainbow stripes, rainbow aura refracting around it, regal proud stance, light prisms orbiting its form, glowing eyes. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 4 — 琉光虹虎-4.webp

```
A prime tiger creature radiating prismatic light, magnificent crystalline body ablaze with rainbow stripes, twin rainbow arcs forming behind it, light spectrum scattering from its mane, majestic powerful pose. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 5 — 琉光虹虎-5.webp

```
An ultimate divine tiger prism-god, body of pure living crystal refracting seven-color rainbow light, mane a full rainbow corona, sacred rainbow halo behind head, paws treading on rainbow bridges, eyes glowing with divine spectrum, transcendent majestic stance. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

---

### 4.7 翡翠翼龙（灵兽族）—— 翡翠绿 + 翼 + 龙

**族色**：翡翠绿 + 金。**族元素**：翠玉鳞片、双翼、龙角。

#### Stage 0 — 翡翠翼龙-0.webp

```
A small round egg with jade-green shell veined like emerald stone, golden crack lines glowing, a faint crack showing tiny wing-shaped shadow inside. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 1 — 翡翠翼龙-1.webp

```
A tiny dragon hatchling, soft jade-green scales with golden tips, two small stubby wings, big curious glossy eyes, faint emerald shimmer around it. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 2 — 翡翠翼龙-2.webp

```
A juvenile dragon creature, jade-green scales with golden trim, two clearly formed wings, two small curved horns forming, confident bright eyes, soft golden sparkles trailing. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 3 — 翡翠翼龙-3.webp

```
An adult dragon creature, full jade-green scaled body with golden highlights, large feathered-membrane wings spread, two elegant curved horns, regal standing pose, golden aura shimmering. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 4 — 翡翠翼龙-4.webp

```
A prime dragon creature wreathed in emerald light, magnificent jade-green scales with golden flame-like trim, grand wings spread wide, twin curved horns glowing, golden energy swirling around, powerful majestic stance. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 5 — 翡翠翼龙-5.webp

```
An ultimate divine jade dragon god, colossal emerald-green body armored in golden sacred trim, four magnificent wings spread like a jade sunset, grand branching horns crowned with light, divine golden halo, eyes of ancient wisdom, sacred jade energy orbiting. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

---

### 4.8 苍玉仙狐（灵兽族）—— 苍玉青 + 仙气 + 狐

**族色**：苍玉青 + 月白。**族元素**：玉质九尾、仙气云雾、狐面纹。

#### Stage 0 — 苍玉仙狐-0.webp

```
A small round egg with pale jade-green shell swirling with moon-white mist patterns, a glowing crack emitting soft celestial vapor, tiny paw-print mark on top. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 1 — 苍玉仙狐-1.webp

```
A tiny fox kit creature just hatched, soft jade-green fur with moon-white tips, a single small fluffy tail, big curious mystical eyes, faint celestial mist curling around. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 2 — 苍玉仙狐-2.webp

```
A juvenile fox spirit, jade-green fur with moon-white belly, two small fluffy tails forming, faint celestial swirl patterns on back, bright intelligent eyes, soft mist at its paws. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 3 — 苍玉仙狐-3.webp

```
An adult fox spirit, full jade-green fur with moon-white flowing tails, three elegant fluffy tails, celestial swirl markings glowing, graceful poised stance, soft immortal mist drifting around. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 4 — 苍玉仙狐-4.webp

```
A prime fox spirit radiating immortal light, magnificent jade-green fur with flowing moon-white six tails fanning out, celestial markings blazing, elegant regal pose wreathed in sacred mist and floating spirit flames. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 5 — 苍玉仙狐-5.webp

```
An ultimate divine nine-tailed celestial fox goddess, ethereal jade-green translucent fur, nine magnificent moon-white tails fanning like a peacock of mist, sacred celestial halo, glowing immortal markings, eyes of ancient godhood, immortal clouds and spirit flames orbiting, transcendent divine stance. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

---

### 4.9 白鹿（山海族）—— 白色灵鹿，祥瑞神兽

**族色**：纯白 + 鎏金点缀。**族元素**：分叉灵角、祥云瑞气、金色灵纹。
> 与同族月灵狐 / 饕餮 / 青丘九尾狐保持一致的山海族神话灵兽风（水彩绘本 + 国风奇幻 + 萌系神兽，带灵气光环）。

#### Stage 0 — 白鹿-0.webp

```
A small round egg with pure-white shell traced with faint golden auspicious cloud motifs, a single glowing crack radiating soft sacred light, tiny antler-shaped marks on top, faint golden mist curling around it. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 1 — 白鹿-1.webp

```
A tiny white fawn creature just hatched, snow-white fur with a faint golden gleam, two small nubs where antlers will grow, large innocent sparkling eyes, faint auspicious mist and tiny golden sparkles drifting around. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 2 — 白鹿-2.webp

```
A juvenile spirit white deer, snow-white coat with golden-tipped fur, two small branching golden antlers forming, delicate golden spirit markings glowing on its flanks, calm intelligent eyes, soft auspicious clouds curling at its hooves. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 3 — 白鹿-3.webp

```
An adult white spirit deer standing graceful, full snow-white coat with golden spirit lines flowing along its body, elegant branching golden antlers glowing with sacred light, golden auspicious swirls floating around, poised serene stance, faint celestial halo forming above its head. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 4 — 白鹿-4.webp

```
A prime white spirit deer radiating sacred golden light, magnificent snow-white coat veined with brilliant golden spirit patterns, grand branching antlers like a glowing sacred tree, auspicious clouds and golden orbs orbiting its body, hooves treading on a floating ring of mist, regal divine pose. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

#### Stage 5 — 白鹿-5.webp

```
An ultimate divine white deer auspicious god, ethereal snow-white translucent coat shimmering with golden scripture lines, colossal branching golden antlers fanning like a sacred crown of light, body wreathed in glowing auspicious clouds and floating golden lotus, radiant divine halo, eyes of ancient benevolent godhood, transcendent sacred stance. Eastern fantasy watercolor illustration, soft pastel wash, painterly brushwork, low-saturation base with one vivid accent color, chibi kaiju proportions (big head, large glossy eyes, stubby limbs), gentle friendly expression, soft magical aura, subtle glowing particles, clean solid white background, centered full-body composition, collectible creature-card style, no text, no watermark, no signature, no border, no frame.
```

---

## 5. 生图后的接入步骤（54 张全部生成完后）

### 5.1 文件就位

确认以下 54 个文件均已落盘（命名严格 = 中文名 + 阶段号）：

```
assets/banchong/双钳族/啵啵龙虾-0.webp ... 啵啵龙虾-5.webp
assets/banchong/守护系/守护小萌-0.webp ... 守护小萌-5.webp
assets/banchong/守护系/数码火吉-0.webp  ... 数码火吉-5.webp
assets/banchong/灵兽族/沁蓝灵鹿-0.webp  ... 沁蓝灵鹿-5.webp
assets/banchong/灵兽族/炎炎烈狮-0.webp  ... 炎炎烈狮-5.webp
assets/banchong/灵兽族/琉光虹虎-0.webp  ... 琉光虹虎-5.webp
assets/banchong/灵兽族/翡翠翼龙-0.webp  ... 翡翠翼龙-5.webp
assets/banchong/灵兽族/苍玉仙狐-0.webp  ... 苍玉仙狐-5.webp
assets/banchong/山海族/白鹿-0.webp     ... 白鹿-5.webp
```

### 5.2 修改 data/pets.json

对这 9 只宠物，把每个 `stages[N].imageUrl` 与（如有）顶层 `imageUrl` / `imageStages` 改为：

```jsonc
// 例：啵啵龙虾（id: 375408c4-887）
"stages": [
  { "stage": 0, "imageUrl": "assets/banchong/双钳族/啵啵龙虾-0.webp" },
  { "stage": 1, "imageUrl": "assets/banchong/双钳族/啵啵龙虾-1.webp" },
  { "stage": 2, "imageUrl": "assets/banchong/双钳族/啵啵龙虾-2.webp" },
  { "stage": 3, "imageUrl": "assets/banchong/双钳族/啵啵龙虾-3.webp" },
  { "stage": 4, "imageUrl": "assets/banchong/双钳族/啵啵龙虾-4.webp" },
  { "stage": 5, "imageUrl": "assets/banchong/双钳族/啵啵龙虾-5.webp" }
]
```

其余 8 只同构替换 `{族名}/{中文名}`。注意：路径是否带前导 `/` 与现有 banchong 条目（如 `assets/banchong/灵兽族/岚纹麒麟-2.webp`）保持一致，不带前导斜杠。

### 5.3 验证

1. 本地起服务（项目静态资源根 = 仓库根），打开「图鉴」页，找到这 9 只宠物。
2. 切换每只的阶段 0→5，确认 6 张图都能加载、无 404。
3. 与同族其他宠物（如灵兽族 5 只新图 vs 现有 `岚纹麒麟`/`岩浆狮鹫` 等）并排看，画风、比例、背景应一致。
4. 控制台 Network 面板过滤 `banchong`，54 个请求应全部 200。

---

## 6. 可选增强（P1 / P2，非本次范围）

> 本节只给思路骨架，**不展开 54 条 prompt**。本次任务只覆盖 6 阶段形态图。

### 6.1 [P1] 宠物动作图（attack / happy / 喂食 / 升级）

- **思路**：在现有 6 阶段图基础上，为高频出场宠物额外生成动作帧（每只 +3~5 张），用作战斗动画 / 喂养反馈 / 升级特效。
- **prompt 骨架**：复用本文件 §2.2 风格后缀 + `[角色核心描述] + [动作: lunging forward attacking / jumping with joy / chewing food / glowing level-up aura]`。
- **命名建议**：`{中文名}-{N}-{action}.webp`（例：`炎炎烈狮-5-attack.webp`）。
- **触发时机**：M1 阶段补养成深度时再做（见 [../路线/差距清单与开发路线图.md](../路线/差距清单与开发路线图.md) §5 M1）。

### 6.2 [P2] 精灵乐园式状态图（饥饿 / 倒下 / 救援）

- **思路**：借鉴 [../参考/精灵乐园设计借鉴分析.md](../参考/精灵乐园设计借鉴分析.md) 的「养成-死亡-救援」闭环，为每只宠物生成 3 张状态图：`hungry`（饥饿、虚弱）、`down`（倒下、灵魂出窍）、`rescue`（被救援、复活光环）。
- **prompt 骨架**：`[角色核心描述] + [状态: slumped over with empty hunger bar / collapsed with spirit leaving body / bathed in revive halo] + [统一风格后缀]`。
- **命名建议**：`{中文名}-status-{hungry|down|rescue}.webp`。
- **触发时机**：M1 守护力（hunger/intimacy）落地后。

### 6.3 [P2] 皮肤 / 季节限定形态

- 节日皮肤（春节红 / 万圣橙）、季节限定（雪冬 / 樱春）等，骨架 = `[角色核心描述] + [季节主题元素] + [统一风格后缀]`。

---

## 7. 附：83 只修路径说明（无需生图）

`assets/banchong/` 下已有约 **83 只** banchong 宠物的图（山海族 / 敦煌族 / 星瞳族 / 旅行族 / 灵兽族 各族齐全，命名均为 `{中文名}-{0..5}.webp`）。这些图**无需生图**，只需在 `data/pets.json` 把它们的 `imageUrl` / `imageStages` 路径从旧的英文 slug 形式（如 `/assets/images/pet/{slug}-N.webp`）改为新的中文路径形式（`assets/banchong/{族名}/{中文名}-{N}.webp`）即可显示。

> 这是与本文档（生图）平行的另一项修复任务，建议作为单独 PR 处理：**「fix(pets): 修正 83 只 banchong 宠物图片路径」**。修复时只需对照 `assets/banchong/` 实际文件名做机械映射，不涉及图像生成。

---

**文档结束。** 54 条 prompt（§4）+ 风格规范（§2）+ 接入步骤（§5）构成完整闭环，按 §1.2 流程操作即可补齐 9 只缺失宠物的全部图。
