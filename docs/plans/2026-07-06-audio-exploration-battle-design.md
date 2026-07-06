# 声音演出与探索对战反馈优化方案

**日期：** 2026-07-06  
**范围：** 语音模块、探索对话故事、游戏音效、宠物对战、探索中的对战、美术与动效反馈  
**目标：** 在不推翻现有探索和战斗架构的前提下，把“听见、看见、点了有回应”补成稳定闭环。

---

## 1. 现状判断

语音模块已经完成一次探索地图更新后的全量再生成，当前运行方式是 `assets/voice/map.json` 文本映射到本地 mp3，由 `js/voice.js` 监听 `#galgameText` 自动播放。这个方案离线稳定、可控，适合儿童使用场景。后续语音优化不应回到运行时 TTS，而应围绕“文本稳定 ID、打字机同步、跳过/重播体验”展开。

音效模块目前集中在 `js/sfx.js`，只有 `click`、`hit`、`coin`、`levelup`、`error`、`notice` 六个通用音效。`assets/audio/sfx` 目录存在但为空，实际主要依赖 ZzFX 合成声。问题不是没有声音，而是声音语义不够细：探索发现、答题正确、答题错误、遭遇警告、战斗开始、技能释放、道具使用、胜负结算都在复用少数声音，玩家很难形成“听觉记忆”。

探索故事由 `data/stories/*.json` 数据驱动，每个场景结构稳定，通常包含叙述、发现、数学题、选择、遭遇五段。这个模型维护成本低，但节奏会偏整齐。当前最佳优化点是给不同事件类型增加声音和视觉状态，而不是立刻重构故事数据模型。

宠物探索战斗已经有竞技场背景、双方形象、血条、伤害数字、浮动日志、技能和道具快捷栏。`css/style.css` 已有 `battle-hit`、`battle-flash-red` 等动画样式，`js/app.js` 也有 `battle-animate` 监听函数，但当前没有稳定的派发链路，所以部分动画存在“写了但没响”的风险。

---

## 2. 设计原则

第一优先级是反馈闭环：玩家点击、答题、发现、遇敌、攻击、受击、胜利和失败，都应有一条清楚的“声音 + 视觉 + 文案”反馈。反馈不追求炫，而追求可辨认、短促、温暖，避免长音效遮住语音。

第二优先级是保留现有架构：语音继续由 `voice.js` 管理，音效由 `sfx.js` 管理，探索故事继续由 `exploration-detail.js` 展示，战斗计算继续留在 `exploration.js` 和 `battle-engine.js`。本次只补事件 API 和调用点，不引入大型音频引擎。

第三优先级是可替换资产：当前可以继续用 ZzFX 作为默认音效，但每个语义化音效都应有对应 mp3 路径。以后只要把真实音效文件放进 `assets/audio/sfx`，代码不需要再改。真实 mp3 应优先播放，ZzFX 作为缺文件或加载失败时的兜底。

第四优先级是儿童友好：音效短、音量默认克制、可以在 UI 中开关和调节；动效要尊重 `prefers-reduced-motion`，避免无限闪烁和过度震动。

---

## 3. P0 执行方案：音效与战斗反馈闭环

本阶段先扩展 `sfx.js` 为语义化音效系统。保留旧 API，新增 `dialogueNext`、`discover`、`mathCorrect`、`mathWrong`、`choiceConfirm`、`encounterWarning`、`battleStart`、`playerAttack`、`enemyAttack`、`skillCast`、`defend`、`itemUse`、`battleWin`、`battleLose`，并新增通用 `sfx.play(name)`。这样旧代码不会坏，新代码可以逐步接入更细颗粒度的声音。

探索侧在 `exploration-detail.js` 接入音效：点击推进播放 `dialogueNext`，发现事件播放 `discover`，选项确认播放 `choiceConfirm`，数学题答对/答错分别播放 `mathCorrect` / `mathWrong`，遭遇战前播放 `encounterWarning`，进入战斗播放 `battleStart`。这些声音应短于 700ms，避免和语音抢占。

战斗侧在 `exploration.js` 里派发语义化事件：战斗开始、玩家攻击、技能、防御、道具、敌人反击、胜利、失败。`app.js` 负责接收 `battle-animate`，驱动已有 `battle-hit` 和 `battle-flash-red` 动画，同时播放对应音效。为了避免监听丢事件，监听应在战斗 UI 创建时注册，而不是在一次 `updateBattleUI` 之后才注册一次。

设置侧新增音效设置卡片：和语音设置一样挂到 `.profile-panel`，提供启用/静音、音量滑块和测试按钮。这样孩子或家长可以快速把音效调小，而不是只能通过 localStorage 控制。

---

## 4. P1 后续方案：探索 galgame 演出

探索页已经具备背景、左右立绘和底部对话框，适合继续往轻视觉小说方向推进。下一阶段建议增加打字机文本、点击跳过、语音重播按钮状态同步、当前说话人高亮、非说话人轻微变暗。这样能把“自动语音”从单纯播报变成叙事演出的一部分。

事件视觉建议保持克制：发现事件加短闪光和奖励粒子，数学题卡片加柔和绿光，遭遇事件加红橙色脉冲，选择项确认后保留选中的按钮高亮 200ms 再进入结果。不要给所有元素持续动画，避免儿童长时间使用时疲劳。

故事结构可以暂时不改，但可以逐步给事件增加可选字段，例如 `speaker`、`tone`、`sfx`、`portraitState`、`visualCue`。若字段不存在，继续按当前规则渲染。这样未来可以从“统一五段式”平滑升级到“有角色状态的事件流”。

---

## 5. P2 后续方案：美术与战斗表现

美术资产目前较完整：`assets/scenes` 有 12 张场景背景，`assets/characters` 有对应角色立绘，`assets/monsters` 有怪物图，`assets/arena` 有竞技场背景。短板不是缺基础图，而是状态使用不充分。

探索战斗建议定位为“故事遭遇战”：节奏短、反馈明确、结算快。可以使用宠物前冲、怪物受击抖动、敌人反击红闪、胜利暖光、失败暗角这类低成本动效。卡牌竞技场则可以另走更战术化的 UI，不必和探索战斗完全一样。

后续如果补真实音效资产，建议先做一套轻量 UI/gameplay sound pack：按钮、发现、正确、错误、遭遇、普攻、受击、技能、胜利、失败。环境声和 BGM 暂不作为 P0，因为它们更容易遮挡语音，也更容易带来循环播放和移动端自动播放限制问题。

---

## 6. 验收标准

- `sfx.js` 保留旧 API，并提供新增语义化 API 与 `play(name)`。
- 没有真实 mp3 时，所有新增音效仍可通过 ZzFX 兜底播放。
- 如果未来加入 `assets/audio/sfx/*.mp3`，真实 mp3 优先于 ZzFX。
- 探索对话推进、发现、答题、选择、遭遇、进入战斗均有对应音效调用。
- 战斗开始、玩家行动、敌人反击、胜利、失败均有音效或动画事件。
- `battle-animate` 监听不会因为 `{ once: true }` 或注册时机导致后续回合丢动画。
- 设置面板能控制音效静音、音量，并可测试播放。
- 自动化测试覆盖上述契约。

---

## 7. 执行回写

已于 2026-07-06 完成 P0 第一轮实施。

实际修改文件：

- `js/sfx.js`：扩展为语义化音效系统，保留旧 API，新增 `play(name)`、14 个探索/战斗语义音效、mp3 优先播放与 ZzFX 兜底、音效静音与音量持久化、`.profile-panel` 音效设置卡片。
- `js/exploration-detail.js`：探索 galgame 事件接入音效，对话推进、发现、答题正确/错误、选择确认、遭遇警告、进入战斗均有语义化音效调用。
- `js/exploration.js`：新增 `battle-animate` 事件派发，覆盖战斗开始、普攻、技能、防御、道具、敌人反击、胜利、失败。
- `js/app.js`：战斗弹窗生命周期内注册/移除持久动画监听；`handleBattleAnimate` 播放语义音效并驱动受击、施法、防御、胜负动效；伤害数字改为跟随事件 detail 弹出，避免只显示最后一条伤害。
- `css/style.css`：新增战斗施法、防御、胜利、失败状态样式，音效设置卡片样式，并添加 `prefers-reduced-motion: reduce` 动效降级。
- `prj/audio_battle_feedback_contract.test.mjs`：新增静态契约测试，锁定音效 API、探索调用点、战斗事件派发、UI 监听生命周期、伤害数字来源和动效样式。

验证命令与结果：

- `node prj/audio_battle_feedback_contract.test.mjs`：通过，`51/51 passed`。
- `python prj/test_explore_voice_coverage_contract.py`：通过，exit 0。
- `python -m py_compile prj/test_explore_voice_coverage_contract.py`：通过，exit 0。
- `node --check js/sfx.js`：通过，exit 0。
- `node --check js/exploration-detail.js`：通过，exit 0。
- `node --check js/exploration.js`：通过，exit 0。
- `node --check js/app.js`：通过，exit 0。

留到 P1/P2 的事项：

- P1：探索 galgame 打字机、语音同步、点击跳过、说话人高亮、事件视觉 cue。
- P2：真实 mp3 音效素材包、技能专属视觉特效、探索战斗与卡牌竞技场进一步视觉分层。
- 暂不加入 BGM/环境循环声，避免与语音播报冲突，也避免移动端自动播放限制扩大复杂度。
