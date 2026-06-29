# Minecraft 宠物动作图提示词（happy / attack）

> 本文档补全 8 只 Minecraft 宠物的 **happy + attack** 动作图，共 **16 张**，使 MC 宠物也拥有与 PVZ 一致的 3 动作交互（idle / happy / attack）。
>
> 风格、规范与 [PVZ + Minecraft 宠物生图提示词.md](./PVZ%20%2B%20Minecraft%20宠物生图提示词.md) 中的 Minecraft 段一致，仅在 **idle 形态基础上** 派生 happy / attack 姿态。

---

## 1. 使用说明

### 1.1 背景
- PVZ 8 宠物已有 idle/happy/attack 三动作图（`assets/pets/poses/{pet}_{action}.png`）。
- MC 8 宠物目前仅 5 进化阶段（egg/baby/idle/mature/ultimate），缺 happy/attack 两动作。
- 本文档产出 16 张 MC 宠物动作图，补齐 MC 宠物交互。

### 1.2 生图流程
1. 打开 ChatGPT 网页版（GPT-IMAGE-2 模型）。
2. 复制下方任一条 Prompt，粘贴并生成。
3. 下载图片，按 [§3.4 命名规范] 重命名。
4. 存入 `assets/pets/poses/` 目录。
5. 按 [§4 接入步骤] 修改 `js/app.js` + `pets.json`，让 MC 宠物显示动作按钮。

### 1.3 角色一致性原则
- happy / attack 必须 **基于该宠物 idle 形态**：同一只 Minecraft 宠物，仅改变动作姿态与情绪，不改变体色、体型、配饰。
- 每条 prompt = `[Minecraft {宠物} idle 形态核心描述] + [happy/attack 动作] + [Minecraft voxel 风格后缀]`。

---

## 2. 统一规范

### 2.1 Minecraft voxel 风格后缀（统一追加每条 prompt 末尾）

```
Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject
```

### 2.2 尺寸与画幅
- 1024×1024 方形，与现有 `mc_*.png` 一致。

### 2.3 负面词
`no text, no watermark, no border, no arrow, single subject`

### 2.4 命名规范
- 文件名：`mc_{pet}_{action}.png`
  - 示例：`mc_wolf_happy.png`、`mc_wolf_attack.png`
- action 取值：`happy` / `attack`（与 PVZ 动作图一致）。

### 2.5 存放路径
- 目录：`assets/pets/poses/`
- 完整路径示例：`assets/pets/poses/mc_wolf_happy.png`

---

## 3. 动作定义

| 动作 | 含义 | 典型姿态 |
|------|------|----------|
| **happy** | 开心 | 跳跃、笑眼眯起、发光、欢呼、摇尾、咧嘴笑等正向情绪 |
| **attack** | 攻击 | 露牙/獠牙、扑击、亮爪、竖毛、战斗姿势、蓄势怒吼等战斗姿态 |

---

## 4. 16 条 Prompt（8 宠物 × happy + attack）

> 每条均以该宠物 idle 形态描述开头，保证与现有 `mc_{pet}_idle.png` 角色一致。

### 4.1 狼 Wolf

**HAPPY** → 文件名: `mc_wolf_happy.png`

```
Official Minecraft wolf, gray-blue blocky fur, dark eyes, red collar, sitting idle pose base, now jumping happily mid-air with tail wagging fast, mouth open in a big pixel smile, tongue out, eyes curved into happy arcs, ears perked up, small floating pixel hearts above head. Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject.
```

**ATTACK** → 文件名: `mc_wolf_attack.png`

```
Official Minecraft wolf, gray-blue blocky fur, dark eyes, red collar, idle pose base, now in aggressive attack stance, front legs lowered and hind legs tensed ready to pounce, bared sharp pixel teeth, ears pinned back, eyes narrowed and glowing red, hackles raised, angry growl mouth, dust kicked up. Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject.
```

---

### 4.2 猫 Cat

**HAPPY** → 文件名: `mc_cat_happy.png`

```
Official Minecraft cat, black-white blocky fur, green eyes, elegant idle pose base, now jumping joyfully with arched happy back, eyes happily closed into curved arcs, mouth open in a purring smile, tail held high and curled tip, paws raised mid-hop, small floating pixel hearts and sparkles. Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject.
```

**ATTACK** → 文件名: `mc_cat_attack.png`

```
Official Minecraft cat, black-white blocky fur, green eyes, elegant idle pose base, now in fierce attack stance, back arched high with raised bristled fur, claws fully extended, hissing mouth bared fangs, ears flattened, narrowed glowing green eyes, tail puffed up and lashing, ready to strike. Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject.
```

---

### 4.3 兔子 Rabbit

**HAPPY** → 文件名: `mc_rabbit_happy.png`

```
Official Minecraft rabbit, brown-white spotted blocky fur, pink nose, long floppy ears, idle hopping pose base, now leaping high with a huge joyful arc, ears flying upward, eyes happily curved, mouth open cheerful, all four paws off the ground, floating pixel hearts and star sparkles around body. Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject.
```

**ATTACK** → 文件名: `mc_rabbit_attack.png`

```
Official Minecraft rabbit, brown-white spotted blocky fur, pink nose, long floppy ears, idle pose base, now in vicious attack lunge, hind legs extended for a powerful kick, front paws raised and clawing, mouth wide open showing sharp incisors, eyes glowing red with slit pupils, ears swept back aggressive, dust trail behind. Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject.
```

---

### 4.4 鹦鹉 Parrot

**HAPPY** → 文件名: `mc_parrot_happy.png`

```
Official Minecraft parrot, vivid red-blue-green-yellow pixel feathers, curved beak, idle perched pose base, now flying in joyful loop with wings spread wide open, head tilted up happily, eyes bright and cheerful, beak open mid-song, colorful pixel feathers ruffled playfully, musical note particles and sparkles floating around. Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject.
```

**ATTACK** → 文件名: `mc_parrot_attack.png`

```
Official Minecraft parrot, vivid red-blue-green-yellow pixel feathers, curved beak, idle pose base, now in aggressive dive-bomb attack, wings tucked for steep dive, beak open and pointed forward aggressively, talons extended and clawed, eyes narrowed and fierce, feathers sleeked back battle-ready, motion blur lines. Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject.
```

---

### 4.5 海龟 Turtle

**HAPPY** → 文件名: `mc_turtle_happy.png`

```
Official Minecraft sea turtle, green scute-patterned blocky shell, short flippers, gentle idle pose base, now happily raising head high with a big cheerful smile, eyes curved into happy arcs, all four flippers waving upward joyfully, small water splash droplets and bubbles around body, floating pixel hearts above head. Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject.
```

**ATTACK** → 文件名: `mc_turtle_attack.png`

```
Official Minecraft sea turtle, green scute-patterned blocky shell, short flippers, gentle idle pose base, now in defensive attack stance, neck fully extended forward with open snapping beak mouth, eyes narrowed and fierce, front flippers raised as shields with claws out, shell tilted forward as a battering ram, sand kicked up. Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject.
```

---

### 4.6 美西螈 Axolotl

**HAPPY** → 文件名: `mc_axolotl_happy.png`

```
Official Minecraft axolotl, pink blocky body, six external frilly gills, small limbs, swimming idle pose base, now doing a joyful backflip swim with body curled happily, eyes big and cheerful, mouth open in a wide smile, gills flowing upward, all four tiny limbs spread out, bubble particles and hearts floating around. Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject.
```

**ATTACK** → 文件名: `mc_axolotl_attack.png`

```
Official Minecraft axolotl, pink blocky body, six external frilly gills, small limbs, swimming idle pose base, now in aggressive ambush lunge with body coiled then springing forward, mouth wide open showing small sharp teeth, eyes narrowed and fierce, gills flared outward red, front limbs extended clawed, water disturbance trail. Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject.
```

---

### 4.7 末影人 Enderman

**HAPPY** → 文件名: `mc_enderman_happy.png`

```
Official Minecraft enderman, tall thin black blocky body, glowing purple eyes, long arms, holding a grass block, idle standing pose base, now doing a gentle happy sway with body slightly tilted, purple eyes curved into soft cheerful arcs, long arms relaxed and raised playfully, faint purple particle trail swirling upward in a celebratory pattern, grass block held up triumphantly. Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject.
```

**ATTACK** → 文件名: `mc_enderman_attack.png`

```
Official Minecraft enderman, tall thin black blocky body, glowing purple eyes, long arms, idle pose base, now in menacing attack stance, mouth wide open screaming, eyes fully lit and bright magenta with rage, long arms raised and stretched forward aggressively to grab, body leaning forward into a teleport lunge, dense purple particle distortion field around body, grass block dropped. Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject.
```

---

### 4.8 悦灵 Allay

**HAPPY** → 文件名: `mc_allay_happy.png`

```
Official Minecraft allay, small blue blocky ghost creature, translucent wings, floating idle pose base, now spinning joyfully in mid-air with wings fluttering fast, eyes big and sparkling happy, mouth open in a delighted smile, both hands clapping together above head, abundant blue particles and musical notes and hearts orbiting around body in a celebratory swirl. Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject.
```

**ATTACK** → 文件名: `mc_allay_attack.png`

```
Official Minecraft allay, small blue blocky ghost creature, translucent wings, floating idle pose base, now in determined attack dive with wings folded back for speed, eyes narrowed and focused with intense cyan glow, mouth set in a firm expression, both arms thrust forward shooting a concentrated beam of blue particle energy, sharp cyan light streaks, protective item orbiting fast. Minecraft voxel blocky, pixel texture, 16x16 texture feel, thick black outlines, white background, no text, no watermark, no border, no arrow, single subject.
```

---

## 5. 生图后接入步骤

### 5.1 资源就位
下载 16 张图，按命名存入：

```
assets/pets/poses/mc_wolf_happy.png      assets/pets/poses/mc_wolf_attack.png
assets/pets/poses/mc_cat_happy.png       assets/pets/poses/mc_cat_attack.png
assets/pets/poses/mc_rabbit_happy.png    assets/pets/poses/mc_rabbit_attack.png
assets/pets/poses/mc_parrot_happy.png    assets/pets/poses/mc_parrot_attack.png
assets/pets/poses/mc_turtle_happy.png    assets/pets/poses/mc_turtle_attack.png
assets/pets/poses/mc_axolotl_happy.png   assets/pets/poses/mc_axolotl_attack.png
assets/pets/poses/mc_enderman_happy.png  assets/pets/poses/mc_enderman_attack.png
assets/pets/poses/mc_allay_happy.png     assets/pets/poses/mc_allay_attack.png
```

### 5.2 代码接入（js/app.js）

当前 `js/app.js` 中 PVZ 动作图判定**硬编码** `sp.imageStyle === 'pvz'`，MC 宠物需扩展支持 `'mc'`。共 **5 处**需改：

**改动 1 — `getPetImagePath`（约 347-364 行）**

把 PVZ-only 判定改为同时接受 MC，且文件名前缀按 imageStyle 取（mc 用 `mc_{pet}_{action}`，pvz 用 `{pet}_{action}`）：

```js
function getPetImagePath(speciesId, pose) {
    const species = PetSystem.getAllSpecies();
    const sp = species.find(s => s.id === speciesId);
    if (!sp) return '';
    // PVZ / MC 宠物的动作（idle/happy/attack）用 poses/{前缀}{pet}_{action}.png
    const hasPoseArt = (sp.imageStyle === 'pvz' || sp.imageStyle === 'mc')
                       && ['idle', 'happy', 'attack'].includes(pose);
    if (hasPoseArt) {
        const prefix = sp.imageStyle === 'mc' ? 'mc_' : '';
        return `assets/pets/poses/${prefix}${speciesId}_${pose}.png`;
    }
    // 有 imageStages 的宠物（按阶段 key 0-4）
    if (sp.imageStages && sp.imageStages[pose]) {
        return sp.imageStages[pose];
    }
    // banchong 宠物（单图）
    if (sp.imageUrl) {
        return sp.imageUrl;
    }
    return '';
}
```

> 注：`speciesId` 对 MC 宠物已是 `wolf/cat/...`，加 `mc_` 前缀即得 `mc_wolf_happy.png`。

**改动 2 — `updatePetDisplayImg`（约 397 行）**

```js
const usePose = sp && (sp.imageStyle === 'pvz' || sp.imageStyle === 'mc')
                     && ['idle', 'happy', 'attack'].includes(currentPose);
```

**改动 3 — 灯箱 `selectLightboxPose`（约 486 行）**

```js
if (sp && (sp.imageStyle === 'pvz' || sp.imageStyle === 'mc')
       && ['idle','happy','attack'].includes(pose)) { ... }
```

**改动 4 — 灯箱渲染按钮与标题（约 455、459 行附近）**

把 `style === 'pvz'` 的判定改为 `style === 'pvz' || style === 'mc'`，让 MC 宠物灯箱也显示「动作展示」标题和 3 个动作按钮。

**改动 5 — 宠物页动作按钮显隐（约 520 行）**

```js
if (poseBtns) poseBtns.style.display =
    (sp && (sp.imageStyle === 'pvz' || sp.imageStyle === 'mc')) ? 'flex' : 'none';
```

完成上述 5 处后，MC 宠物将显示 idle/happy/attack 动作按钮、点击图片循环切换、灯箱支持 3 动作查看，与 PVZ 体验完全一致。

### 5.3 pets.json

确保 8 只 MC 宠物的 species 记录带 `imageStyle: 'mc'`（与 PVZ 宠物的 `'pvz'` 同位置字段）。若现有 MC 宠物该字段缺失或为 `'banchong'`/空，需统一改为 `'mc'`，否则上述判定不生效。

若不改 imageStyle，备选方案：在 `getPetImagePath` 增加 `speciesId` 前缀判断（MC 宠物 id 集合 `['wolf','cat','rabbit','parrot','turtle','axolotl','enderman','allay']` 命中即走 `mc_` 前缀分支）。但推荐用 imageStyle 字段，与 PVZ 保持一致。

---

## 6. 验收清单

- [ ] 16 张图全部生成并按命名存入 `assets/pets/poses/`
- [ ] 8 只 MC 宠物 species 在 pets.json 标 `imageStyle: 'mc'`
- [ ] `js/app.js` 5 处 `=== 'pvz'` 改为支持 `'mc'`
- [ ] 宠物页 MC 宠物显示 idle/happy/attack 按钮
- [ ] 点击图片循环切换 3 动作
- [ ] 灯箱查看 MC 宠物显示 3 动作切换
- [ ] happy/attack 与 idle 角色一致性（同体色/体型/配饰）
