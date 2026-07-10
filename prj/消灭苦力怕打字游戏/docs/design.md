# 设计草案

## 玩法

屏幕中间出现方块风绿色怪物。第一版自用原型优先复用主项目已有 `mc_creeper_*` 素材；怪物初始很小，站在远处，随着时间推进逐渐向屏幕下方靠近并变大。当前版本可同时出现两只：前排苦力怕是当前目标，后排苦力怕只是远处预告，不显示第二个输入目标。怪物头顶显示本轮目标，目标可以是 `cat`、`pin`、`b`、`ao`、`10` 这类低门槛输入。孩子用蓝牙键盘输入正确内容后，底部 Agnes 透明 PNG 弓箭发射器射出弓箭，怪物变成方块粒子爆炸，获得星星或金币奖励。

## 幼小衔接适配

界面一次只出现一个目标，不做多题选择；底部输入框要大，当前输入要明显。反馈不依赖复杂文字，使用颜色、星星、粒子、弓箭命中和音效。错误时只轻微震动输入框，不马上惩罚；超时让前排怪物逐渐变红，冲到屏幕下方时爆炸并扣一颗心。HUD 使用 Minecraft 参考感的三颗爱心表示血量，三颗都空则失败。

## 视觉

保留参考游戏的横屏结构：天空、草地、远处目标、底部输入与状态区。实地页面观察到原站使用 `canvas` 绘制天空/草地/怪物/HUD，DOM 里只保留底部按钮；这说明我们的版本可以用普通 DOM + CSS/JS 实现，不必照搬原站 canvas。UI 需要更现代、更亲子：减少密集数字格子，改成大输入条、爱心、星星进度条。自用版本可以使用主项目中的 Minecraft 风格素材；后续若公开发布，再切换到原创方块怪。

## 第一版范围

- 单网页原型，不接主项目。
- 支持一组静态题库。
- 角色靠近、正确爆炸、扣血、游戏结束。
- 先使用 GPT 参考图确定方向，再做透明资产图。

## 完整局规则

当前版本把原型推进为 12 关一局的完整小游戏。开始前可选择训练内容：综合、拼音、字母、单词、数字。每关只出现一个目标，孩子直接用键盘输入；输入正确后本关完成，获得基础金币和连击加成，星星按答对进度点亮。怪物靠近成功会扣一颗心、清空连击，并推进到下一关；三颗心扣完即失败。完成 12 关且仍有生命值即通关，结算页显示金币、答对数量和最佳连击。

为了便于自动化验证，页面支持 `?test=1` 测试模式：只缩短动画等待、关闭音效、暴露 `window.__typingDefenseTest` 快照/扣血测试入口。正常打开页面不启用测试模式。

## 参考页拆解

来源：`https://mayihaoke.com/mathcreep/play?diff=addsub20&time=15`

- 外层页面标题为“消灭苦力怕 · 数学闯关”，核心游戏在 iframe：`/creep_math_new.html?diff=addsub20&time=15&autostart=1`。
- iframe 同源，可读取源码，已保存到 `reference/mathcreep-iframe-source.html`。
- 游戏主体是 `canvas`，尺寸随窗口变化；底部答案按钮是 DOM。
- 怪物对象字段包含 `x/y/z/speed/problem/state/flashTimer/frameOffset`。
- 题目字段是 `problem.txt` 和 `problem.val`。
- 正确选择后触发 `state = DYING`、方块粒子、XP 粒子、`GET GOLD!` 浮字、屏幕震动、奖励累积。
- 未及时处理时，怪物接近玩家触发 `explode`，扣血、扣分、屏幕震动。

## 2026-07-07 动画修正

参考页的怪物不是把一整张图片在屏幕中间上下漂移，而是把怪物脚底压在 `horizonY = h * 0.55` 附近。源码中的 `drawCreeper(c)` 使用 `cy = this.horizonY` 作为地线，阴影画在 `cy`，腿部根据 `walk = Math.sin(frame...)` 左右偏移，身体只做很小的 `bob`。这会让怪物看起来踩在草地地平线上，并通过脚部摆动模拟前进。

当前原型已按这个思路调整：

- `.monster-wrap` 使用底部锚点，脚底锁在草地线，缩放时不再悬浮。
- 走路状态改为 DOM/CSS 方块 rig，四只脚独立左右摆动。
- 命中/受伤时再切回项目派生 PNG 姿态图，方便保留苦力怕的强反馈。
- 2026-07-08 改为远程弓箭攻击：底部只保留弓和箭，不再放置近战主角。
- 浏览器验证改为确认怪物 `bottom` 持续向屏幕下方移动、`scale` 持续增大，避免退回单一水平线移动。

## 2026-07-08 双怪与红化爆炸

当前版本在保持低龄简单性的前提下加入前后两只苦力怕。前排苦力怕绑定 `targetBubble`，是唯一需要输入的目标；后排苦力怕使用同一套 CSS 方块 rig，但缩小、偏左、压低透明度，只传达“远处还有下一只”的压迫感。这样既能让画面更像游戏，又不会让孩子误以为要同时选择两个答案。

危险反馈分三层：顶部接近条从绿到黄到红；前排苦力怕根据 `dangerLevel` 覆盖红色并脉冲；超时扣血时触发 `explodeCreeper()`，显示冲击光、方块粒子、屏幕闪烁并扣一颗爱心。三颗爱心来自透明 PNG，`web/simulate.mjs` 会验证三次扣血后 `emptyHearts === 3` 且 `state === "over"`。

底部发射器已从 CSS 临时弓替换为 Agnes 生成图：`assets/generated/typing-defense-assets/bow_launcher_agnes.png`。提示词保存在 `assets/generated/reference/bow-launcher-agnes-prompt.md`，生成脚本是 `tools/generate_agnes_bow_asset.py`，会记录 manifest 并验证透明 PNG 接入。

## 已复制素材

```text
assets/source-project/mc_creeper_idle.webp
assets/source-project/mc_creeper_attack.webp
assets/source-project/mc_creeper_happy.webp
assets/source-project/mc_creeper_egg.webp
```
