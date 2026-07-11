# 单词记忆射击场原型

这是根据 [G:\StudyCode\宠物积分系统\docs\打字游戏方案\单词记忆小游戏.md](G:/StudyCode/宠物积分系统/docs/打字游戏方案/单词记忆小游戏.md) 重做的单词记忆小游戏。当前保留两个入口：默认是 **俯视地图版**，也保留了旧版“上方单词、下方炮弹”的 **经典炮弹模式**。

活动词卡由根目录 `data/vocab/word-memory-combined/views/all.json` 的合并词库生成，已纳入原 Minecraft 词库和复制进来的 `Mario_Minecraft/words-0315/vocabs` English packs。俯视地图版现在默认使用用户提供的 **小男孩像素主角**，原先的铁傀儡保留为第二套可选角色；经典炮弹模式复用同一套词卡，顶部显示英文目标，底部显示中文炮弹，适合保留原先的轻量射击节奏。

## 原型入口

- 页面：[G:\StudyCode\宠物积分系统\prj\单词记忆射击场原型\index.html](G:/StudyCode/宠物积分系统/prj/单词记忆射击场原型/index.html)
- 样式：[G:\StudyCode\宠物积分系统\prj\单词记忆射击场原型\styles.css](G:/StudyCode/宠物积分系统/prj/单词记忆射击场原型/styles.css)
- 逻辑：[G:\StudyCode\宠物积分系统\prj\单词记忆射击场原型\game.js](G:/StudyCode/宠物积分系统/prj/单词记忆射击场原型/game.js)
- 根词库：[G:\StudyCode\宠物积分系统\data\vocab\word-memory-combined\views\all.json](G:/StudyCode/宠物积分系统/data/vocab/word-memory-combined/views/all.json)
- 数据：[G:\StudyCode\宠物积分系统\prj\单词记忆射击场原型\assets\word-memory-cards.json](G:/StudyCode/宠物积分系统/prj/单词记忆射击场原型/assets/word-memory-cards.json)
- 数据生成：[G:\StudyCode\宠物积分系统\prj\单词记忆射击场原型\scripts\build_word_memory_cards_from_minecraft.cjs](G:/StudyCode/宠物积分系统/prj/单词记忆射击场原型/scripts/build_word_memory_cards_from_minecraft.cjs)
- 验证：[G:\StudyCode\宠物积分系统\prj\单词记忆射击场原型\verify.mjs](G:/StudyCode/宠物积分系统/prj/单词记忆射击场原型/verify.mjs)

静态访问地址：

```text
http://127.0.0.1:8000/prj/%E5%8D%95%E8%AF%8D%E8%AE%B0%E5%BF%86%E5%B0%84%E5%87%BB%E5%9C%BA%E5%8E%9F%E5%9E%8B/index.html
```

## 当前玩法

一局会从合并后的 3322 个英文词里抽取 27 个词以内，按 `3x3` 大地图拆成最多 `9` 个小地图块：

1. 孩子用 `WASD / 方向键` 在地图上移动铁傀儡
2. 英文目标会朝主角移动，靠太近会攻击并扣护盾
3. 孩子点击黑色中文炸弹，主角立即拿到当前义项
4. 拿到炸弹后点击英文目标，炸弹会自动索敌攻击；`空格 / Enter` 仍保留为按主角面朝方向扔出
5. 炸弹飞行时能看到轨迹，碰到英文目标会爆炸；配对正确就消掉目标并点亮星星，清空当前区后继续探索同一张大地图的其他区域

这版重点是：

- 进入游戏时可以先选角色，当前提供 `小男孩 / 铁傀儡` 两套主角
- 俯视地图上移动，而不是在面板里点卡片
- 农场与海洋主题均使用 `3x3` 连贯地图块，拼成真正可探索的大地图；海洋关会加载珊瑚码头、中央泻湖与深蓝回环九个区域
- 新增 `关` 按钮和关卡面板，当前先做 `6` 关自动升级路线
- 通关后会写入 `localStorage.word-memory-highest-level`，结算页出现 `下一关`
- 右上角当前中文球旁新增 `?` 提示按钮，可查看当前词的英文、中文、图片并播放发音
- 答对后会弹出短暂的“记住这个”强化卡，显示英文和中文；答错时提示正确英文含义
- 左下本图任务条会预告当前地图块的 3 个重点词，答对后对应词条打勾
- 左下重点词条也可以直接点击，快速打开提示卡并播放英文，适合先预习再开打
- 主角和镜头会一起移动，走到不同地图块时会看到不同背景和该区词汇
- 中文炸弹散在地图上，点击即可拾取，减少低龄操作负担
- 英文词挂在小怪头顶，而不是做大卡片
- 键盘投掷按主角面朝方向直线飞行；点击敌人会自动索敌攻击
- 轻 HUD，只保留星星、进度、当前中文炸弹
- 新增护盾 HUD，敌人追上主角会扣护盾，护盾归零时本图拉开距离重新来
- 正常游玩时不再手动切主题或跳图块，而是在同一张大地图里自然探索；主题切换和跳图只保留给调试
- 命中特效、尘土、标签皮肤、围栏/花丛/木牌等装饰都来自已发布的透明 PNG 资产包
- 主角已经有 `上 / 下 / 左 / 右` 方向站立与移动图，右向不再只是镜像左向
- 发射炸弹时会切到专门的施法动作帧，拿到炸弹后也会跟随主角移动
- 角色动画已经做了落地修正：走路、待机、施法都会保留底部锚点，脚下影子也会跟着步伐变化，减少“悬浮感”
- 开始移动和持续走路时会补轻量尘土脚步，地图里更容易看出“真的在走”
- 角色选择会记住上次结果，刷新页面后仍会默认高亮上一次用过的角色
- 地图里现在会继续掉落轻量支援道具，当前先做三种：
  - `补盾叶`：帮主角挡一次敌人撞击
  - `减速钟`：让敌人短时间追得更慢
  - `瞄准星`：接下来几发炸弹会自动修正到正确英文目标
- 又补了三种偏功能型支援：
  - `加速鞋`：短时间提升移动速度
  - `词卡提示`：接下来几次 `?` 提示会额外显示英文首字母
  - `连击加成`：下一次答对会额外补 1 点护盾
- 这些支援道具不替代中文炸弹主流程，而是作为答对后的额外奖励，拾取后直接生效，右上角会显示当前还在生效的支援状态

点击 HUD 里的 `⇄` 可以切换到经典炮弹模式：

1. 上方显示三个英文目标
2. 下方显示三个中文炮弹
3. 先点下方中文炮弹装填，再点上方英文目标发射
4. 正确配对会消掉目标并点亮星星，错误时炮弹保留，可以继续换目标
- 走路节奏现在是三拍：`walk_a -> idle 过渡 -> walk_b`，比原先两帧来回更顺，也更像真实迈步
- 主角待机和走路动画已经降低上下位移，减少“晃”和“悬浮”的感觉
- HUD 里新增本图任务条和连对提示，孩子能更直观看到“这张图还差几个”和“连续答对了几次”
- 结算页现在会显示命中率、最长连对和奖励徽章，比原来更像一局完整任务

## 关卡路线

当前关卡先保持轻量：每关只改变词数、主题、分类、护盾和敌人速度，不引入复杂规则。

| 关卡 | 标题 | 地图 | 分类 | 词数 | 护盾 | 节奏 |
| --- | --- | --- | --- | ---: | ---: | --- |
| 1 | 农场热身 | 农场 | 动物 | 3 | 3 | 慢 |
| 2 | 动物追击 | 农场 | 动物 | 6 | 3 | 稍快 |
| 3 | 森林找词 | 森林 | 自然 | 9 | 3 | 标准 |
| 4 | 草地补给 | 草原 | 食物 | 12 | 3 | 稍快 |
| 5 | 海边巡航 | 海洋（珊瑚 9 宫格） | 场景 | 15 | 2 | 快 |
| 6 | 太空挑战 | 太空 | Minecraft | 18 | 2 | 更快 |

规则：

- 首次进入默认解锁第 `1` 关
- 每一关是一张可探索的大地图，里面会拆成多个区域
- 只有清空当前大地图上的全部英文目标后，才会自动解锁下一关
- 结算页的 `下一关` 会直接切到下一关并重新抽词
- 已解锁关卡可以从左上关卡面板重新进入
- 手动切换地图主题不是正常玩家流程，默认仅作为调试能力保留
- 进度只存在浏览器本地，不影响根词库和正式学习中心

## 控制方式

- `WASD / 方向键`：移动
- `点击中文炸弹`：拿到当前义项
- `点击英文目标`：当前炸弹自动索敌攻击
- `空格 / Enter`：朝主角面朝方向扔出当前炸弹
- `Tab`：切换当前高亮目标
- `R`：朗读当前场上的英文词
- 中文炸弹拾取、答对英文词、`R` / `♪` 朗读，统一走同一条语音链路：优先播放原型目录里的本地 mp3；缺词时可接 `prj/tts` 实时服务；再缺才退回浏览器语音

## 资源说明

- 当前主角系统已经改成双角色配置：
  - 默认小男孩：`boy_down_idle / boy_up_idle / boy_side_idle / boy_right_idle / boy_cast / boy_cast_right`
  - 第二角色铁傀儡：`guardian_down_idle / guardian_up_idle / guardian_side_idle / guardian_right_idle / guardian_cast / guardian_cast_right`
- 小男孩主角来自用户提供的多角度像素参考图，透明帧由下面的脚本切出：
  - `scripts/extract_boy_hero_frames.py`
  - 输出目录：`assets/generated/hero-boy-assets/`
- CSS 动作层使用 `hero-idle-breathe / hero-walk-step / hero-cast-pop` 与影子动画配合，避免覆盖角色原本的居中定位
- 当前活动词卡来自根目录游戏词库 `data/vocab/word-memory-combined/views/all.json`
- 正式 Minecraft 主仓和复制的外部 `vocabs` 目录只作为合并词库同步来源，不是页面运行依赖
- 适配脚本会生成：
  - `assets/word-memory-cards.json`
  - `assets/generated/minecraft-memory-adapter/minecraft-word-memory-cards.json`
  - `assets/generated/minecraft-memory-adapter/manifest.json`
- 场上目标图优先级：
  - 本地 Minecraft 透明图或宠物姿态图，例如 `creeper_idle.png`、`mc_cat_idle.webp`
  - 词卡自带图片，例如 `assets/learn/english-vocab/*.webp`
  - 在线概念图或 Wiki 图直接加载，失败时自动退回本地 fallback
  - 现有农场目标图，例如 `enemy_pig / enemy_sheep / enemy_chicken`
- 炸弹球、标签、命中特效和部分动物目标继续来自 `assets/generated/topdown-farm-assets/`
- 当前词汇语音资源来自 `assets/voice/`，已生成的词会优先播放本地 mp3；大词库里未生成 mp3 的词会退回浏览器语音
- 世界背景已经接入：
  - `assets/背景图片/背景图1--农场--9连图.png`
  - `assets/背景图片/01.png` 到 `assets/背景图片/09.png`
  - `assets/generated/world-bg-tiles/farm-9grid-manifest.json`
  - `assets/generated/world-bg-tiles/farm-9grid/farm_tile_r*_c*.png`
- 并行预览中的农场 GPT 版本：
  - `assets/generated/world-bg-tiles/farm-gpt-9grid-manifest.json`
  - `assets/generated/world-bg-tiles/farm-gpt-9grid/farm_tile_r*_c*.png`
  - 当前已经切成第 `1-2` 关默认农场地图；旧版农场仍保留在主题下拉里作为经典备选
  - 一键生成或导入并裁切：

```text
python G:\StudyCode\宠物积分系统\prj\单词记忆射击场原型\scripts\generate_farm_gpt_9grid.py
python G:\StudyCode\宠物积分系统\prj\单词记忆射击场原型\scripts\generate_farm_gpt_9grid.py --source G:\StudyCode\宠物积分系统\prj\单词记忆射击场原型\assets\背景图片\背景图1--农场--9连图.png
```
- 当前农场地图背景接入说明：
  - 运行时优先读取 `assets/背景图片/01.png` 到 `assets/背景图片/09.png`
  - `07-09` 当前可以先用本地占位或 Agnes 试跑图顶住
  - 一旦 GPT 精修版到位，把最终选中的 `07.png / 08.png / 09.png` 放进：
    - `assets/generated/reference/farm-widescreen-gpt-row3/`
  - 然后运行：

```text
python G:\StudyCode\宠物积分系统\prj\单词记忆射击场原型\scripts\import_farm_row3_widescreen.py
```

  - 这条命令会把选中的 `07-09` 同步到正式运行目录 `assets/背景图片/`
- 世界主题包注册已经接好，当前都走统一 `3x3` manifest 入口；正常玩法由关卡自动决定主题：
  - `assets/generated/world-bg-tiles/forest-9grid-manifest.json`
  - `assets/generated/world-bg-tiles/grassland-9grid-manifest.json`
  - `assets/generated/world-bg-tiles/ocean-9grid-manifest.json`
  - `assets/generated/world-bg-tiles/sky-9grid-manifest.json`
  - `assets/generated/world-bg-tiles/space-9grid-manifest.json`
  - `assets/generated/world-bg-tiles/alien-9grid-manifest.json`
- 这些新增主题当前先复用农场切片做稳定回退，等 Agnes 多场景稿跑出来后，直接替换各自 manifest 指向的 `9` 连图切片即可
- 三种支援道具现在也有独立小图标素材：
  - `assets/generated/topdown-farm-assets/support_shield_leaf.png`
  - `assets/generated/topdown-farm-assets/support_slow_clock.png`
  - `assets/generated/topdown-farm-assets/support_auto_star.png`
  - `assets/generated/topdown-farm-assets/support_speed_boots.png`
  - `assets/generated/topdown-farm-assets/support_hint_card.png`
  - `assets/generated/topdown-farm-assets/support_combo_badge.png`
  - 生成脚本：`scripts/generate_support_item_icons.py`
- `space` 主题已经单独准备了 GPT 生图目录和 prompt 包：
  - `assets/generated/reference/space-gpt-worlds/README.md`
  - `assets/generated/reference/space-gpt-worlds/prompts.md`
- `space` 主题现在已经接入第一批 4 张正式太空背景图：
  - `assets/背景图--太空/space-hub-01.png`
  - `assets/背景图--太空/space-garden-02.png`
  - `assets/背景图--太空/space-cargo-03.png`
  - `assets/背景图--太空/space-runway-04.png`
  - 运行时复制入口：`assets/generated/world-bg-tiles/space-pack/`
  - 当前 `space-9grid-manifest.json` 使用 4 张真图做 3x3 关卡块复用，不再回退农场切片
- 这条 `space` 生图链使用独立的生图环境变量，不和对话模型 key 混用：
  - `IMAGE_API_KEY`
  - `IMAGE_BASE_URL`
  - `IMAGE_MODEL`
- 中文和英文文字继续保留在 HTML，不烧进图片
- 当前词汇集是 3322 个合并英文词，覆盖幼儿园、小学、初中和 Minecraft 主题；完整词表见 `data/vocab/word-memory-combined/views/all.json`，示例包括 `smile / ability / creeper / diamond / zombie / granite / lava / compass / mushroom / snowball / anvil`
- 农场词汇视觉集仍作为动物目标和地图素材保留，所以 README 和验证里仍会提到 farm asset pack

## 本地语音

- 语音映射：`[G:\\StudyCode\\宠物积分系统\\prj\\单词记忆射击场原型\\assets\\voice\\map.json](G:/StudyCode/宠物积分系统/prj/单词记忆射击场原型/assets/voice/map.json)`
- 生成脚本：`[G:\\StudyCode\\宠物积分系统\\prj\\单词记忆射击场原型\\generate_voice_assets.py](G:/StudyCode/宠物积分系统/prj/单词记忆射击场原型/generate_voice_assets.py)`
- 共享工作流：`[G:\\StudyCode\\宠物积分系统\\prj\\prototype-voice-workflow\\generate_prototype_voice_assets.py](G:/StudyCode/宠物积分系统/prj/prototype-voice-workflow/generate_prototype_voice_assets.py)`

当前原型已经内置 191 条本地词汇语音，覆盖已生成的 Minecraft 基础词和去重后的中文义项；其余外部词可以继续走统一 TTS 服务，再由浏览器语音兜底：

- 英文示例：`creeper / diamond / pickaxe / block / cow / bedrock / lava / compass / snowball / anvil`
- 中文示例：`苦力怕 / 钻石 / 镐 / 方块 / 牛 / 基岩 / 熔岩 / 指南针 / 雪球 / 铁砧`
- 完整映射见 `assets/voice/map.json`

重新生成方法，默认使用根目录游戏词库：

```text
node G:\StudyCode\宠物积分系统\prj\单词记忆射击场原型\scripts\build_word_memory_cards_from_minecraft.cjs
```

如果要先从正式 Minecraft 主仓刷新根词库，再重建词卡：

```text
node G:\StudyCode\宠物积分系统\prj\单词记忆射击场原型\scripts\build_word_memory_cards_from_minecraft.cjs --sync-source
```

再生成本地语音：

```text
python G:\StudyCode\宠物积分系统\prj\单词记忆射击场原型\generate_voice_assets.py
```

或直接走共享工作流：

```text
python G:\StudyCode\宠物积分系统\prj\prototype-voice-workflow\generate_prototype_voice_assets.py --source word-memory-topdown
```

说明：

- 页面会先查 `./assets/voice/map.json`
- 命中后播放 `./assets/voice/<md5>.mp3`
- 没命中时，会先尝试可选的实时 TTS endpoint，再退回浏览器 `speechSynthesis`
- 本地开发访问 `127.0.0.1 / localhost` 时，页面默认会尝试 `http://127.0.0.1:9885/tts`
- 远端 TTS 超过约 `2.4` 秒还没返回时，会自动退回浏览器语音，避免提示音把页面卡住
- `R` 或 `♪` 会顺序朗读当前仍在场上的英文词
- `?` 提示按钮会显示当前选中中文炸弹对应的英文词；未拿炸弹时会提示当前地图的一个重点词

如果要接统一实时语音服务，可以在页面加载前挂一个全局配置，直接复用 `prj/tts`：

```html
<script>
  window.WORD_MEMORY_TTS_ENDPOINT = 'http://127.0.0.1:9885/tts';
  window.WORD_MEMORY_TTS_VOICE = 'child';
  window.WORD_MEMORY_TTS_ENGINE = 'auto';
</script>
```

推荐链路：

1. 本地静态 mp3：零延迟，适合高频基础词
2. `prj/tts`：统一承接中文和英文，服务端内部再走 `VoxCPM2 -> edge-tts`
3. 浏览器 `speechSynthesis`：离线兜底，不会卡死页面

## 后续迭代

1. 继续补更多 `9` 连图背景稿，把大地图主题从单一农场扩展到 Minecraft / 科幻 / 校园等风格
2. 优先使用 `assets/generated/reference/topdown-world-pack-prompts.md` 里的 Agnes prompt 批量生成森林、草原、海洋、天空、太空、外星球参考图与 `9` 连图
3. 再补一套更丰富的多元素爆炸图，区分命中、错误、连击、通关奖励
4. 把当前 `prototype-voice-workflow` 进一步归并到 `prj/tts`，让提示音和词汇语音共用一条生成入口
5. 增加更接近打字训练的第二阶段玩法：首字母提示、单词补全、听音选词、句型填空
