# 旅行纪念资产持续迭代方案

**目标：** 为宠物旅行完成页、宠物小屋、成长档案准备一套可持续扩展的纪念徽章、旅行纪念卡、冰箱贴和宠物卡牌视觉资产，让孩子有“带东西回家”和“继续下一站”的具体期待。

**当前结论：** `docs/GPT生图/Grok生图.md` 的文件名是历史称呼，内容明确说明 Bee 通道当前模型列表为空、既有探测返回 404。因此不能把它当作 Grok 官方接口，也不能未经新探测就宣称生成成功。每次生成必须记录实际来源和探测结果，API key 只在本机进程内使用。

---

## 1. 资产角色与使用位置

### 1.1 旅行纪念徽章

**用途：** 探索地图节点、完成页、成长档案的“已去过”标记。

**第一批：**

- `forest-badge`：发光蘑菇/叶片/小路
- `beach-badge`：贝壳/漂流瓶/海浪
- `stargarden-badge`：星花/星尘/小月亮

**规格：** 透明 PNG，`512x512`，主体占画布 72%~84%，外圈留安全边距；无文字、无数字、无汉字。网页用 HTML 叠加“森林/海滩/星光花园”名称和完成状态。

### 1.2 旅行纪念卡

**用途：** 旅行完成页和成长档案的可收集卡片，展示宠物带回来的东西。

**规格：** 背景卡片和前景贴纸分离；卡片底图建议 `1200x800`，透明贴纸 `768x768`。禁止把文案烧录到图里，卡名、日期、下一站预告由 HTML 渲染。

### 1.3 冰箱贴/房间装饰

**用途：** 宠物小屋装饰库存，作为低成本、可重复收集的奖励。

**规格：** 单个贴纸 `512x512` 透明 PNG；需要有厚度、白边或软阴影，但阴影必须贴合主体且不能跨组件。优先设计为孩子一眼能认出的单一物件。

### 1.4 宠物旅行卡牌

**用途：** 成长档案、宠物图鉴和旅行记录的长期收藏层，不参与现有战斗数值。

**规格：** 先生成无文字卡面和宠物主体，再由 HTML 叠加名称、阶段、旅行地点和收藏状态。卡牌视觉只负责稀有度边框、背景纹样和宠物姿态，避免把学习信息画进图片。

---

## 2. 视觉方向

### 2.1 统一风格

- 明亮、软 3D 玩具感、轮廓清楚、适合 5~10 岁儿童。
- 纪念物主体大、背景简单、颜色区分场景：森林偏绿色，海滩偏蓝，星光花园偏深蓝紫但不使用大面积渐变作为信息承载。
- 不使用恐怖、尖锐、复杂写实或过密纹理；宠物表情要友好且有动作。
- 所有运行时图片无可读文字、字母、数字、拼音和中文字符。

### 2.2 来源标记

每份资产在 manifest 和发布记录里必须写明：

- `source: existing`：复用仓库已有素材。
- `source: Bee/Grok`：只有实际探测并成功使用 Bee 通道时才允许使用。
- `source: ChatGPT-web`：通过已登录 ChatGPT 页面生成时使用，不能写成 Grok/Bee。
- `source: manual`：临时占位或手工绘制，只用于原型，不得伪装成 AI 生成。

---

## 3. 目录与命名

建议将第一批资产放在：

```text
assets/generated/travel-memory/
  reference/
    travel-memory-reference-prompts.md
    travel-memory-reference.webp
    travel-memory-sheet.png
  badges/
    forest-badge.png
    beach-badge.png
    stargarden-badge.png
  cards/
    forest-card-bg.png
    beach-card-bg.png
    stargarden-card-bg.png
  fridge-magnets/
    forest-mushroom-magnet.png
    beach-shell-magnet.png
    stargarden-star-magnet.png
  pet-cards/
    pet-travel-card-frame.png
  manifest.json
  README.md
```

命名必须表达语义，不使用 `part-01.png`、`final2.png` 等临时名称。素材进入网页前先写 manifest，再接入 `data/travel-rewards.json` 的 `asset` 字段。

---

## 4. 生成批次

### Batch 0：参考图确认

只生成一张横向参考图，包含森林、海滩、星光花园三种旅行纪念物和宠物回家展示场景。重点验证：色彩、轮廓、孩子是否一眼看懂、是否适合压在网页卡片上。

### Batch 1：纪念徽章

生成三枚独立徽章或一张 3 格爆炸图。每格只放一个徽章，组件互不重叠，留足透明边缘；不放名称文字。

### Batch 2：冰箱贴

生成蘑菇、贝壳、星花三枚独立贴纸。要求有统一白边/软阴影和可读轮廓，便于放进小屋家具/装饰槽。

### Batch 3：旅行卡和宠物卡牌

先生成无文字卡面，再将宠物主体和边框拆分。卡面不直接写地点、等级、奖励和日期；这些字段必须由网页 DOM 渲染。

### Batch 4：网页集成

只接入通过 alpha、尺寸、naturalWidth 和浏览器截图检查的资产。先接森林、海滩、星光花园，验证后再扩展其他场景。

---

## 5. Prompt 规范

### 5.1 参考图 Prompt 模板

```text
Bright 3D toy-like children's pet adventure keepsake collection, for ages 5-10.
Show three visual themes in one clean reference board: glowing mushroom forest,
friendly blue beach with shell and bottle, star flower garden with tiny moon.
One cute companion pet returns home carrying a small keepsake. Large simple shapes,
clear silhouettes, warm friendly expressions, uncluttered composition, no readable
text, no letters, no numbers, no Chinese characters, no pinyin. Leave blank areas
where HTML labels will be overlaid later. Use a consistent material language across
all three themes. This is a visual reference only, not a final UI screenshot.
```

### 5.2 透明爆炸图 Prompt 模板

```text
Transparent PNG asset explosion sheet with exactly three isolated complete components:
forest glowing mushroom badge, beach shell badge, star garden flower badge.
True alpha transparency, not checkerboard. Components do not overlap, have generous
spacing and safe margins, soft shadow stays inside each component. No text, no letters,
no numbers, no Chinese characters, no pinyin, no UI, no frame, no watermark.
Each component must be centered and easy to crop into a 512x512 transparent PNG.
```

每次生成都要把实际 prompt 原文保存到 `reference/travel-memory-reference-prompts.md` 或对应批次目录，不把 key 写入 prompt、manifest、日志或回复。

---

## 6. 标准处理与验收

### 6.1 生成前

1. 阅读并遵守 `docs/GPT生图/Grok生图.md`。
2. 运行项目生图 pipeline preflight。
3. 探测 Bee 模型列表；若为空或返回 404，停止 Bee 路径并记录失败，不假设可用。
4. 若改用 ChatGPT 页面，来源标为 `ChatGPT-web`，遵守浏览器生成和页面内下载流程。

### 6.2 生成后

1. 原始文件进入 `reference/` 或 workflow `output/`，不直接放入运行时目录。
2. 用 split 工具裁切，语义重命名。
3. 发布为 RGBA PNG/WebP，检查尺寸、颜色模式和 alpha。
4. 检查四边 alpha 最大值为 0，确认无棋盘格伪透明和绿色残留。
5. 写 `manifest.json`：记录 `source`、`bbox`、`crop`、`opaquePixels`、输入文件和处理命令。
6. 运行 `node --check`、数据契约测试和资源存在性检查。
7. 浏览器检查 `naturalWidth > 0`、无相关 console error/warning、桌面 `1280x720` 和移动 `390x844` 无重叠/横向溢出。

### 6.3 发布门槛

- 没有 manifest 不接入网页。
- 没有 alpha 检查不发布透明素材。
- 没有浏览器截图不标记为验收通过。
- 生成来源不明或 Bee 探测失败时，只保留方案/原始失败证据，不伪造成功资产。

---

## 7. 与旅行纪念功能的接入

Phase B 的 `data/travel-rewards.json` 后续增加：

```json
{
  "asset": "assets/generated/travel-memory/badges/forest-badge.png",
  "cardAsset": "assets/generated/travel-memory/cards/forest-card-bg.png",
  "fridgeAsset": "assets/generated/travel-memory/fridge-magnets/forest-mushroom-magnet.png"
}
```

接入顺序：

1. 完成页展示徽章和纪念卡缩略图。
2. 旅行记忆记录保存 `asset` 引用，但不复制图片二进制到 localStorage。
3. 宠物小屋只展示已领取冰箱贴，不自动占用家具槽位；孩子主动选择后才摆放。
4. 宠物卡牌作为收藏展示，不改变 PetSystem 的经验、等级、战斗和积分算法。

---

## 8. 迭代记录模板

每个批次新增一份记录，至少包含：

- 日期、批次、实际来源和探测结果
- prompt 文件路径
- 原始文件、选中版本、裁切输出和 manifest 路径
- alpha/尺寸/网页加载检查命令及结果
- 桌面/移动截图路径
- 孩子体验观察：一眼是否看懂、是否想点开、文字是否遮挡
- 下一轮只改一个变量：轮廓、颜色、材质、表情或比例

第一轮不同时改变画风、卡片结构和奖励规则；先让视觉资产稳定，再持续扩展 12 个探索场景。
