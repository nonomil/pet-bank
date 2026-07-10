# 学习机玩法原型

这是一个面向幼小衔接孩子的键盘小游戏原型，用来验证“蓝牙键盘 + 图片/声音/汉字题库 + 即时奖励”是否能比普通打字课更容易坚持。

当前原型不接入主项目路由，只放在 `prj/学习机玩法原型/` 下独立运行。内容和代码永远分开放：游戏卡片、参考来源和玩法说明放在 `assets/generated/learning-games-content.json`，玩法逻辑只读取数据并渲染。

## 原型入口

- 页面：[index.html](./index.html)
- 样式：[styles.css](./styles.css)
- 逻辑：[game.js](./game.js)
- 内容配置：[assets/generated/learning-games-content.json](./assets/generated/learning-games-content.json)
- 美术参考提示词：[assets/generated/game-art-prompts.md](./assets/generated/game-art-prompts.md)
- 单词射击科幻提示词：[assets/generated/reference/word-shooter-scifi-prompts.md](./assets/generated/reference/word-shooter-scifi-prompts.md)
- 验证脚本：[verify.mjs](./verify.mjs)
- 全量冒烟脚本：[scripts/test-full-prototype-smoke.mjs](./scripts/test-full-prototype-smoke.mjs)
- 结算返回主页回归：[scripts/test-round-summary-home.mjs](./scripts/test-round-summary-home.mjs)
- 重开提示复位回归：[scripts/test-replay-feedback-reset.mjs](./scripts/test-replay-feedback-reset.mjs)
- 外部 Minecraft 单词库同步脚本：[scripts/sync_external_minecraft_vocab.cjs](./scripts/sync_external_minecraft_vocab.cjs)
- 验证记录：[验证报告.md](./验证报告.md)
- 贪吃蛇调研与合入方案：[贪吃蛇调研与合入方案.md](./贪吃蛇调研与合入方案.md)
- 贪吃蛇参考图提示词：[assets/generated/reference/pinyin-snake-reference-prompts.md](./assets/generated/reference/pinyin-snake-reference-prompts.md)
- 拼音炮台设计方法：[大炮打单词设计方法.md](./大炮打单词设计方法.md)
- 学习性与游戏性平衡方案：[学习性与游戏性平衡方案.md](./学习性与游戏性平衡方案.md)
- 游戏根词库打字视图：[../../data/vocab/english-minecraft/views/typing-view.json](../../data/vocab/english-minecraft/views/typing-view.json)
- 兼容扩展词包：[assets/generated/minecraft-typing-expanded.json](./assets/generated/minecraft-typing-expanded.json)
- 直接打开 HTML 的词库兜底脚本：[assets/generated/minecraft-typing-expanded.js](./assets/generated/minecraft-typing-expanded.js)
- 兼容扩展词包导出脚本：[scripts/build_minecraft_typing_pack.cjs](./scripts/build_minecraft_typing_pack.cjs)

静态服务器运行时访问：

```text
http://127.0.0.1:8000/prj/%E5%AD%A6%E4%B9%A0%E6%9C%BA%E7%8E%A9%E6%B3%95%E5%8E%9F%E5%9E%8B/index.html
```

本地自动回归常用命令：

```bash
node "prj\学习机玩法原型\verify.mjs"
node "prj\学习机玩法原型\scripts\test-full-prototype-smoke.mjs"
node "prj\学习机玩法原型\scripts\test-local-file-vocab-fallback.mjs"
node "prj\学习机玩法原型\scripts\test-round-summary-home.mjs"
node "prj\学习机玩法原型\scripts\test-replay-feedback-reset.mjs"
```

## 当前结构

首页只保留三张大卡片，不再使用顶部 tab。点击卡片后打开固定覆盖层游戏窗口，主页留在背后，不再把游戏内容排到卡片下方。游戏窗口左上角只有一个返回主页按钮，减少孩子在横屏操作时误点。

| 游戏 | 输入 | 目标 |
|---|---|---|
| 飞机大战 | 小写字母键 | 参考 Typing Attack 的科幻打字射击：左侧飞船、右侧敌方战机编队推进、首字母锁定目标、每个字母发射一次、击毁后随机掉落武器道具 |
| 拼音赛车 | 小写字母键 | 看路牌汉字打拼音：赛道上出现汉字路牌，每个拼音字母让小车加速，完整拼音通过路牌并点亮反馈 |
| 贪吃蛇 | 方向键 | 看汉字和拼音，控制蛇按顺序吃拼音块，拼完点亮星星 |

给用户设计最低门槛的输入方式：飞机大战和拼音赛车只按字母，贪吃蛇只按方向键。备用屏幕键盘只作为低门槛兜底。

## 素材来源

- Minecraft 英语网页沉淀的词卡图片、英文 mp3 和 `minecraft-vocab.json`
- 游戏根词库继续提供 `data/vocab/english-minecraft/views/typing-view.json`，作为正式主仓的官方 92 词副本保留
- 根词库 `typing-view.json` 由正式主仓 `data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab-typing-view.json` 通过 `scripts/sync_vocab_registry.cjs` 同步，保持官方 92 词副本
- `scripts/sync_external_minecraft_vocab.cjs` 现在从正式分级词库 `data/vocab/单词库_分级/` 导出原型自己的兼容扩展包 `assets/generated/minecraft-typing-expanded.json`，不再覆盖根游戏词库
- `word-shooter` 运行时已经切到 `assets/generated/minecraft-typing-expanded.json`，默认使用 Minecraft 词库，也可以在游戏内切换 `Minecraft / 幼儿园 / 小学 / 初中 / 全部英文`
- 当前同步结果共 3212 张英文打字卡：Minecraft 514、幼儿园 557、小学 558、初中 1583、全部英文 3212；难度分层为基础 1391、进阶 604、完整 1217
- `G:\UserCode\minecraft_words\minecraft_words_apk-main` 的 Minecraft 词库与图片引用，当前通过正式主仓统一筛选，不再让原型自己独立维护一套规则
- 拼音赛车和拼音贪吃蛇继续复用 `data/hanzi-questions.json` 里的完整 30 条汉字与拼音数据，运行时不再只截取前 12 条；避免把英文单词和拼音混在同一个目标池里
- `data/hanzi-hsk.json` 目前有 584 条 HSK 词/填空数据，但对 6 岁孩子偏难，暂不直接混入基础拼音赛车和贪吃蛇；后续可作为“进阶拼音包/词组包”单独开关
- 汉字语音提示复用 `prj/拼音块收集台原型/assets/voice/` 的共享语音包，优先走本地语音 mp3，浏览器不可播时再回退到 Web Speech
- 中文发音建议继续走 `prj/prototype-voice-workflow/generate_prototype_voice_assets.py` 的 EdgeTTS 批量生成流程：提前生成本地 mp3，游戏运行时只播放本地文件；当前阶段没必要引入 CosyVoice/本地大模型 TTS，除非后面要统一角色音色、离线生成大量长句或做更强的情感配音
- Agnes/GPT 生成的舞台背景和三张首页游戏选项卡，用于先验证儿童游戏美术方向；图片不内嵌文字，中文标题和说明仍由 HTML/JSON 渲染
- 2026-07-08 单词射击已切换到 ChatGPT 网页生图 + 本仓库 pipeline 产出的 `assets/generated/word-shooter-scifi-assets/` 科幻透明 PNG 资产包；旧 `word-shooter-assets/` 保留为早期儿童版参考
- `game-art-prompts.md` 记录三款游戏的 Agnes/GPT 生图提示词，后续可以替换成正式 bitmap 素材

## 参考来源

- 指尖碎裂 Demo：保留“按键发射、弹道、碎裂反馈”的手感
- Typing Attack：[typinggames.zone/typingattack](https://www.typinggames.zone/typingattack)，参考“多目标推进、首字母锁定、每个字母发射一次、目标击毁后清屏反馈”
- 拼音赛车：替代原拼音炮台方向，保留“看汉字、打拼音、每个字母立刻反馈”的输入逻辑，但把外壳改成赛道、小车、汉字路牌和加速反馈
- Snake / 贪吃蛇：保留“蛇头持续前进、吃食物变长、方向键控制”的核心识别点；调研与合入路线见 [贪吃蛇调研与合入方案.md](./贪吃蛇调研与合入方案.md)
- 2026-07-09 贪吃蛇按用户参考图复刻为浅色网格舞台：圆润长蛇、彩色圆点食物、目标食物浮动 `[拼音块]` 标签、左上角长度/星星统计；游戏台改为全屏铺满式舞台，横屏和竖屏都保持棋盘占主要视觉区域；Agnes 参考图保存在 `assets/generated/reference/pinyin-snake-reference-agnes.png`
- TypingGames、edclub、打字鸭：参考低门槛入口、课程卡片和游戏式反馈，不直接嵌入第三方站点
- 金山打字通、TypingMaster、TypingClub、Star Rune：参考“移动目标、短局、连击、每次按键反馈”的打字游戏机制；调研文档见 `../学习机游戏方案设计/06-打字游戏调研与汉字跑酷方案.md`

## 当前飞机大战状态

`word-shooter` 已不再使用最初的可爱炮台版，而是升级为偏科幻、偏 Typing Attack 的推进式射击关卡：

- 左侧是科幻拦截机，右侧同时推进 3 到 4 架带英文单词标签的敌方战机
- 用户按下首字母后锁定一个目标，必须连续完成该词
- 每输入一个正确字母就发射一次武器
- 完整击毁目标后有概率掉落 `Triple Beam`、`Homing Missile`、`Pierce Laser`
- 道具被飞船接到后会短时替换默认 `Pulse Laser`
- 浏览器烟测截图保存在 `assets/generated/reference/word-shooter-scifi-playtest.png`
- 词库读取已经收口到原型自己的 `assets/generated/minecraft-typing-expanded.json`，根目录 `data/vocab/english-minecraft/views/typing-view.json` 只作为正式词库副本保留，不再直接依赖 `data/learn/packs/**/modules`
- HUD 下方有词库包切换按钮，可以选择 `Minecraft / 幼儿园 / 小学 / 初中 / 全部英文`；切换后会重新开一局并从对应词库抽敌机单词
- 词库按钮会直接显示当前包的词数，HUD 状态徽章也会显示类似 `幼儿园 557词`，方便确认切换已经生效
- 词库包和难度会保存到浏览器本地设置，下次打开仍沿用上次选择；旁边有 `恢复默认` 按钮，可一键回到 `Minecraft + 基础`；如果浏览器禁用本地存储，则自动退回默认 `Minecraft + 基础`
- 难度会同时影响词池和节奏：基础档 8 词/最多 2 架敌机/慢速推进，进阶档 10 词/最多 3 架敌机，完整档 12 词/最多 4 架敌机/略快推进
- 飞机大战不再因为漏掉敌机提示结束；只有敌机真正撞到左侧我方战机时才爆炸失败，平时继续刷下一架
- 每局会从当前词库和难度词池里洗牌抽词，切到 `幼儿园 / 小学 / 初中` 后会看到对应词库的新单词，不再总是数组前几个词
- 难度切换按钮下方有 HUD 状态徽章，显示 `基础训练 / 进阶战斗 / 完整挑战` 和当前词数、敌机数、速度感
- 切换难度时状态徽章会短暂发光，并在声音开启时播放轻提示音，形成即时反馈
- 通关结算会按难度发原型奖励：金币、星星、进阶/完整档钻石，以及 `激光炮芯片 / 导弹蓝图 / 弓箭矩阵` 等武器升级道具

## 当前拼音赛车状态

`word-cannon` 内部复用原来的拼音输入生命周期，但外观已经改成拼音赛车，和飞机大战的英文单词池明确分开：

- 中间是纵深赛道，底部是一辆 CSS 小车，上方慢速出现汉字路牌
- 按汉字对应拼音的每个字母时，小车会加速、发光并产生速度线
- 输入完整拼音后小车通过路牌，生成冲刺反馈、碎片和计分弹窗
- 路牌推进速度刻意放慢，避免画面抖动和压迫感过强
- 难度会影响一局长度、可见目标数和下落速度：基础档 8 个拼音/2 个目标，进阶档 16 个拼音/3 个目标，完整档 24 个拼音/4 个目标
- 基础档高容错，目标压线不会很快结束；进阶和完整档才逐步保留压线压力
- 难度切换按钮下方有 HUD 状态徽章，显示当前挑战身份和 `拼音数 / 目标数 / 速度感`
- 切换难度时状态徽章会短暂发光，并在声音开启时播放轻提示音，提示新节奏已经生效
- 通关结算会按难度发原型奖励：金币、星星、进阶/完整档钻石，以及 `轮胎升级 / 氮气加速 / 星核引擎` 等赛车升级道具
- 完整档按 6 个拼音自动切换一张 Agnes 科幻地图：金属走廊、太空机库、未来训练场、熔炉工业区；基础和进阶档会按更短阶段目标切换地图
- 路牌、小车和赛道视觉统一缩小，给中间移动区域留出更多可见空间

## 后续合入建议

1. 先让孩子横屏实际玩 10 分钟，观察是否愿意继续敲键。
2. 如果英语线有效，把 `word-shooter` 合入正式 Minecraft 英语学习入口。
3. 如果拼音线有效，把 `word-cannon` 和 `pinyin-snake` 合入汉字/拼音游乐场。
4. 正式合入时复用现有学习进度系统，不新增第二套积分/进度。
