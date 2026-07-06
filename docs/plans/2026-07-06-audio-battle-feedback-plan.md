# 声音演出与探索对战反馈实施计划

> **给 Claude:** 必需子技能：使用 superpowers:executing-plans 来逐任务实施此计划。

**目标：** 为探索故事、音效系统和探索战斗补齐语义化声音与可见战斗反馈闭环。  
**架构：** `sfx.js` 负责统一音效 API 与设置 UI；`exploration-detail.js` 在探索事件节点播放语义化音效；`exploration.js` 派发战斗动作事件；`app.js` 在战斗 UI 生命周期内稳定监听事件并驱动动画。  
**技术栈：** 原生 JavaScript、CSS、ZzFX、本地 mp3 资产兜底、Node/Python 静态契约测试。

---

## 任务 1：编写音效与战斗反馈契约测试

**文件：**
- 创建：`prj/audio_battle_feedback_contract.test.mjs`
- 读取：`js/sfx.js`
- 读取：`js/exploration-detail.js`
- 读取：`js/exploration.js`
- 读取：`js/app.js`

**步骤 1：编写失败的测试**

测试应检查：

- `sfx.js` 包含新增语义化音效名：`dialogueNext`、`discover`、`mathCorrect`、`mathWrong`、`choiceConfirm`、`encounterWarning`、`battleStart`、`playerAttack`、`enemyAttack`、`skillCast`、`defend`、`itemUse`、`battleWin`、`battleLose`。
- `sfx.js` 暴露 `play(name)`，并优先尝试 mp3，ZzFX 兜底。
- `sfx.js` 注入音效设置 UI，包含 `sfxEnabled`、`sfxVolume`、`sfxTest`。
- `exploration-detail.js` 在对话推进、发现、答题、选择、遭遇、触发战斗处调用语义化音效。
- `exploration.js` 派发 `battle-animate`，包含 `battle-start`、`player-attack`、`enemy-attack`、`battle-win`、`battle-lose`。
- `app.js` 在 `showBattleModal` 生命周期注册持久监听，不再依赖 `updateBattleUI` 的一次性监听。

**步骤 2：运行测试以验证它失败**

运行：

```powershell
node prj/audio_battle_feedback_contract.test.mjs
```

预期：失败，指出缺少语义化 API、设置 UI 或事件派发。

---

## 任务 2：扩展 `sfx.js`

**文件：**
- 修改：`js/sfx.js`

**步骤 1：实现最小代码**

实现内容：

- 保留旧方法：`click()`、`hit()`、`coin()`、`levelup()`、`error()`、`notice()`。
- 新增语义化方法和 `play(name)`。
- `SOUNDS` 中为每个音效声明 `mp3: assets/audio/sfx/<name>.mp3` 与 ZzFX 参数。
- `_play(name)` 优先尝试 mp3；mp3 加载或播放失败时再走 ZzFX。
- 增加 `_injectSettingsUI(panel)`，把音效设置卡片挂到 `.profile-panel`。
- 设置键继续使用 `petbank_sfx_volume`，新增静音键 `petbank_sfx_muted`。

**步骤 2：运行测试**

运行：

```powershell
node prj/audio_battle_feedback_contract.test.mjs
```

预期：`sfx.js` 相关断言通过，探索和战斗调用点仍失败。

---

## 任务 3：接入探索 galgame 音效

**文件：**
- 修改：`js/exploration-detail.js`

**步骤 1：实现最小代码**

在模块内新增安全播放助手：

```javascript
function playSfx(name) {
    if (window.sfx && typeof window.sfx.play === 'function') window.sfx.play(name);
}
```

调用点：

- `next()` 播放 `dialogueNext`。
- `discover` 事件播放 `discover`。
- `choice` 按钮确认播放 `choiceConfirm`。
- `answerMath(true)` 播放 `mathCorrect`。
- `answerMath(false)` 播放 `mathWrong`。
- `encounter` 事件播放 `encounterWarning`。
- `triggerBattle()` 进入战斗前播放 `battleStart`。

**步骤 2：运行测试**

运行：

```powershell
node prj/audio_battle_feedback_contract.test.mjs
```

预期：探索相关断言通过，战斗事件断言仍失败。

---

## 任务 4：接入探索战斗事件与动画

**文件：**
- 修改：`js/exploration.js`
- 修改：`js/app.js`

**步骤 1：实现最小代码**

`exploration.js` 新增安全派发助手：

```javascript
function emitBattleAnimation(type, detail) {
    window.dispatchEvent(new CustomEvent('battle-animate', { detail: Object.assign({ type }, detail || {}) }));
}
```

调用点：

- `startBattle()` 派发 `battle-start`。
- 普攻命中派发 `player-attack`。
- 攻击型技能派发 `skill-cast`。
- 防御技能派发 `defend`。
- 道具动作派发 `item-use`。
- 敌人反击派发 `enemy-attack`。
- 胜利派发 `battle-win`。
- 失败派发 `battle-lose`。

`app.js` 调整：

- `showBattleModal()` 注册持久 `battle-animate` 监听。
- `closeBattleModal()` 移除监听。
- `updateBattleUI()` 不再注册一次性监听。
- `handleBattleAnimate()` 支持 `battle-start`、`skill-cast`、`defend`、`item-use`、`battle-win`、`battle-lose`，并播放对应 `sfx.play(...)`。

**步骤 2：运行测试**

运行：

```powershell
node prj/audio_battle_feedback_contract.test.mjs
```

预期：契约测试通过。

---

## 任务 5：补充样式与体验兜底

**文件：**
- 修改：`css/style.css`

**步骤 1：实现最小代码**

补充样式：

- 音效设置卡片的按钮、滑块、提示文本。
- `battle-cast`、`battle-guard`、`battle-win-glow`、`battle-lose-dim`。
- `@media (prefers-reduced-motion: reduce)` 下禁用战斗震动和闪烁动画。

**步骤 2：运行静态检查**

运行：

```powershell
node prj/audio_battle_feedback_contract.test.mjs
python -m py_compile prj/test_explore_voice_coverage_contract.py
```

预期：全部通过。

---

## 任务 6：完成验证并回写文档

**文件：**
- 修改：`docs/plans/2026-07-06-audio-exploration-battle-design.md`
- 修改：`docs/plans/2026-07-06-audio-battle-feedback-plan.md`

**步骤 1：运行完整验证**

运行：

```powershell
node prj/audio_battle_feedback_contract.test.mjs
python prj/test_explore_voice_coverage_contract.py
python -m py_compile prj/test_explore_voice_coverage_contract.py
```

**步骤 2：回写执行结果**

在两个文档的执行回写区记录：

- 修改了哪些文件。
- 新增了哪些测试。
- 每条验证命令的结果。
- 哪些事项留到 P1/P2。

---

## 执行回写

已于 2026-07-06 在当前会话完成执行。

任务状态：

- 任务 1：已完成。新增 `prj/audio_battle_feedback_contract.test.mjs`，先验证红灯，修正 Windows 中文路径读取后得到功能缺失红灯。
- 任务 2：已完成。`js/sfx.js` 扩展语义化音效、mp3 优先与 ZzFX 兜底、音效设置 UI。
- 任务 3：已完成。`js/exploration-detail.js` 接入探索推进、发现、答题、选择、遭遇和进入战斗音效。
- 任务 4：已完成。`js/exploration.js` 派发战斗事件，`js/app.js` 持久监听并驱动音效、动画和事件伤害数字。
- 任务 5：已完成。`css/style.css` 补齐战斗动效、音效设置样式和 reduced motion 兜底。
- 任务 6：已完成。本文档和设计文档均已回写实际结果。

验证记录：

```powershell
node prj/audio_battle_feedback_contract.test.mjs
```

结果：通过，`51/51 passed`。

```powershell
python prj/test_explore_voice_coverage_contract.py
python -m py_compile prj/test_explore_voice_coverage_contract.py
```

结果：均通过，exit 0。

```powershell
node --check js/sfx.js
node --check js/exploration-detail.js
node --check js/exploration.js
node --check js/app.js
```

结果：均通过，exit 0。

实现备注：

- 战斗开始音效避免双响：galgame 路径由 `exploration-detail.js` 播放，非 galgame 路径由 `startBattle()` 兜底播放。
- 战斗动画监听从 `updateBattleUI()` 的一次性监听移到 `showBattleModal()` / `closeBattleModal()` 生命周期，避免后续回合丢动画。
- 伤害数字不再从最终日志倒推，而是由 `battle-animate` 的 `detail.damage` 直接驱动，因此玩家攻击和敌人反击都能独立浮出。

后续建议：

- 增加真实 `assets/audio/sfx/*.mp3` 资产包后，复测首次播放是否比 ZzFX 更自然。
- P1 再做探索打字机和语音同步；P2 再做技能特效和竞技场视觉分层。
