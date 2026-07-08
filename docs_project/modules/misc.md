# 音效 & 语音 & 其他轻量模块

---

## 音效系统 (sfx.js + zzfx.js)

> 核心文件: [js/sfx.js](../../js/sfx.js), [js/zzfx.js](../../js/zzfx.js)
> Lottie 特效: [js/battle-fx.js](../../js/battle-fx.js)
> 素材: [assets/battle-fx/lottie/](../../assets/battle-fx/lottie/)

### 原理

音效使用 ZzFX（ZzFX 是一个微型程序化音效库，不需要音频文件）。战斗特效支持 CSS/SVG（默认路径）和 Lottie JSON 动画（可选路径）。

### sfx.js 关键函数

| 函数 | 行号 | 说明 |
|------|------|------|
| `sfx.click()` | :90 | 点击音效 |
| `sfx.success()` | :100 | 成功音效 |
| `sfx.error()` | :110 | 失败音效 |
| `sfx.battle()` | :120 | 战斗音效 |
| `sfx.setVolume(n)` | :170 | 设置音量 0-1 |
| `sfx.toggleMute()` | :160 | 静音切换 |
| `sfx.getVolume()` | :41 | 获取当前音量 |

### battle-fx.js 关键映射

| 特效 | Lottie JSON | 说明 |
|------|-----------|------|
| power_strike | power-strike.json | 强力击（环+核心+火花） |
| defend | shield.json | 防御（护盾穹顶+闪光） |
| ultimate | ultimate.json | 必杀（闪电+环+火花+全屏特效） |

### 持久化

```
key: petbank_sfx_volume → 音量 0.0-1.0 (sfx.js:180)
key: petbank_sfx_muted → 静音标志 (sfx.js:176)
```

---

## 语音系统 (VoiceSystem)

> 核心文件: [js/voice.js](../../js/voice.js) (423行)

### 原理

使用浏览器 Web Speech API（SpeechSynthesis）实现 TTS 文字转语音。用于探索场景的叙事对话朗读。

### 关键函数

| 函数 | 行号 | 说明 |
|------|------|------|
| `VoiceSystem.speak(text, opts)` | :100 | 朗读文本 |
| `VoiceSystem.stop()` | :120 | 停止朗读 |
| `VoiceSystem.setVoice(name)` | :140 | 选择语音 |
| `VoiceSystem.getSettings()` | :50 | 获取语音设置 |

---

## 宝箱系统 (TreasureChest)

> 核心文件: [js/treasure.js](../../js/treasure.js)

### 关键函数

| 函数 | 行号 | 说明 |
|------|------|------|
| `TreasureChest.load()` | :20 | 加载宝箱数据 |
| `TreasureChest.canOpenDaily()` | :41 | 日常宝箱条件检查 |
| `TreasureChest.openDaily()` | :60 | 开启日常宝箱 |
| `TreasureChest.checkMilestones()` | :49 | 检查里程碑触发 |
| `TreasureChest.openMilestone()` | :100 | 开启里程碑宝箱 |

---

## 家长工具 (ToolboxSystem)

> 核心文件: [js/tools.js](../../js/tools.js) (564行)

### 关键函数

| 函数 | 行号 | 说明 |
|------|------|------|
| `ToolboxSystem.init()` | :20 | 初始化工具系统 |
| `ToolboxSystem.renderUI(containerId)` | :60 | 渲染工具面板 |
| `ToolboxSystem.pomodoroStart()` | :300 | 番茄钟开始 |
| `ToolboxSystem.pomodoroEnd()` | :350 | 番茄钟结束 |
| `ToolboxSystem.exportData()` | :131 | 导出所有 localStorage 数据 |
| `ToolboxSystem.importData(json)` | :150 | 导入数据 |
| `ToolboxSystem.toggleAdvancedTools()` | :552 | 切换高级工具开关 |

---

## 排行榜 (Leaderboard)

> 核心文件: [js/leaderboard.js](../../js/leaderboard.js)

### 关键函数

| 函数 | 行号 | 说明 |
|------|------|------|
| `Leaderboard.renderUI(containerId)` | :50 | 渲染排行榜 |
| `Leaderboard.submitScore(gameId, score)` | :38 | 提交分数 |
| `Leaderboard.getScores(gameId)` | :28 | 获取排行榜 |
| `switchLeaderboardTab(gameId)` | app.js | 切换排行榜游戏 |

---

## 汉字游戏 (HanziGame)

> 核心文件: [js/hanzi-game.js](../../js/hanzi-game.js) (621行)
> 进度: [js/hanzi-progress.js](../../js/hanzi-progress.js)
> 数据: [data/hanzi-hsk.json](../../data/hanzi-hsk.json)

---

## 英语词汇 (EnglishVocabProgress)

> 核心文件: [js/english-vocab-progress.js](../../js/english-vocab-progress.js)
> 学习模块: learn-center.js 中集成
