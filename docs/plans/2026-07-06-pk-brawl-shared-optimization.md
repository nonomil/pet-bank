# PK 大乱斗共通体验优化实施计划

> **给 Claude:** 必需子技能：使用 superpowers:executing-plans 来逐任务实施此计划。

**目标：** 参考 `docs/数学PK游戏/宝可梦数学大乱斗.md`，把数学 PK、卡牌对战、探索遭遇战统一成孩子容易理解的“选关 / 角色 / 出招 / HP / 结算”体验骨架。

**架构：** 不新增一套大引擎。先用文案、轻量 UI 组件、CSS 动效和契约测试统一体验语言；底层规则继续由 `MathPKGame`、`CardArena`、`ExplorationSystem` 各自负责。

**技术栈：** 原生 JavaScript、现有 CSS、现有图片资产、Node 静态契约测试。

---

## 任务状态

- [x] 任务 1：输出共通体验设计文档
- [x] 任务 2：新增跨玩法设计契约测试
- [x] 任务 3：新增跨玩法实现契约测试
- [x] 任务 4：数学 PK 正式对战加入出招/HP 风格反馈
- [x] 任务 5：卡牌对战入口加入步骤条和更清晰的当前操作方
- [x] 任务 6：探索遭遇战加入登场卡、角色名 HP 和故事化结算入口
- [x] 任务 7：自动化契约验收三套玩法
- [x] 任务 8：更新版本文档并提交

## 任务 1：输出共通体验设计文档

**文件：**

- 创建：`docs/PK大乱斗共通设计/README.md`

**步骤：**

1. 读取 `docs/数学PK游戏/宝可梦数学大乱斗.md`。
2. 提炼参考稿的可复用结构：选关、选角色、行动、出招、HP、结算。
3. 明确三套玩法的差异：数学 PK 不做卡牌构筑，卡牌对战不硬塞题目，探索战斗不抢主线。
4. 写入 P1 / P2 / P3 路线和美术约束。

**验证：**

```bash
Test-Path "docs/PK大乱斗共通设计/README.md"
```

预期：返回 `True`。

## 任务 2：新增跨玩法设计契约测试

**文件：**

- 创建：`prj/pk_brawl_shared_design_contract.test.mjs`
- 读取：`docs/数学PK游戏/宝可梦数学大乱斗.md`
- 读取：`docs/PK大乱斗共通设计/README.md`
- 读取：`docs/plans/2026-07-06-pk-brawl-shared-optimization.md`
- 读取：`js/math-pk.js`
- 读取：`js/card-arena-ui.js`
- 读取：`js/app.js`

**测试目标：**

- 参考稿仍包含选关、选择角色、输入结果、血条、胜利结算这些可迁移结构。
- 共通设计文档覆盖数学 PK、卡牌对战、探索故事 PK。
- 共通设计文档明确不使用宝可梦原图。
- 当前三套玩法入口仍存在：数学 PK 当前宠物/机器人、卡牌对战选关/选队/HP、探索战斗 modal / Battle FX。

**验证：**

```bash
node prj/pk_brawl_shared_design_contract.test.mjs
```

预期：`PASS pk_brawl_shared_design_contract`。

## 任务 3：新增跨玩法实现契约测试

**文件：**

- 创建：`prj/pk_brawl_shared_experience_contract.test.mjs`
- 读取：`docs/PK大乱斗共通设计/README.md`
- 读取：`js/math-pk.js`
- 读取：`js/card-arena-ui.js`
- 读取：`js/app.js`

**测试目标：**

- 文档明确覆盖数学 PK、卡牌对战、探索故事 PK。
- 文档包含 `选关`、`角色确认`、`出招反馈`、`HP`、`胜利结算`。
- 数学 PK 仍有当前宠物和分难度机器人。
- 卡牌对战仍有关卡、选队、HP 和结算入口。
- 探索战斗仍有宠物、怪物、HP、技能按钮和 `BattleFx` 接入。

**步骤 1：编写失败测试**

新增 Node 静态测试，先断言后续要落地的 UI marker，例如：

```js
assert.ok(appSource.includes('battle-encounter-intro'), 'exploration battle should have encounter intro marker');
assert.ok(cardArenaSource.includes('arena-flow-steps'), 'card arena should show flow steps');
assert.ok(mathSource.includes('math-pk-hp-track'), 'math PK should expose HP-style round progress');
```

**步骤 2：运行测试以验证失败**

```bash
node prj/pk_brawl_shared_experience_contract.test.mjs
```

预期：失败，因为三个 marker 尚未实现。

## 任务 4：数学 PK 正式对战加入出招/HP 风格反馈

**文件：**

- 修改：`js/math-pk.js`
- 测试：`prj/pk_brawl_shared_experience_contract.test.mjs`
- 回归：`prj/math_pk_multiplication_onboarding.test.mjs`
- 回归：`prj/math_pk_difficulty_levels.test.mjs`

**实现要点：**

1. 在正式 PK 场景增加 `math-pk-hp-track`，用 5 格可视化双方胜场。
2. 人答对时显示 `宠物出招` 类型短提示。
3. 机器人抢先时显示 `机器人反击` 类型短提示。
4. 不改变现有计分、成长积分、异步题组逻辑。

**验证：**

```bash
node prj/pk_brawl_shared_experience_contract.test.mjs
node prj/math_pk_multiplication_onboarding.test.mjs
node prj/math_pk_difficulty_levels.test.mjs
```

预期：全部通过。

## 任务 5：卡牌对战入口加入步骤条

**文件：**

- 修改：`js/card-arena-ui.js`
- 修改：`css/arena.css`
- 测试：`prj/pk_brawl_shared_experience_contract.test.mjs`

**实现要点：**

1. 在关卡 modal 顶部增加 `.arena-flow-steps`。
2. 文案固定为：`选关`、`选队`、`对战`、`奖励`。
3. 在战斗 topbar 中更突出当前操作方，但不改 `CardArena.turn()` 和 `turnPvp()`。
4. 保持 `prj/petbank_ui_alignment_regression.test.mjs` 现有断言不回归。

**验证：**

```bash
node prj/pk_brawl_shared_experience_contract.test.mjs
```

如当前环境支持 Playwright，再补：

```bash
node prj/petbank_ui_alignment_regression.test.mjs
```

## 任务 6：探索遭遇战加入故事化 PK 入口

**文件：**

- 修改：`js/app.js`
- 修改：`css/style.css`
- 测试：`prj/pk_brawl_shared_experience_contract.test.mjs`
- 回归：`prj/audio_battle_feedback_contract.test.mjs`

**实现要点：**

1. 在 `showBattleModal(battle)` 的 arena 内增加 `.battle-encounter-intro`，展示 `敌人出现`、场景/章节、敌人名。
2. HP 条旁补宠物名和怪物名，避免左右 HP 对应不清。
3. 行动区上方增加短提示：`选择技能，帮宠物突破这一关`。
4. 战斗结束按钮文案后续统一为 `继续探索`。
5. 不改变 `ExplorationSystem` 伤害、掉落、胜负规则。

**验证：**

```bash
node prj/pk_brawl_shared_experience_contract.test.mjs
node prj/audio_battle_feedback_contract.test.mjs
```

## 任务 7：自动化契约验收三套玩法

**文件：**

- 读取：`js/math-pk.js`
- 读取：`js/card-arena-ui.js`
- 读取：`css/arena.css`
- 读取：`js/app.js`
- 读取：`css/style.css`

**步骤：**

1. 跑跨玩法实现契约，确认三套玩法都有共通 PK 体验锚点。
2. 跑数学 PK 乘法、难度和动效回归，确认新增 HP/出招反馈不破坏练习场。
3. 跑探索战斗音效与 BattleFx 回归，确认遭遇战 UI 不影响战斗反馈。
4. 如后续引入真实浏览器链路，再补截图验收；本轮先以自动化契约收口。

**验证：**

```bash
node prj/pk_brawl_shared_design_contract.test.mjs
node prj/pk_brawl_shared_experience_contract.test.mjs
node prj/math_pk_multiplication_onboarding.test.mjs
node prj/math_pk_difficulty_levels.test.mjs
node prj/audio_battle_feedback_contract.test.mjs
node prj/battle_fx_contract.test.mjs
```

## 任务 8：更新版本文档并提交

**文件：**

- 修改：`CHANGELOG.md`
- 修改：`docs/PK大乱斗共通设计/README.md`
- 修改：`docs/plans/2026-07-06-pk-brawl-shared-optimization.md`

**验证：**

```bash
git diff --check
```

**提交：**

```bash
git add CHANGELOG.md docs/PK大乱斗共通设计 docs/plans/2026-07-06-pk-brawl-shared-optimization.md prj/pk_brawl_shared_design_contract.test.mjs prj/pk_brawl_shared_experience_contract.test.mjs js/math-pk.js js/card-arena-ui.js css/arena.css js/app.js css/style.css
git commit -m "feat: align pk brawl experience"
```

注意：如果工作区已有其他人的未提交改动，只暂存本计划涉及文件中的本轮变更，不要顺手提交无关文件。
