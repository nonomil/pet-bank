# 战斗动效升级实施计划

> **给 Claude:** 必需子技能：使用 superpowers:executing-plans 来逐任务实施此计划。

**目标：** 为探索遭遇战新增可降级的 Battle FX 动效层，让普攻、技能、防御、胜负反馈更有辨识度。

**架构：** 通过 `js/battle-fx.js` 接管视觉特效映射，`js/app.js` 只在现有 `handleBattleAnimate` 里转发事件。CSS/SVG 是默认渲染路径，Lottie JSON 作为本地资产和未来渲染器接入口。

**技术栈：** 原生 JavaScript、CSS 动画、Lottie/Bodymovin JSON、Node 静态契约测试。

---

## 任务状态

- [x] 任务 1：新增失败契约测试
- [x] 任务 2：实现 BattleFx 映射模块
- [x] 任务 3：新增战斗 CSS/SVG 动效
- [x] 任务 4：新增 Lottie JSON 资产和预览场景
- [x] 任务 5：接入 `index.html` 和 `js/app.js`
- [x] 任务 6：运行验证并回写文档

## 任务 1：新增失败契约测试

**文件：**

- 创建：`prj/battle_fx_contract.test.mjs`

**步骤：**

1. 编写测试读取 `index.html`、`js/app.js`、`js/battle-fx.js`、`css/style.css` 和 `assets/battle-fx/lottie/*.json`。
2. 断言 `index.html` 在 `app.js` 前加载 `js/battle-fx.js`。
3. 断言 `BattleFx.show`、技能 ID 映射、Lottie 路径、CSS class 和 reduced motion 存在。
4. 运行 `node prj/battle_fx_contract.test.mjs`，预期失败，因为实现尚不存在。

## 任务 2：实现 BattleFx 映射模块

**文件：**

- 创建：`js/battle-fx.js`

**步骤：**

1. 暴露 `window.BattleFx`。
2. 实现 `getEffectSpec(type, detail)`，将事件映射到 `slash`、`enemy-claw`、`power-strike`、`shield`、`ultimate`、`item-heal`、`start`、`victory`、`loss`。
3. 实现 `show(type, detail)`，在 `#battleDamageZone` 中生成临时 `.battle-fx` 节点。
4. 若存在 `window.lottie`，优先尝试加载对应 JSON；否则使用 CSS fallback。

## 任务 3：新增战斗 CSS/SVG 动效

**文件：**

- 修改：`css/style.css`

**步骤：**

1. 增加 `.battle-fx-layer` 和 `.battle-fx-*` class。
2. 增加关键帧：斩击、爪击、爆裂、护盾、雷击、治疗、胜利星芒。
3. 将新增动画加入 `@media (prefers-reduced-motion: reduce)`。
4. 确保特效 `pointer-events: none`，不挡按钮。

## 任务 4：新增 Lottie JSON 资产和预览场景

**文件：**

- 创建：`assets/battle-fx/lottie/slash.json`
- 创建：`assets/battle-fx/lottie/power-strike.json`
- 创建：`assets/battle-fx/lottie/shield.json`
- 创建：`assets/battle-fx/lottie/ultimate.json`
- 创建：`prj/GPT生图--Lottie动画/player/public/projects/petbank-battle-fx/scene-1/lottie.json`
- 创建：`prj/GPT生图--Lottie动画/player/public/projects/petbank-battle-fx/scene-2/lottie.json`
- 创建：`prj/GPT生图--Lottie动画/player/public/projects/petbank-battle-fx/scene-3/lottie.json`
- 创建：`prj/GPT生图--Lottie动画/player/public/projects/petbank-battle-fx/scene-4/lottie.json`

**步骤：**

1. 创建透明背景 Lottie，尺寸 256x256，60fps，45-60 帧。
2. 每个 JSON 保持简单 shape layers，避免 renderer 特有能力。
3. 使用 Node JSON parse 校验所有资产。

## 任务 5：接入运行时代码

**文件：**

- 修改：`index.html`
- 修改：`js/app.js`

**步骤：**

1. 在 `index.html` 中把 `js/battle-fx.js` 放在 `js/app.js` 前。
2. 在 `handleBattleAnimate(e)` 顶部调用 `window.BattleFx.show(type, e.detail)`。
3. 不改战斗结算、音效、HP 刷新和掉落逻辑。

## 任务 6：验证与回写

**命令：**

- `node prj/battle_fx_contract.test.mjs`
- `node prj/audio_battle_feedback_contract.test.mjs`
- `node -e "..."` 校验新增 Lottie JSON

**回写：**

- 更新本文件任务状态。
- 更新 `01-战斗动效升级方案.md` 的执行回写，记录测试结果和剩余风险。

## 执行记录

2026-07-06 执行完成。

红灯：

- `node prj/battle_fx_contract.test.mjs` 首次运行失败，0/31，通过失败原因确认缺少 Battle FX 模块、脚本接入、CSS class 和 Lottie 资产。

绿灯：

- `node prj/battle_fx_contract.test.mjs`：通过，75/75。
- `node prj/audio_battle_feedback_contract.test.mjs`：通过，51/51。
- `node -e "...JSON.parse..."`：8 个 Lottie JSON 均可解析。
- Playwright 空白 DOM 运行时检查：`BattleFx` 可加载，`ultimate` 可生成并自动清理 `.battle-fx-ultimate`。
- `git diff --check`：通过；仅有 CRLF 提示。

产出：

- `js/battle-fx.js`
- `prj/battle_fx_contract.test.mjs`
- `assets/battle-fx/lottie/slash.json`
- `assets/battle-fx/lottie/power-strike.json`
- `assets/battle-fx/lottie/shield.json`
- `assets/battle-fx/lottie/ultimate.json`
- `prj/GPT生图--Lottie动画/player/public/projects/petbank-battle-fx/scene-1/lottie.json`
- `prj/GPT生图--Lottie动画/player/public/projects/petbank-battle-fx/scene-2/lottie.json`
- `prj/GPT生图--Lottie动画/player/public/projects/petbank-battle-fx/scene-3/lottie.json`
- `prj/GPT生图--Lottie动画/player/public/projects/petbank-battle-fx/scene-4/lottie.json`

备注：

- 当前 HEAD 已包含 Battle FX CSS 样式，工作区不再显示 `css/style.css` 差异；契约测试仍以实际 CSS 内容校验通过。
- `npm run build` 在 `prj/GPT生图--Lottie动画/player` 失败，原因是 player 工程缺少 `./vite-plugins/scenes` 和 `src`，不是新增 Lottie JSON 语法错误。
- `prj/*` 受 `.gitignore` 影响，预览场景需要 `git add -f` 才会被提交；运行时 Lottie 资产位于 `assets/battle-fx/lottie/`。
