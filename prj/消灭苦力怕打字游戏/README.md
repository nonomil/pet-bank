# 消灭苦力怕打字游戏

独立原型项目。目标是复刻 `docs/打字游戏方案/消灭苦力怕.md` 的核心玩法节奏：

```text
方块风怪物从远处向屏幕下方靠近 -> 孩子输入目标内容 -> 正确则发射弓箭并爆炸得分 -> 未及时输入则怪物变红爆炸并扣血
```

为了避免直接复刻受保护角色，本项目的美术方向使用“原创方块风绿色爆炸怪”，不生成 Minecraft Creeper 的精确形象。学习内容优先支持：

- 英文字母和简单单词
- 拼音声母/韵母/整体认读音节
- 简单数字输入

## 当前阶段

1. 已复制方案参考截图到 `reference/source-screenshots/`。
2. 已写入 GPT 参考图 prompt 和透明资产爆炸图 prompt。
3. 已做出单页网页原型：目标输入、怪物接近、正确得分、扣血、星星/爱心反馈。
4. 已补项目派生透明资产包：血量图、星星、粒子、冲击光效、苦力怕姿态图。
5. 已按参考页修正怪物行走：四只脚左右摆动模拟前进，并随时间向屏幕下方靠近、逐渐变大。
6. 已补完整游戏流程：拼音 / 字母 / 年级单词 / 数学模式，默认从年级单词开始，6 关一局，连击、最佳连击、通关和失败结算。
7. 已改为底部弓箭发射器远程攻击，不再使用近战主角；弓箭发射器已用 Agnes 生成透明 PNG：`bow_launcher_agnes.png`。
8. 已升级为多目标弓箭玩法：同屏 2-3 只苦力怕，头顶任务牌显示单词或算式，输入前缀会锁定对应目标并让弓箭旋转瞄准。
9. 已补红化爆炸和血量规则：苦力怕越近越红，冲到底部会爆炸扣一颗心，三颗爱心都空即失败。
10. 已补模拟测试：`web/simulate.mjs` 会用浏览器自动完成 6 次正确输入、3 次扣血失败、双苦力怕、红化、爆炸、语音重放和接近运动校验。
11. 已补本地音频资产：`assets/generated/audio/` 下包含 `prj/tts` 生成的提示语音，以及独立生成的倒计时 / 爆炸音效。
12. 已接入根游戏词库：`tools/build_typing_tasks_from_vocab.cjs` 从 `data/vocab/english-minecraft/views/typing-view.json` 生成 `assets/generated/minecraft-typing-defense/tasks.json` 和 `tasks.js`，页面优先使用这份运行时题库。
13. 已补更明确的四帧走路图：`tools/generate_creeper_stride_assets.py` 生成 `creeper_stride_0..3.png`，用左脚/右脚前后交替模拟苦力怕走近。
14. 已补弓箭发射图：`tools/generate_bow_arrow_assets.py` 生成待机、拉弦、释放、飞行箭和拖尾箭 PNG，页面命中时使用图片箭而不是纯 CSS 箭。
15. 已准备 GPT 多动作苦力怕流程：`prompts/gpt-creeper-multi-action-sheet.md` 负责生成 4x3 动作资产表，`tools/split_gpt_creeper_action_sheet.py` 负责裁切成可接入的透明 PNG 帧。
16. 已加入词库切换：`tools/build_vocab_banks.cjs` 从根 Minecraft 词库和已复制的 `words-0315` 低龄词库生成 `vocab-banks.json/js`，菜单可切换分级闯关、幼儿园、小学低年级、小学高年级、初中、Minecraft、幼小衔接拼音。
17. 已替换爆炸圆环：`tools/generate_explosion_shockwave_assets.py` 生成透明 PNG 冲击波帧，网页爆炸层不再创建 CSS 圆环。
18. 已接入 Agnes 地图背景链路：`tools/generate_agnes_background_set.py` 会生成 `voxel_map_background_agnes.jpg`、`voxel_ground_lanes_agnes.jpg` 和透明前景层 `voxel_ground_foreground_agnes.png`，网页已使用这组背景并修正蓝边与贴地感。
19. 已整理多目标玩法设计：`docs/multi-target-archer-design.md` 说明多只苦力怕、头顶任务牌、弓箭转向、100 以内加法和脚底锚定；`prompts/gpt-reference-game-multi-target-archer.md` 与 `prompts/gpt-voxel-map-background.md` 可用于继续扩展参考画面。
20. 已补奖励反馈层：新获得的星星会弹一下，连续命中会出现右上角连击横幅，完整命中后输入区会有金色高亮，低龄孩子更容易感知“打中了、升级了”。 

## 本地运行

如果根目录已有静态服务，可直接打开：

```text
http://127.0.0.1:8000/prj/%E6%B6%88%E7%81%AD%E8%8B%A6%E5%8A%9B%E6%80%95%E6%89%93%E5%AD%97%E6%B8%B8%E6%88%8F/web/index.html
```

验证命令：

```powershell
node .\prj\消灭苦力怕打字游戏\tools\build_typing_tasks_from_vocab.cjs
node .\prj\消灭苦力怕打字游戏\tools\build_vocab_banks.cjs
python .\prj\消灭苦力怕打字游戏\tools\generate_creeper_stride_assets.py
python .\prj\消灭苦力怕打字游戏\tools\generate_bow_arrow_assets.py
python .\prj\消灭苦力怕打字游戏\tools\generate_explosion_shockwave_assets.py
python .\prj\消灭苦力怕打字游戏\tools\generate_audio_assets.py
python .\prj\消灭苦力怕打字游戏\tools\generate_agnes_background_set.py
node .\prj\消灭苦力怕打字游戏\web\verify.mjs
node .\prj\消灭苦力怕打字游戏\web\simulate.mjs
```

## 工作流约定

- GPT 网页生图：按 `prj/browser-act-imagegen` 和 `prj/gpt-image-workflow` 的 browser-act 路线执行。
- 透明资产：按 `transparent-image-generator` 思路处理，先用可去背背景或透明爆炸图，再做 alpha 校验。
- GPT 多动作苦力怕图：先按 `prompts/gpt-creeper-multi-action-sheet.md` 生成 4x3 透明背景资产表，保存到 `assets/generated/reference/gpt-creeper-multi-action-sheet.png`，再运行 `tools/split_gpt_creeper_action_sheet.py` 裁切。走路帧必须明确体现四只脚前后交替运动。
- 文字内容不进图片，统一由 HTML/CSS 渲染，便于切换字母、拼音、数字。
- 当前 `assets/generated/typing-defense-assets/` 混合使用项目现有素材派生版和 Agnes 生成素材；`bow_launcher_agnes.png`、苦力怕序列、地图背景与透明前景层都已走 Agnes 链路，后续其他怪物/特效也可按同名 PNG 替换。
- 语音和音效优先使用本地静态文件：`tools/generate_audio_assets.py` 会复用 `prj/tts` 的 edge-tts 音色配置生成提示语音，再输出倒计时 / 爆炸 WAV。
- 低龄默认配置已改成：默认模式 `年级单词`、默认词库 `分级闯关（自动）`、一局 `6` 关、战斗节奏更慢，并在底部提供 `听一听` 重放按钮。
- 游戏词库默认来自根目录 `data/vocab/单词库_分级` 与 `data/vocab/english-minecraft`；外部 `words-0315` 的低龄词库已复制到 `assets/vocabs/source/words-0315/`，再生成运行时词库供菜单切换。当前单词模式不再按 `3/4/5` 字母限制，而是直接按年级词库出题，更适合蓝牙键盘长期练习。
- `?test=1` 只用于本地自动化验证，会缩短动画等待并暴露 `window.__typingDefenseTest`，正常打开页面不会启用。

## 参考资料

- 原方案：`docs/打字游戏方案/消灭苦力怕.md`
- 生图工作台：`prj/gpt-image-workflow/`
- browser-act 生图经验：`prj/browser-act-imagegen/`
- 透明素材技能：`C:\Users\No'mi'l\.codex\skills\transparent-image-generator\SKILL.md`
- 多目标弓箭下一版：`docs/multi-target-archer-design.md`
- GPT 参考游戏画面 prompt：`prompts/gpt-reference-game-multi-target-archer.md`
- GPT 地图背景 prompt：`prompts/gpt-voxel-map-background.md`
- GPT 分层滚动背景 prompt：`prompts/gpt-voxel-parallax-background-set.md`
