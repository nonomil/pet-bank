# 小屋背景装饰 Codex 建议

## 1. 现状结论

- `js/home.js` 里宠物小屋当前只有 `cozy_night`、`dawn`、`starry` 3 个背景主题，且都还是 CSS 渐变兜底，`img` 为空。
- 小屋结构是固定 5 槽位：`center_left`、`center_right` 两个 `floor`，`corner_left`、`corner_right` 两个 `corner`，`back` 一个 `backdrop`。
- `data/furniture.json` 当前共 8 件家具，全部以 emoji 充当视觉占位，没有独立图片资产。
- `assets/scenes-vn` 已有 12 张主场景背景：`forest / beach / mountain / space / candy / cave / waterfall / desert / underwater / castle / volcano / stargarden`。小屋背景应与这套世界观呼应，但不能直接变成“探索场景本体”，而应是“宠物在家时把冒险记忆带回房间”的温馨版本。
- 用户补充约束已经明确：
  - 背景：`no characters, no text`
  - 背景尺寸：横版 `16:9`
  - 装饰/家具：`transparent background` PNG
  - 总体风格：`watercolor storybook + anime`, warm cozy, 适合 4-8 岁

## 2. 风格母版

以下母版建议所有背景主题都固定带上，只替换主题词即可，避免 Agnes 每次跑偏：

```text
watercolor storybook illustration, anime-inspired children's room background, warm cozy interior, soft hand-painted texture, gentle atmospheric lighting, clean readable composition, layered depth, magical but safe, for children age 4-8, no characters, no text, wide 16:9
```

装饰 PNG 母版建议：

```text
watercolor storybook prop, anime-inspired children's room decoration, warm cozy fantasy, soft hand-painted texture, clean silhouette, transparent background, no text, cute and readable, for children age 4-8
```

## 3. 背景主题表

建议总量做成 8 个主题，其中保留现有 3 个并补足 5 个。这样既覆盖时间变化，也覆盖与 12 主场景联动的“冒险回家感”。

| 主题 id | 中文名 | 契合理由 | CSS 渐变兜底色 | 优先级 | Agnes 英文提示词 |
| --- | --- | --- | --- | --- | --- |
| `cozy_night` | 深夜温馨卧室 | 最稳的默认小屋，最符合“休息/治疗/陪伴”心智，也是晚间打开产品最自然的基底。 | `linear-gradient(180deg, #2a2350 0%, #3b2f63 45%, #5b4b8a 100%)` | P0 | `watercolor storybook illustration, anime-inspired children's pet room at night, warm cozy bedroom interior, moonlit window, soft amber lamp glow, plush rug, wooden floor, shelves and tiny decor, dreamy navy and violet palette, soft hand-painted texture, clean readable composition, magical but safe, no characters, no text, wide 16:9` |
| `dawn` | 清晨阳光房 | 对应“新的一天开始”，适合签到、喂食、成长反馈，儿童产品里情绪最积极。 | `linear-gradient(180deg, #f6c68b 0%, #f3a8a2 38%, #8ecae6 100%)` | P0 | `watercolor storybook illustration, anime-inspired children's pet room at dawn, warm cozy sunroom interior, gentle sunrise through big windows, pale gold light, pastel curtains, tidy wooden furniture, fresh and hopeful mood, soft hand-painted texture, clean readable composition, no characters, no text, wide 16:9` |
| `starry` | 星空阁楼 | 承接 `space` 与 `stargarden` 世界观，最容易和星瞳族、灵兽族宠物统一。 | `radial-gradient(circle at 30% 20%, #1a1f4d 0%, #0d1130 60%, #000018 100%)` | P0 | `watercolor storybook illustration, anime-inspired cozy attic pet room under a starry sky, skylight window, hanging stars, soft blue-purple glow, tiny celestial ornaments, warm blankets and wood beams, magical but gentle, soft hand-painted texture, clean readable composition, no characters, no text, wide 16:9` |
| `garden_balcony` | 花园阳台小屋 | 与 `forest / beach / waterfall / stargarden` 都能自然联动，色彩轻快，适合春夏运营。 | `linear-gradient(180deg, #b7e4c7 0%, #8fd3c8 45%, #f6d7a7 100%)` | P0 | `watercolor storybook illustration, anime-inspired children's pet room with a garden balcony, warm cozy interior opening to flowers and greenery, potted plants, white curtains, sunny fresh air, soft pastel greens and peach light, hand-painted texture, readable cozy composition, no characters, no text, wide 16:9` |
| `underwater_aquarium` | 海底水族房 | 直接呼应 `underwater` 场景，但必须做成安全、观赏型、像主题房而非真实海底，儿童接受度高。 | `linear-gradient(180deg, #7ad7f0 0%, #4ca7d8 45%, #1f5d8f 100%)` | P1 | `watercolor storybook illustration, anime-inspired cozy pet room with underwater aquarium theme, big round windows with gentle fish silhouettes outside, turquoise glow, shells, bubbles, coral-inspired decor, warm safe interior, soft hand-painted texture, cute and readable, no characters, no text, wide 16:9` |
| `candy_cottage` | 糖果甜梦屋 | 对应 `candy` 场景，孩子天然喜欢，适合节日活动和奖励反馈。注意不能做得太甜腻刺眼。 | `linear-gradient(180deg, #ffd6e7 0%, #ffc4a3 45%, #fff1b8 100%)` | P1 | `watercolor storybook illustration, anime-inspired cozy candy-themed pet room, pastel sweets decor, marshmallow cushions, cookie shapes, strawberry milk colors, warm gentle lighting, whimsical but tidy, soft hand-painted texture, readable composition, no characters, no text, wide 16:9` |
| `forest_treehouse` | 森林树屋 | 对应 `forest` 主场景，适合旅行族、灵兽族等更偏自然系宠物。 | `linear-gradient(180deg, #7fb77e 0%, #4f8f6b 45%, #d6b37a 100%)` | P1 | `watercolor storybook illustration, anime-inspired cozy pet treehouse room, wooden walls, leafy window view, hanging vines, forest breeze, soft green and honey light, tiny adventure keepsakes, warm safe atmosphere, hand-painted texture, no characters, no text, wide 16:9` |
| `volcano_hearth` | 火山暖窝 | 对应 `volcano` 场景，但应该强调“炉火暖窝”而不是危险熔岩，适合冬季或力量型宠物。 | `linear-gradient(180deg, #5b3a32 0%, #8f4e3a 42%, #f2a65a 100%)` | P1 | `watercolor storybook illustration, anime-inspired cozy pet room with volcano hearth theme, warm stone fireplace, amber glow, red-orange blankets, volcanic crystal decor, strong but safe atmosphere, soft hand-painted texture, readable composition, no characters, no text, wide 16:9` |

## 4. 主题取舍建议

### 4.1 为什么不是直接做 12 个小屋主题

- `scenes-vn` 的 12 张图是“冒险发生地”，小屋是“养成与陪伴空间”，如果完全一比一映射，会削弱“回家”的感觉。
- 更合理的方法是先做 8 个高辨识主题，其中 5 个与外部世界轻度联动，保留居家核心。

### 4.2 推荐主题组合

- 默认常驻：`cozy_night`、`dawn`、`starry`
- 强运营价值扩展：`garden_balcony`
- 高记忆点扩展：`underwater_aquarium`、`candy_cottage`
- 世界观联动扩展：`forest_treehouse`、`volcano_hearth`

## 5. 装饰 / 家具生图建议

## 5.1 当前家具哪些可以先继续用 emoji

以下 2 件可以暂时继续 emoji 占位，不必第一批就生图：

| 家具 id | 中文名 | 当前形态建议 | 理由 |
| --- | --- | --- | --- |
| `food_bowl` | 食盆 | 可先保留 emoji，后续再补图 | 小而功能性强，玩家理解成本低；在有完整背景前，食盆不是视觉主角。 |
| `bath_tub` | 浴缸 | 可先保留 emoji 或做简图标版 | 虽然重要，但槽位在角落，第一批更应该优先补“房间氛围型”物件。 |

## 5.2 当前家具里最值得先生图的

这些物件会直接决定“小屋像不像一个可爱的家”，建议优先转为 PNG：

| 家具 id | 中文名 | 槽位 | 建议 | 优先级 | Agnes 英文提示词 |
| --- | --- | --- | --- | --- | --- |
| `cozy_rug` | 温暖地毯 | `floor` | 必须改成图片。地毯是地面视觉锚点，emoji 无法提供体积感。 | P0 | `watercolor storybook prop, anime-inspired cozy round rug for a children's pet room, fluffy texture, warm pastel colors, star and paw pattern, soft readable silhouette, transparent background, no text` |
| `soft_cushion` | 软垫 | `floor` | 必须改成图片。和宠物互动最强，能增强“可坐可趴”的陪伴感。 | P0 | `watercolor storybook prop, anime-inspired plush floor cushion for a children's pet room, soft rounded shape, pastel fabric, cozy fantasy detail, transparent background, no text` |
| `toy_box` | 玩具箱 | `floor` | 必须改成图片。比 emoji 更能表达成长、玩耍、收藏感。 | P0 | `watercolor storybook prop, anime-inspired toy box for a children's pet room, wooden box filled with cute toys, tidy and colorful, warm cozy fantasy, transparent background, no text` |
| `night_lamp` | 夜灯 | `corner` | 必须改成图片。它决定夜景气氛，是 `cozy_night` 和 `starry` 的关键补光装饰。 | P0 | `watercolor storybook prop, anime-inspired bedside lamp for a children's pet room, warm amber glow, cute rounded design, magical but safe, transparent background, no text` |
| `wall_frame` | 墙饰相框 | `backdrop` | 建议改成图片。背景槽位只有一个，相框比 emoji 更能填补墙面空洞。 | P0 | `watercolor storybook prop, anime-inspired decorative wall frame for a children's pet room, cute fantasy picture frame with soft gold and wood details, transparent background, no text` |
| `star_mobile` | 星星挂饰 | `backdrop` | 建议改成图片。和 `starry`、`stargarden` 主题天然匹配。 | P0 | `watercolor storybook prop, anime-inspired hanging star mobile for a children's pet room, tiny stars and moons, gentle dreamy motion feel, transparent background, no text` |

## 5.3 建议新增的装饰图类型

当前家具目录只有 8 件，数量不足以支撑“主题切换”的新鲜感。即使代码暂时不扩家具系统，也建议先备图，后续可直接挂到 `floor / corner / backdrop` 三类。

| 建议 id | 中文名 | 建议槽位 | 作用 | 优先级 | Agnes 英文提示词 |
| --- | --- | --- | --- | --- | --- |
| `potted_plant` | 盆栽植物 | `corner` | 最低成本提升生命力，适配 `dawn`、`garden_balcony`、`forest_treehouse`。 | P1 | `watercolor storybook prop, anime-inspired potted plant for a children's pet room, soft leaves, cute ceramic pot, warm cozy fantasy, transparent background, no text` |
| `book_stack` | 冒险绘本堆 | `corner` | 呼应“成长伙伴”学习感，也能承接主线冒险世界。 | P1 | `watercolor storybook prop, anime-inspired stack of children's adventure books for a cozy pet room, pastel covers, tidy and cute, transparent background, no text` |
| `shell_garland` | 贝壳串饰 | `backdrop` | 对应 `underwater_aquarium` 和 `beach`。 | P1 | `watercolor storybook prop, anime-inspired shell garland wall decoration for a children's pet room, pastel shells and beads, transparent background, no text` |
| `flower_wreath` | 花环墙饰 | `backdrop` | 对应 `garden_balcony`、`stargarden`，情绪轻柔。 | P1 | `watercolor storybook prop, anime-inspired flower wreath wall decoration for a children's pet room, pastel blossoms and ribbon, transparent background, no text` |
| `crystal_lamp` | 星晶小灯 | `corner` | 对应 `starry`、`space`、灵兽系宠物，能拉高梦幻感。 | P1 | `watercolor storybook prop, anime-inspired crystal night light for a children's pet room, gentle blue glow, magical but safe, transparent background, no text` |
| `mini_aquarium` | 小水族箱 | `corner` | 对应 `underwater_aquarium`，主题识别强。 | P1 | `watercolor storybook prop, anime-inspired mini aquarium for a children's pet room, round glass tank, tiny fish and bubbles, cozy fantasy, transparent background, no text` |
| `campfire_pillow` | 篝火抱枕 | `floor` | 对应 `volcano_hearth`，但用抱枕表达安全感，而不是危险火焰。 | P1 | `watercolor storybook prop, anime-inspired campfire-shaped pillow for a children's pet room, soft plush fabric, warm orange and gold palette, transparent background, no text` |
| `cloud_shelf` | 云朵壁架 | `backdrop` | 适配 `dawn`、`starry`、`candy_cottage`，儿童感强。 | P1 | `watercolor storybook prop, anime-inspired cloud-shaped wall shelf for a children's pet room, pastel wood and soft curves, transparent background, no text` |

## 6. 家具策略：哪些该生图，哪些不必过度投入

### 6.1 适合生图的类别

- 墙面装饰：相框、挂饰、花环、壁架
- 地面锚点：地毯、软垫、玩具箱
- 气氛光源：夜灯、星晶灯
- 主题型角落物：盆栽、小水族箱、书堆

这些物件的共同点是：

- 轮廓清晰，适合 PNG 透明底叠层
- 对儿童用户来说一眼能认
- 能直接拉开不同主题之间的视觉差异

### 6.2 不建议一开始重投的类别

- 功能过于单一的小件餐具
- 需要极强透视精度的大型成套家具
- 细碎杂物太多的组合图

原因不是不能做，而是当前小屋只有 5 槽位。先做“大轮廓、大情绪”的装饰，投资回报更高。

## 7. 一致性约束

## 7.1 与现有 `scenes-vn` 的统一规则

- 小屋背景不是探索场景复刻，而是“把外部世界的色彩与纪念品带回室内”。
- 色相可以借 `forest / underwater / candy / volcano / stargarden`，但构图必须保留明显的室内元素：地板、墙面、窗户、灯、布艺、木结构。
- 不要在小屋背景里放完整角色、宠物主体、UI 风格文字或过强叙事事件。

## 7.2 与角色立绘的统一规则

- 保持 `watercolor storybook + anime`，避免纯厚涂、纯写实、纯 Q 版贴纸风。
- 颜色要柔和，但不能灰蒙；需要保留适度高光，让立绘叠上去后仍有层次。
- 背景细节密度要低于角色立绘，不抢宠物主体。

## 7.3 面向 4-8 岁儿童的约束

- 必须温馨、可爱、可亲近，避免尖刺、深海恐怖、诡异眼睛、骷髅、压迫式阴影。
- `volcano`、`underwater`、`starry` 这类容易做冷或危险的主题，要明确加上 `safe`, `gentle`, `cozy`, `warm interior`。
- 即使是夜景，也要有暖光源，不做阴森黑屋。

## 7.4 Agnes 提示词固定负向约束

背景建议固定附加：

```text
no characters, no people, no pets, no text, no logo, no horror, no creepy face, no photorealism, no cluttered composition
```

装饰 PNG 建议固定附加：

```text
transparent background, no text, no logo, no photorealism, no scary details, clean silhouette
```

## 8. 优先级建议

## 8.1 P0 必须有

### 背景主题

- `cozy_night`
- `dawn`
- `starry`
- `garden_balcony`

理由：

- 这 4 个已经能覆盖“默认夜晚 / 白天 / 梦幻夜空 / 春夏清新”四类高频心情。
- 不依赖强主题世界观，也最适合先验证背景图与 DOM 家具叠加效果。

### 家具 / 装饰

- `cozy_rug`
- `soft_cushion`
- `toy_box`
- `night_lamp`
- `wall_frame`
- `star_mobile`

理由：

- 这 6 件覆盖地面、角落、墙面三类槽位。
- 做完之后，小屋即使主题不多，也会立刻从“emoji 占位”升级到“完整房间”。

## 8.2 P1 锦上添花

### 背景主题

- `underwater_aquarium`
- `candy_cottage`
- `forest_treehouse`
- `volcano_hearth`

### 家具 / 装饰

- `potted_plant`
- `book_stack`
- `shell_garland`
- `flower_wreath`
- `crystal_lamp`
- `mini_aquarium`
- `campfire_pillow`
- `cloud_shelf`

理由：

- 这批更偏活动感、世界观联动感和季节感。
- 在基础视觉稳定后上线，更容易让用户感知“新主题更新”。

## 9. 最终建议

- 第一批先做 4 张背景 + 6 件核心装饰 PNG，优先解决“小屋是否像家”。
- 第二批再补 4 张强主题背景和 8 件主题装饰，形成“可运营、可轮换、可联动”的视觉资产池。
- 提示词层面必须坚持一个统一母版，只替换主题关键词；不要让每张图都换画风。
- 背景图的目标不是比 `scenes-vn` 更戏剧化，而是成为承接宠物、状态条、家具叠层的稳定舞台。
