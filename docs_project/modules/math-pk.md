# 数学PK竞技台 (MathPKGame)

> 核心文件: [js/math-pk.js](../../js/math-pk.js) (1804行)
> 机器人图片: [assets/arena/math-rivals/](../../assets/arena/math-rivals/)

---

## 原理

### 设计目标
数学 PK 是游乐场的核心玩法。它把数学练习包装成"对战"：孩子选择适合当前状态的难度、面对机器人对手、在限时内作答，答对攻击对手，答错或超时被反击。当前版本已补充难度推荐理由和结算复盘，让失败不是终点，而是下一局的导航。

### 核心模型

```
难度 (Difficulty):
  easy20     : 加减起步，20 以内加减法
  easy100    : 加减进阶，100 以内加减法
  medium_mul : 乘法启程，用"几组几个"理解乘法
  medium_mix : 综合闯关，加减乘混合，约 30% 出 CMATH 应用题
  hard       : 乘除挑战，更快节奏的挑战档

对手 (Rival):
  5 种机器人（每难度 1 个，当前使用 v5 图片）:
    robot-easy20-v5, robot-easy100-v5, robot-mul-v5, robot-mix-v5, robot-hard-v5
  属性: name, image

回合机制:
  1. 系统按难度生成题目
  2. 玩家限时输入答案
  3. 答对 → 攻击对手，答错/超时 → 被对手反击
  4. 5 轮后按比分结算

辅助卡牌 (Support Card):
  中高阶难度可从已解锁支援中选择一张
  提供一次性的学习脚手架（拆数组、慢速机器人、再试一次等）

计分:
  答对得分 + 连击加分 + 胜利奖励
  最高分记录持久化，同时写入通用排行榜
```

---

## 实现

### 关键入口

| 函数/对象 | 文件:行号 | 说明 |
|------|----------|------|
| `DIFFICULTY_OPTIONS` | math-pk.js:44 | 5 档难度配置，包含 `fitFor/reason` 推荐文案 |
| `buildGuidedFeedback(summary)` | math-pk.js:280 | 根据难度、正确率、输赢、连击生成结算复盘与下一局建议 |
| `utils.generateQuestion(difficulty)` | math-pk.js:390 | 按难度生成口算题 |
| `render._difficultyPanel()` | math-pk.js:710 | 大厅难度面板，展示标签、描述、适合人群和推荐理由 |
| `render.result(data)` | math-pk.js:1026 | 结算页，展示得分、星轨奖励、复盘和下一局建议 |
| `render.renderDifficultySetting(containerId)` | math-pk.js:1072 | 家长设置页难度面板 |
| `Game.chooseSupportCardAndStart(cardId, nextMode)` | math-pk.js:1140 | 选择支援卡并开始练习/PK |
| `Game._setDifficulty(diff)` | math-pk.js:1196 | 设置难度并写入 `petbank_math_difficulty` |
| `Game.renderUI(containerId)` | math-pk.js:1216 | 渲染数学 PK 主界面 |
| `Game.start()` | math-pk.js:1227 | 开始机器人 PK |
| `Game.startTraining()` | math-pk.js:1233 | 开始乘法启程练习 |
| `Game.startAsyncMatch(match)` | math-pk.js:1315 | 开始好友异步 PK |
| `Game._estimateRobotThinkMs(question, diff)` | math-pk.js:1361 | 按题型和难度估算机器人思考时间 |
| `Game._endMatch()` | math-pk.js:1603 | 普通 PK 结算：积分、最高分、排行榜、支援星轨、引导反馈 |
| `Game._estimateRewardStars(summary)` | math-pk.js:1720 | 估算支援卡星轨奖励 |
| `buildAsyncQuestionSet()` | math-pk.js:1743 | 生成好友异步 PK 同题题组 |
| `describeAsyncQuestionSet(payload)` | math-pk.js:1762 | 描述异步题组难度与题量 |
| `window.MathPKGame.getDifficulty()` | math-pk.js:1791 | 获取当前规范化难度 |

### 引导式反馈

- 难度配置 `DIFFICULTY_OPTIONS` 包含 `fitFor/reason`，大厅和设置页都展示"适合谁/为什么"。
- `buildGuidedFeedback(summary)` 根据正确率、输赢、最高连击和难度生成两段文案：`note` 复盘、`nextStep` 下一局建议。
- `render.result(data)` 在结算页展示"复盘/下一局"，避免只告诉孩子输赢或分数。
- 探索数学小题的同类反馈在 [exploration.md](./exploration.md) 中维护。

### 持久化

```
CONFIG.STORAGE_KEY_DIFFICULTY       → 难度设置 (math-pk.js:29, 写入 math-pk.js:1201)
CONFIG.STORAGE_KEY_HIGH_SCORE       → 最高分 (math-pk.js:28, 写入 math-pk.js:1619)
CONFIG.STORAGE_KEY_SUPPORT_PROGRESS → 支援星轨进度 (math-pk.js:30, 读写 math-pk.js:224-233)
CONFIG.STORAGE_KEY_SUPPORT_UNLOCKS  → 支援解锁 (math-pk.js:31)
CONFIG.STORAGE_KEY_SUPPORT_SELECTED → 选中的辅助卡牌 (math-pk.js:32, 写入 math-pk.js:237-241)
```

### 乘法模式特殊处理

```
medium_mul 针对初学乘法做了节奏优化:
  - 使用"几组几个"和点阵展示
  - 机器人思考时间更长
  - 乘法练习场可先练到连对再进入 PK
  - 支援卡围绕拆数组、慢速机器人、再试一次设计
```

---

## 验证

| 场景 | 推荐命令 |
|------|----------|
| 引导反馈契约 | `node prj/math_pk_guided_feedback_contract.test.mjs` |
| 数学 PK 特效/样式契约 | `node prj/math_pk_fx_contract.test.mjs` |
| 角色素材 | `node prj/math_pk_character_assets.test.mjs` |
| 乘法启蒙 | `node prj/math_pk_multiplication_onboarding.test.mjs` |
| 全量回归 | `node scripts/run-full-regression.mjs` |

---

## 注意事项

- 当前难度 ID 是 `easy20/easy100/medium_mul/medium_mix/hard`；历史别名 `easy/medium/hard` 只在 `normalizeDifficulty()` 中兼容。
- 乘法模式的真实 ID 是 `medium_mul`，不是旧文档里的 `mul`。
- 支援卡系统依赖本文件自己的 `petbank_math_support_*` key，不依赖 card-collection.js 的卡牌收藏。
- 异步 PK 结算仍走好友挑战提交流程，本期引导反馈只接入普通 PK 结算。
