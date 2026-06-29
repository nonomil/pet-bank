# 宠物小屋 P0 — 需求清单与执行计划（requirements-checklist）

> **文档定位**：solution-loop 阶段 3「计划」产出，**执行阶段的蓝图**。基于冻结方案 [宠物小屋-方案.md](./宠物小屋-方案.md) §3 功能边界 / §5 数据结构 / §8 验收标准（AC-1~AC-20）/ §11 执行骨架，细化为可执行步骤 + 验收映射 + 测试方案 + 回归清单 + 执行门禁。
>
> **范围基线**：[change-request-001-宠物小屋P0范围扩大.md](./change-request-001-宠物小屋P0范围扩大.md) 扩大后的 P0（衰减闭环 + 倒下救援 + 互动 API 改造 + bath 新按钮 + EXP 5 维常驻）。
>
> **裁决残留风险已吸收**（R2/R3/R4/R5，见各 Step 标注）。

---

## 0. 执行前裁决（吸收残留风险，已定案）

| 风险编号 | 内容 | 本计划定案 |
|---|---|---|
| **R3（重要）** | 方案 AC-6 伪代码用的 `PointsSystem.spend(10)` **在代码中不存在**；真实扣分链路是 `window.addGrowthPoints(delta)`（app.js:279-285）。⚠️ **计划审查修订（F2）**：经核对，`addGrowthPoints` **已 `return totalPoints`**（app.js:284），非「无返回值」；负值会被钳到 0（app.js:281）。 | **采用方案 B：app.js 新增 `spendPoints(n)` 封装**。理由：① `feed()` 返回 bool 决策清晰，调用方无需手动预检；② 与 shop.js:136-150 的「预检 + 扣分」模式一致但封装更内聚；③ `spendPoints` 在 `addGrowthPoints`（已返回 totalPoints）之上封装「预检 + 返回 bool」，不污染原函数。`spendPoints` = 预检 `window.totalPoints >= n` → 不足 alert 并 `return false` → 足则 `addGrowthPoints(-n)` 后 `return true` |
| **R4** | decay 双结算：init() 补算后又进 renderUI 再算 | **init() 补算后立即 `state.last_home_ts = now; save();`**，renderUI 再算时 `hours=0`，幂等。详见 Step 4 |
| **R5** | 探索禁用双守卫遗漏 ⚠️ 计划审查修订（F1） | home.js UI 层（导航 Tab 变灰）+ **真正出发入口** `ExplorationSystem.goExplore`（exploration.js:222）/ `ExplorationDetail.show`（exploration-detail.js:135）加 `hp<=0` 守卫；`renderExplorePage`（app.js:763）降级为渲染层第二道兜底。详见 Step 5 + Step 8 |
| **R2** | cleanliness 是规格书 §2.2 五维之外的隐藏维度 | 计划显式声明 **cleanliness 为本期设计新增的隐藏状态**（方案 §4.5），**不进顶部五维条**，仅角落小图标；不入规格权威五维 |

---

## 1. 实现步骤（细粒度，共 9 步）

> 顺序原则：**先底层 API（Step 1-4）再 UI（Step 5-7）再接入（Step 8）再回归（Step 9）**。每个 Step 标注：改动文件:行号 / 具体做什么 / 对应 AC / 前置依赖。

### Step 1：扩展 PetSystem.state（4 个新字段 + load 默认值）

| 项 | 内容 |
|---|---|
| **改动文件:行号** | `js/pet.js:56-70`（state 字面量）+ `js/pet.js:73-82`（load 函数） |
| **具体做什么** | ① 在 state 字面量新增 4 个字段：`hunger: 100`、`intimacy: 0`、`cleanliness: 50`、`last_home_ts: null`（默认值对齐方案 §5.3）。② load() 已用 `Object.assign(state, JSON.parse(saved))`（pet.js:77），**无需改动**——旧存档自动获得新字段默认值（向后兼容，AC-4 依赖）。③ `chooseSpecies()`（pet.js:90-109）补 `state.hunger = 100; state.intimacy = 0; state.cleanliness = 50; state.last_home_ts = null;`，避免重选宠物后旧值残留。 |
| **对应 AC** | AC-3（字段存在）、AC-4（刷新不丢）、AC-5（占位/真值切换） |
| **前置依赖** | 无（第一步） |
| **R 风险** | 无 |

### Step 2：改造 feed / play / rest（写 hunger/intimacy/exp + 积分扣分走 spendPoints）⚠️ 计划审查修订（F3/F4）

> **F3 修订背景**：审查发现原计划遗漏 app.js 旧入口 `feedPet`（app.js:697-710）也调 `PetSystem.feed`，且它有**两套语义**：
> - **702 行**：背包有宠物粮时 `PetSystem.feed(food)`——传道具对象，期望道具回 HP
> - **706 行**：背包无粮时 `PetSystem.feed({ effect: { hp: 10 } })`——传合成道具，纯回 HP（无道具、不应扣分）
> 若按原计划一刀切把 feed 主逻辑改成「spendPoints(10) 扣分+加饱食」，则 **app.js 宠物养成页点「喂食」会被意外扣 10 分**，破坏旧入口语义。
>
> **F4 修订背景**：app.js:712 `playWithPet` 调 `PetSystem.play()`、app.js:717 `restPet` 调 `PetSystem.rest()`——改造后会获得新数值（exp/intimacy），需声明去留。

| 项 | 内容 |
|---|---|
| **改动文件:行号** | `js/pet.js:183-192`（feed）、`js/pet.js:194-203`（play）、`js/pet.js:205-212`（rest） |
| **具体做什么** | **feed 改造（F3 定案：可选参数区分两套语义）**（对齐方案 §4.4，**R3 定案**）：feed 签名改为 `feed(foodItem, options = {})`，新增可选 `options.homeContext`（布尔，默认 false）。逻辑：保留 `if (!state.species)` 与 `if (state.hp <= 0)` 守卫；**仅当 `options.homeContext === true`（home.js 新调用）才走新语义**：① 调 `window.spendPoints(10)`，返回 false 则 `return { success:false, msg:'积分不足（需 10 分）' }`；② `state.hunger = Math.min(100, state.hunger + 25)`；③ `addExp(10)`；④ `state.happiness = Math.min(100, state.happiness + 5)`；⑤ `if (foodItem?.effect?.hp) heal(foodItem.effect.hp)`；⑥ `save()`。**`options.homeContext` 为 false/undefined（app.js feedPet 旧入口）走旧语义**：仅 `if (foodItem?.effect?.hp) heal(foodItem.effect.hp)` + `save()`，**不扣分、不加饱食/exp**（保留宠物养成页 HP 回血原行为）。home.js 按钮调 `PetSystem.feed(food, { homeContext: true })`。**play 改造（F4 定案：旧入口保留走新逻辑）**：保留 hp<10 拒绝守卫；在原 `happiness+15 / hp-5` 基础上新增 `state.intimacy = (state.intimacy || 0) + 5` 与 `addExp(5)`。**app.js:712 `playWithPet` 保留不动**——它调 `PetSystem.play()` 会自动获得新数值（exp+5/intimacy+5），这是期望行为（玩耍本就该涨亲密/经验），旧入口走新逻辑。**rest 改造（F4 定案：旧入口保留走新逻辑）**：在原 `heal(30% max_hp) / happiness-5` 基础上新增 `state.intimacy = (state.intimacy || 0) + 2`。**app.js:717 `restPet` 保留不动**——同 play 理由，治疗涨亲密是期望行为。 |
| **对应 AC** | AC-6（喂食，home 新语义）、AC-7（玩耍）、AC-9（治疗） |
| **前置依赖** | Step 1（state 字段）、Step 4（spendPoints 封装） |
| **R 风险** | R3：扣分链路改用 spendPoints，不调不存在的 PointsSystem.spend；**F3**：feed 用 `homeContext` 可选参数隔离新旧语义，避免 app.js feedPet 旧入口被误扣分 |

### Step 3：新增 bath() + decay() + markHomeExit()（3 个新 API）

| 项 | 内容 |
|---|---|
| **改动文件:行号** | `js/pet.js` 新增 3 个函数（建议插入在 `revive` 之后、`getTotalAtk` 之前，即 pet.js:220 之后）+ `js/pet.js:394-402`（return 公开 API 对象追加 `bath, decay, markHomeExit`） |
| **具体做什么** | ① **`bath()`**（方案 §4.5）：守卫同 feed；`state.cleanliness = Math.min(100, (state.cleanliness ?? 50) + 30)`；`state.happiness = Math.min(100, state.happiness + 5)`；save；return success。② **`decay()`**（方案 §4.2，**R4 定案**）：`const now = Math.floor(Date.now()/1000); const ts = state.last_home_ts;` 三连守卫 `if (!ts || isNaN(ts) || ts <= 0 || ts > now) hours = 0` 否则 `hours = Math.max(0, Math.floor((now-ts)/3600))`；`if (hours >= 1) { state.hunger = Math.max(0, state.hunger - hours*2); state.happiness = Math.max(0, state.happiness - hours*1); state.cleanliness = Math.max(0, (state.cleanliness ?? 50) - hours*1); if (state.hunger <= 0) state.hp = Math.max(0, state.hp - hours*5); }`；**结算后立即 `state.last_home_ts = now; save();`**（R4 防双结算）；`return { hours, applied: hours >= 1 }`。③ **`markHomeExit()`**：`state.last_home_ts = Math.floor(Date.now()/1000); save();`。 |
| **对应 AC** | AC-8（bath）、AC-11/12/13（decay）、AC-14（饥饿/脏视觉，依赖 cleanliness 衰减） |
| **前置依赖** | Step 1（state 字段） |
| **R 风险** | R4：decay 结算后立即写 last_home_ts，保证 renderUI 二次调用幂等 |

### Step 4：app.js 新增 spendPoints(n) 封装 + init() 补算 decay（**R3 + R4 落点**）

| 项 | 内容 |
|---|---|
| **改动文件:行号** | `js/app.js:279-285`（addGrowthPoints 附近，新增 spendPoints）+ `js/app.js:1131-1136`（window 暴露追加）+ `js/app.js:1139-1158`（init 末尾追加补算） |
| **具体做什么** | ① **新增 `spendPoints(n)`**（R3 定案，参考 shop.js:136-150 预检模式）：`function spendPoints(n) { if (typeof totalPoints === 'undefined' || totalPoints < n) { alert('成长分不足，快去完成任务赚积分吧！'); return false; } addGrowthPoints(-n); return true; }`。② window 暴露追加 `window.spendPoints = spendPoints;`。③ **init() 补算 decay**（R4，方案 §4.2 第三个触发点）：在 `PetSystem.load()`（app.js:1141）之后、`renderAll()`（app.js:1151）之前插入：`if (typeof PetSystem.decay === 'function' && PetSystem.getState().last_home_ts) { PetSystem.decay(); }`。由于 decay() 内部结算后已写 `last_home_ts = now`（Step 3），后续 switchPage('home')→renderUI 再算时 hours=0，幂等。 |
| **对应 AC** | AC-6（积分扣分）、AC-11（init 补算衰减） |
| **前置依赖** | Step 3（decay API 存在） |
| **R 风险** | R3 + R4 双解 |

### Step 5：新建 js/home.js（HomeSystem IIFE：init + renderUI + 进入结算 + 4 按钮 + 倒下立绘 + 救援 CTA + 探索禁用 UI 守卫）

| 项 | 内容 |
|---|---|
| **改动文件:行号** | 新建 `js/home.js`（全量新增） |
| **具体做什么** | IIFE 模式（对齐 pet.js/shop.js 风格），挂 `window.HomeSystem`。核心成员：① `init()`：加载 `petbank_home_state`（默认 `{slots:{center_left:'food_bowl',center_right:null,corner_left:'bath_tub',back:null,corner_right:null}, theme:'cozy_night'}`）+ `petbank_home_furniture`（默认 `['food_bowl','bath_tub']`）。② `renderUI(containerId)`：进入即调 `PetSystem.decay()` 结算；读 `PetSystem.getState()`；渲染场景背景（深夜主题，CSS 渐变占位，方案 §7.4 短期降级）、宠物立绘（按 hp/hunger/cleanliness 切正常/饥饿/脏/虚弱/倒下态，CSS 滤镜实现）、**五维状态条**（HP/饱食/快乐/亲密/经验，EXP 常驻；hunger/intimacy 字段未扩展前显示占位「--」）、4 互动按钮（🍕喂食/🎾玩耍/🛁洗澡/💤治疗）+ 救援 CTA（HP=0 浮现）、家具栏。③ 互动按钮转发：`onclick` → 调对应 `PetSystem.feed(food, { homeContext: true })/play()/bath()/rest()`（**F3：feed 必须传 `homeContext:true` 走新扣分语义**）→ 用返回的 `result.msg` 提示 → 重新 `renderUI` 刷新状态条；**HP=0 时 4 按钮禁用变灰**，仅救援可点。④ `triggerRescue()`：调 `PetSystem.revive(50)`，成功后播放复活动画（复用进化 keyframes，方案 §4.3 L5）、弹庆祝弹窗、重新 renderUI。⑤ `placeFurniture(furnId, slot)` / `removeFurniture(slot)`：写 `petbank_home_state.slots` + save。⑥ `save()` / `getHomeState()` / `addFurniture(furnId)`（商店购买后调）。⑦ **探索禁用 UI 守卫**（R5 第一守卫）：renderUI 内若 `getState().hp <= 0`，给顶部 nav 的 `data-page="explore"` Tab 加 disabled 样式（变灰 + cursor:not-allowed）；复活后解除。 |
| **对应 AC** | AC-1（部分，配合 Step 6/7）、AC-2、AC-5、AC-6/7/8/9（按钮）、AC-10（家具）、AC-14（饥饿/脏立绘）、AC-15/16/17（倒下救援）、AC-18（探索 Tab 变灰） |
| **前置依赖** | Step 1/2/3/4（全部底层 API 就绪） |
| **R 风险** | R5 第一守卫（UI 层）；R2：cleanliness 仅角落小图标，不进五维条 |

### Step 6：index.html 加 home nav-tab + page 容器 + script 引入

| 项 | 内容 |
|---|---|
| **改动文件:行号** | `index.html:28-39`（nav DOM，在 pet 与 explore 之间插入）+ index.html page 容器区（与 `page-pet` 同级）+ index.html script 引入区 |
| **具体做什么** | ① nav：在 `index.html:33`（pet tab）之后、`index.html:34`（explore tab）之前插入 `<div class="nav-tab nav-tab-home" data-page="home" onclick="switchPage('home')">🏠 宠物小屋</div>`（方案 §6.5）。② page 容器：在 `page-pet` 同级处新增 `<div class="page" id="page-home"><div id="home-container"></div></div>`。③ script：在 `<script src="js/pet.js">` 附近、`app.js` 之前引入 `<script src="js/home.js"></script>`（确保 HomeSystem 在 init 调用前定义）。 |
| **对应 AC** | AC-1（Tab 注册三件套：nav-tab + page 容器 + script） |
| **前置依赖** | Step 5（home.js 已建） |
| **R 风险** | 无 |

### Step 7：app.js switchPage 加 home case + init 调 HomeSystem.init() + 离开 home 写 last_home_ts

| 项 | 内容 |
|---|---|
| **改动文件:行号** | `js/app.js:305-320`（switchPage）+ `js/app.js:1139-1158`（init） |
| **具体做什么** | ① **switchPage 改造**（方案 §6.4）：在函数开头记录 `const prevPage = window.HomeSystem?._lastPage;`；在现有 `if (page === 'tools' ...)`（app.js:319）之后新增 home 分支：`if (page === 'home' && window.HomeSystem) { window.HomeSystem.renderUI('home-container'); } else if (prevPage === 'home' && window.PetSystem?.markHomeExit) { window.PetSystem.markHomeExit(); }`；末尾 `if (window.HomeSystem) window.HomeSystem._lastPage = page;`。② **init 改造**：在 `if (window.ToolboxSystem ...)`（app.js:1148-1150）模式之后新增 `if (window.HomeSystem && typeof window.HomeSystem.init === 'function') { window.HomeSystem.init(); }`（位置在 Step 4 的 decay 补算之后、renderAll 之前）。 |
| **对应 AC** | AC-1（switchPage home case）、AC-11（离开 home 写 last_home_ts，下次进入结算） |
| **前置依赖** | Step 5（HomeSystem 存在）、Step 6（page-home 容器存在） |
| **R 风险** | 无 |

### Step 8：exploration 真正出发入口加 hp<=0 守卫（**R5 第二守卫**）⚠️ 计划审查修订（F1）

> **F1 修订背景**：审查发现原计划把守卫加在 `renderExplorePage`（app.js:763）是错的——它**不是真正必经入口**。经核对真实代码：
> - `ExplorationSystem.goExplore`（exploration.js:222-237）函数体第一行即 `if (window.ExplorationDetail && typeof window.ExplorationDetail.show === 'function') { window.ExplorationDetail.show(sceneId); return; }`（:223-226），**优先走 ExplorationDetail.show 分支并 return**，根本不调 renderExplorePage。
> - `ExplorationDetail.show`（exploration-detail.js:135）才是场景探索的真正必经入口（被 goExplore/showSceneDetail 调用）。
> - 注：`startExploration`（exploration.js:253-277）内部已有 hp<=0 守卫（:259），但那是「开打时」拦截，用户已进入探索中间页；UI 层应在「点出发」就拦截。

| 项 | 内容 |
|---|---|
| **改动文件:行号** | ① **主守卫落点 A**：`js/exploration.js:222`（`goExplore` 函数体第一行，hp<=0 拦截后不进任何探索页）② **主守卫落点 B**：`js/exploration-detail.js:135`（`show(sceneId)` 函数体第一行，兜底防其它直调入口）③ **辅助第二道**：`js/app.js:763`（`renderExplorePage` 函数体开头，保留，仅作页面渲染层兜底） |
| **具体做什么** | ① **goExplore 主守卫**（exploration.js:222 函数体第一行）：`if (window.PetSystem && PetSystem.getState().species && PetSystem.getState().hp <= 0) { alert('宠物倒下了，请先去宠物小屋救援！'); return; }`——hp<=0 时连 ExplorationDetail.show 都不进。② **ExplorationDetail.show 兜底守卫**（exploration-detail.js:135 函数体第一行）：同款守卫，防 show 被其它路径直调。③ **renderExplorePage 第二道**（app.js:763，**保留原计划**）：同款守卫，作页面渲染层兜底（renderAll 也调它，HP=0 时探索页不渲染）。三处守卫条件一致：`hp <= 0 && species`（species 存在才拦，避免未选宠误拦）。配合 Step 5 的 nav Tab 变灰（R5 双守卫完整）。 |
| **对应 AC** | AC-18（救援阻断探索，F1 修订：拦截在「点出发探索按钮」而非「进入探索 Tab」） |
| **前置依赖** | Step 7（PetSystem 已可用） |
| **R 风险** | R5 第二守卫（真正出发入口层 goExplore/show），与 Step 5 的 UI 层（Tab 变灰）双保险；renderExplorePage 降级为渲染层兜底 |

### Step 9：回归验证（inventory useItem / 战斗 / 探索对 state 读取）

| 项 | 内容 |
|---|---|
| **改动文件:行号** | 无代码改动，纯验证（必要时微调） |
| **具体做什么** | 按 §4 回归清单逐项验证：① inventory.js:79-106 `useItem`（已确认**不调** feed，只调 `heal/addExp/revive`，feed 改造零影响）；② 战斗模块读 `state.hp/atk/max_hp`（新字段 number 类型，低风险）；③ 探索读 state（同②）；④ home feed 无道具/带道具/积分不足三个分支（**F3：home 调用必须传 `homeContext:true`**）；⑤ **app.js feedPet 旧入口（F3）**：宠物养成页点喂食，验证不扣分、不加饱食（走旧语义）；⑥ **app.js playWithPet/restPet 旧入口（F4）**：验证走新逻辑获 exp/intimacy，无报错；⑦ **HP=0 出发探索拦截（F1）**：点场景「出发探索」按钮触发 goExplore，被守卫拦截不进中间页；直调 ExplorationDetail.show 也被拦；renderExplorePage 渲染层兜底；explore Tab 灰；⑧ decay 防篡改（ts=null/NaN/未来时间）。若发现新字段导致某处 NaN，补 `?? 0` 或 `|| 0` 兜底。 |
| **对应 AC** | 全部 AC 的回归保障 |
| **前置依赖** | Step 1-8 全部完成 |
| **R 风险** | R5 回归确认双守卫生效 |

---

## 2. 验收映射表（AC-1 ~ AC-20 × Step × 验证方法）

> **覆盖完整性**：20 条 AC 全部映射到至少 1 个 Step，关键 AC（AC-1/6/11/18）跨多 Step 协同。

| AC | 验收点（摘要） | 主 Step | 辅 Step | 验证方法 |
|---|---|---|---|---|
| **AC-1** | home Tab 注册（nav + page + script + switchPage case）无 JS 报错 | Step 6 | Step 7 | 手动点击 Tab + F12 控制台无 error + DOM 检查 `document.querySelector('.nav-tab[data-page="home"]')` 非空 |
| **AC-2** | 渲染场景背景 + 立绘 + 五维状态条 + 4 按钮 + 家具栏 | Step 5 | — | 视觉检查（截图对比方案 §7.2 草图） |
| **AC-3** | home_state/home_furniture 初始化 + state 含 4 新字段 | Step 1 | Step 5 | `localStorage.getItem('petbank_home_state')` + `PetSystem.getState()` 含 hunger/intimacy/cleanliness/last_home_ts |
| **AC-4** | 刷新后家具与状态不丢失 | Step 1 | Step 5 | 摆放家具 + 改 state + 刷新 + 视觉一致 + getItem 核验 |
| **AC-5** | EXP 五维常驻；hunger/intimacy 占位「--」兼容 | Step 5 | Step 1 | 视觉检查（EXP 条始终在）+ getState（字段扩展前后切换显示） |
| **AC-6** | 喂食：积分-10/饱食+25/经验+10；道具额外回 HP | Step 2 | Step 4 | 点击喂食 + 读 `PetSystem.getState().hunger/exp` + 读 `window.totalPoints`（应 -10） |
| **AC-7** | 玩耍：快乐+15/HP-5/亲密+5/经验+5；HP<10 拒绝 | Step 2 | — | 点击玩耍 + 读 state.happiness/hp/intimacy/exp；HP=5 时点击应被拒 |
| **AC-8** | 洗澡：清洁度+30/快乐+5；连续点击封顶 100 | Step 3 | — | 点击洗澡 + 读 state.cleanliness/happiness；连点 5 次 cleanliness=100 不溢出 |
| **AC-9** | 治疗：HP+30%max_hp/亲密+2 | Step 2 | — | 点击治疗 + 读 state.hp（应 +floor(max_hp*0.3)）/intimacy（+2） |
| **AC-10** | 至少 1 个家具（食盆）可摆放并持久化 | Step 5 | — | 摆放食盆到 center_left + `getItem('petbank_home_state')` 核验 slots.center_left='food_bowl' + 刷新仍在 |
| **AC-11** | 离开≥1h 返回：饱食-2/快乐-1/清洁度-1 每小时 | Step 3 | Step 4/7 | 篡改 `state.last_home_ts = now - 7200`（2 小时前）+ save + 切到 home Tab + 读 state（hunger -4 / happiness -2 / cleanliness -2） |
| **AC-12** | 饱食归零后 HP -5/小时 | Step 3 | — | 篡改 `state.hunger=0; state.last_home_ts = now-3600` + decay + 读 state.hp（-5） |
| **AC-13** | 防时间篡改：ts=null/NaN/未来 → hours=0 不扣 | Step 3 | — | 篡改 last_home_ts = null / NaN / now+9999 + decay + state 不变 + return hours=0 |
| **AC-14** | 饱食<20 饥饿立绘 +「我饿了」；清洁度<20 脏立绘 +「我脏脏」 | Step 5 | Step 3 | 篡改 `state.hunger=15` + renderUI + 视觉检查立绘 + 气泡；cleanliness=15 同理 |
| **AC-15** | HP=0 倒下立绘（灰度+旋转）+ 4 按钮禁用 + 救援高亮 | Step 5 | — | 篡改 `state.hp=0` + renderUI + 视觉检查（立绘倒下、按钮 disabled、救援闪烁） |
| **AC-16** | 救援点击 → revive(50) → HP 恢复 max_hp*50% + 复活动画 + 庆祝弹窗 | Step 5 | — | 篡改 hp=0 + 点救援 + 读 state.hp（=floor(max_hp*0.5)）+ 视觉检查动画 + 弹窗 |
| **AC-17** | 倒下态点 4 互动按钮无响应（禁用） | Step 5 | — | 篡改 hp=0 + 连点 4 按钮 + 读 state（无任何变化） |
| **AC-18** | HP=0 点出发探索按钮被拦截 + Tab 变灰 + 复活后解除 ⚠️ F1 | Step 8 | Step 5 | 篡改 hp=0 + 在场景卡片点「出发探索」按钮 → 触发 `goExplore`/`show` → 应弹「请先救援」且不进入探索中间页（F1 修订：测试点从「进入探索 Tab」改为「点出发探索按钮被拦截」）；视觉检查 explore Tab 灰；复活后再点出发正常进入 |
| **AC-19** | 商店「家园装饰」分类 + 购买扣分 + 写 home_furniture | Step 5（addFurniture） | — | （P2，本期可后置）购买家具 + 读 totalPoints（扣）+ getItem 核验 |
| **AC-20** | 购买的家具出现在家具栏可摆放 | Step 5 | — | （P2）购买 → 切小屋 → 家具栏可见 → 摆放 |

> **AC-19/20 为 P2**，本期若时间不足可在 Step 5 预留 `addFurniture` 接口，shop.js 分类延后；不阻断 P0 验收。

---

## 3. 测试方案（TDD：自动测 vs 手动测）

### 3.1 可自动测（篡改 localStorage + 调 PetSystem 方法 + 读 getState 验证）

> 共 **12 条**。方式：浏览器 F12 控制台脚本，或测试 HTML 引入 pet.js/app.js 后断言。

| AC | 测试点 | 前置条件 | 操作 | 期望结果 | 验证 |
|---|---|---|---|---|---|
| AC-3 | 字段初始化 | 清空 `petbank_pet` | `PetSystem.load()` | state 含 hunger=100/intimacy=0/cleanliness=50/last_home_ts=null | `PetSystem.getState()` 断言 |
| AC-4 | 持久化 | state 已扩展 | `PetSystem.save()` + 刷新页面 + `PetSystem.load()` | 字段值保留 | getState 对比 |
| AC-6 | 喂食扣分+加饱食 | totalPoints=100, hunger=50, exp=0 | `PetSystem.feed()` | totalPoints=90, hunger=75, exp=10 | 读 `window.totalPoints` + getState |
| AC-6 | 喂食积分不足 | totalPoints=5 | `PetSystem.feed()` | 返回 `{success:false, msg:'积分不足...'}`，totalPoints 不变，hunger 不变 | 读返回值 + getState |
| AC-6 | 喂食带道具 | 道具 `{effect:{hp:20}}` | `PetSystem.feed({effect:{hp:20}})` | 积分-10/饱食+25/经验+10/**HP+20** | getState.hp |
| AC-7 | 玩耍数值 | hp=50, intimacy=0 | `PetSystem.play()` | happiness+15/hp=45/intimacy=5/exp+5 | getState |
| AC-7 | 玩耍 HP<10 拒绝 | hp=8 | `PetSystem.play()` | 返回 success:false，state 不变 | 返回值 |
| AC-8 | 洗澡封顶 | cleanliness=80 | 连续 `PetSystem.bath()` 2 次 | 第1次 cleanliness=100（封顶），happiness+10；第2次 cleanliness=100 不溢出 | getState |
| AC-9 | 治疗数值 | hp=10, max_hp=100, intimacy=0 | `PetSystem.rest()` | hp=40（+30）/intimacy=2 | getState |
| AC-11 | 衰减 2 小时 | hunger=100, happiness=100, cleanliness=50, last_home_ts=now-7200 | `PetSystem.decay()` | hunger=96(-4)/happiness=98(-2)/cleanliness=48(-2)/last_home_ts=now | getState + return hours=2 |
| AC-12 | 饱食 0 扣 HP | hunger=0, hp=100, last_home_ts=now-3600 | `PetSystem.decay()` | hp=95(-5) | getState |
| AC-13 | 防篡改（3 子用例） | 分别设 ts=null/NaN/now+9999 | `PetSystem.decay()` | 返回 hours=0，state 全部不变 | return.applied=false + getState 对比 |
| AC-16 | 救援复活 | hp=0, max_hp=100 | `PetSystem.revive(50)` | hp=50 | getState |

### 3.2 手动测（视觉检查 / DOM 交互，无法纯脚本验证）

> 共 **8 条。** 依赖渲染效果或跨 Tab 交互。

| AC | 测试点 | 操作 | 期望（视觉） |
|---|---|---|---|
| AC-1 | Tab 切换无报错 | 点击「🏠 宠物小屋」Tab | page-home 显示，控制台无 error |
| AC-2 | 界面完整渲染 | 进入小屋 | 背景+立绘+五维条+4 按钮+家具栏齐全 |
| AC-5 | EXP 常驻占位 | 字段未扩展时进入 | 5 格状态条，hunger/intimacy 显示「--」，EXP 条可见 |
| AC-10 | 家具摆放 | 拖/点食盆到 center_left 槽 | 槽位出现食盆，刷新后仍在 |
| AC-14 | 饥饿/脏立绘 | 篡改 hunger=15 进入小屋 | 立绘切饥饿态 + 「我饿了」气泡；cleanliness=15 同理 |
| AC-15 | 倒下立绘 | 篡改 hp=0 进入小屋 | 灰度+旋转立绘 + 4 按钮 disabled + 救援闪烁 |
| AC-16 | 复活动画 | 倒下态点救援 | 动画播放 + 庆祝弹窗 |
| AC-17 | 倒下态按钮无响应 | hp=0 连点 4 按钮 | state 无变化（控制台读 getState 确认） |
| AC-18 | 探索禁用（双守卫）⚠️ F1 | hp=0 在场景卡片点「出发探索」按钮 | 不进入探索中间页 + 弹「请先救援」（goExplore/show 守卫拦截）；explore Tab 灰；复活后再点出发正常进入 |

---

## 4. 回归清单

### 4.1 feed 改造影响（方案 §9.4 重点风险）⚠️ 计划审查修订（F3）

| 回归项 | 风险等级 | 说明 | 验证 |
|---|---|---|---|
| inventory.js useItem（消耗品） | **低** | useItem（inventory.js:79-106）对消耗品**不调 feed**，直接调 `PetSystem.heal(hp)` + `addExp(exp)`（inventory.js:99-100），仅 revive 调 `PetSystem.revive`（:97）。feed 改造**零影响**。 | 使用任意消耗品道具，HP/EXP 正常，无报错 |
| inventory.js useItem（装备） | 低 | equip 链路不读 hunger/intimacy，无影响 | 装备/卸下武器护甲正常 |
| **app.js feedPet 旧入口（F3 新增）** | **高** | app.js:697-710 `feedPet` 两分支：702 行 `PetSystem.feed(food)`（有粮）、706 行 `PetSystem.feed({effect:{hp:10}})`（无粮回血）。**F3 定案**：feed 新增 `options.homeContext` 参数，旧入口不传该参数 → 走旧语义（仅 heal，不扣分/不加饱食）。**必须验证旧入口不被误扣 10 分**。 | 宠物养成页点「喂食」：①有粮时 HP 按 food.effect.hp 回，totalPoints 不变，hunger 不变；②无粮时 HP+10，totalPoints 不变 |
| home.js feed 无道具分支 | **中** | home.js 调 `PetSystem.feed(food, { homeContext: true })`，走新语义：积分-10/饱食+25/经验+10 | 见 AC-6 自动测 |
| home.js feed 带道具分支 | **中** | 道具额外回 HP，需确认 `foodItem?.effect?.hp` 可选链兼容旧调用 | 见 AC-6 自动测（带道具子用例） |
| home.js feed 积分不足 | **中** | spendPoints 返回 false，feed 提前 return，**不扣分不扣道具** | 见 AC-6 自动测（积分不足子用例） |

### 4.2 state 新字段对战斗/探索/旧入口的影响 ⚠️ 计划审查修订（F4）

| 回归项 | 风险等级 | 说明 | 验证 |
|---|---|---|---|
| 战斗读 state.hp/atk/max_hp | 低 | 新字段 hunger/intimacy/cleanliness/last_home_ts 是 number/null，不破坏现有数值读取 | 打一场战斗，胜负结算正常 |
| 探索读 state | 低 | 同上 | 完成一次探索，次数/HP 变化正常 |
| addExp 升级链路 | 低 | play/feed(rest 仅 home 新语义)/play 新增 `addExp()` 调用，复用现有升级逻辑（pet.js:150-168），不冲突 | 玩耍至 exp 满级，升级动画正常 |
| **app.js playWithPet 旧入口（F4 新增）** | **中** | app.js:712 `playWithPet` 调 `PetSystem.play()`，改造后自动获得 exp+5/intimacy+5（期望行为）。**F4 定案：旧入口保留走新逻辑**，不需改 app.js。 | 宠物养成页点「玩耍」：happiness+15/hp-5/**intimacy+5/exp+5**，无报错 |
| **app.js restPet 旧入口（F4 新增）** | **中** | app.js:717 `restPet` 调 `PetSystem.rest()`，改造后自动获得 intimacy+2（期望行为）。**F4 定案：旧入口保留走新逻辑**，不需改 app.js。 | 宠物养成页点「治疗」：HP+30%max_hp/**intimacy+2**，无报错 |

### 4.3 扣分链路

| 回归项 | 风险等级 | 说明 | 验证 |
|---|---|---|---|
| 积分不足拒绝且不扣道具 | **中** | spendPoints 不足时 return false，feed 不进入加饱食逻辑，totalPoints 不变 | totalPoints=5 时喂食，返回 false，totalPoints 仍=5 |
| 扣分后 totalPoints 不为负 | 低 | addGrowthPoints（app.js:281）已钳 `if (totalPoints < 0) totalPoints = 0` | 边界：totalPoints=10 喂食后=0；totalPoints=9 喂食应被拒（预检） |

### 4.4 探索禁用（AC-18）⚠️ 计划审查修订（F1）

| 回归项 | 风险等级 | 说明 | 验证 |
|---|---|---|---|
| HP>0 探索正常 | 低 | goExplore/show/renderExplorePage 三处守卫均 `hp<=0 && species` 才拦截，HP>0 正常进入 | HP=50 点出发探索，正常进入中间页 |
| HP=0 出发拦截（主守卫） | **中** | goExplore（exploration.js:222）第一行守卫拦截，hp=0 点出发按钮不进 ExplorationDetail.show | hp=0 点场景「出发探索」按钮，弹「请先救援」，不进探索中间页 |
| HP=0 show 兜底 | **中** | ExplorationDetail.show（exploration-detail.js:135）守卫，防其它直调入口绕过 goExplore | hp=0 控制台直调 `ExplorationDetail.show('xxx')`，被拦 |
| HP=0 渲染层兜底 | 低 | renderExplorePage（app.js:763）守卫降级为第二道，renderAll 也调它，HP=0 探索页不渲染 | hp=0 renderAll 后探索页空白无报错 |
| HP=0 UI Tab 灰 | **中** | home.js UI 层 Tab 变灰（R5 第一守卫） | hp=0 视觉检查 explore Tab 灰 + cursor:not-allowed |
| 复活后自动解除 | 低 | revive 后 hp>0，home.js renderUI 重渲染 Tab 去灰，三处入口守卫放行 | 救援后再点出发探索，正常进入 |

### 4.5 衰减幂等（R4）

| 回归项 | 风险等级 | 说明 | 验证 |
|---|---|---|---|
| init + renderUI 双触发不双扣 | **中** | init 补算 decay 后 last_home_ts=now，renderUI 再算 hours=0 | 启动应用（init 算 1 次）+ 切到 home（renderUI 算 0 次）= 总共 1 次，state 单次扣减 |

---

## 5. 执行顺序与门禁

### 5.1 推荐执行顺序（3 个子阶段，每阶段后跑指定 AC）

```
阶段 A（底层 API，Step 1-4）
  ├─ Step 1: state 扩展
  ├─ Step 2: feed/play/rest 改造
  ├─ Step 3: bath/decay/markHomeExit 新增
  └─ Step 4: spendPoints + init 补算
  门禁 A：跑 AC-3/4/6/7/8/9/11/12/13（全部底层 API 可在控制台自动测）
  ── 通过后进入阶段 B ──

阶段 B（UI + 接入，Step 5-8）
  ├─ Step 5: 新建 home.js
  ├─ Step 6: index.html 三件套
  ├─ Step 7: app.js switchPage + init
  └─ Step 8: renderExplorePage 守卫
  门禁 B：跑 AC-1/2/5/10/14/15/16/17/18（UI 渲染 + 交互 + 探索禁用）
  ── 通过后进入阶段 C ──

阶段 C（回归，Step 9）
  └─ 按 §4 回归清单逐项验证
  门禁 C：§4 全部回归项绿 + AC-19/20（P2，可后置）
  ── 全绿则交付 ──
```

### 5.2 门禁细则

| 门禁 | 必过 AC | 失败处置 |
|---|---|---|
| **门禁 A**（API 层） | AC-3/4/6/7/8/9/11/12/13 全绿 | 失败不得进入 UI 阶段；定位是 state/扣分/衰减哪一层，回 Step 1-4 修复 |
| **门禁 B**（UI 层） | AC-1/2/5/10/14/15/16/17/18 全绿 | 失败定位是 home.js 渲染 / switchPage / 探索守卫，回 Step 5-8 |
| **门禁 C**（回归） | §4 全部回归项 + AC-19/20（P2 可后置标记） | 回归失败按 §4 风险等级处置：中风险必须修，低风险记录 |

### 5.3 每步 diff 控制建议

| Step | 预估 diff 行数 | 风险 |
|---|---|---|
| Step 1 | ~15 行（state 4 字段 + chooseSpecies 4 行） | 低 |
| Step 2 | ~50 行（feed 重写 ~25 含 homeContext 分支 + play/rest 各 ~10）⚠️ F3/F4 | 中（feed 双语义主路径） |
| Step 3 | ~50 行（bath ~10 + decay ~25 + markHomeExit ~5 + API 暴露） | 中（decay 守卫复杂） |
| Step 4 | ~15 行（spendPoints ~8 + window + init 补算） | 低 |
| Step 5 | ~250 行（home.js 全新模块） | **高**（建议拆 init/renderUI/按钮/救援/家具分函数提交） |
| Step 6 | ~10 行（3 处 HTML 插入） | 低 |
| Step 7 | ~20 行（switchPage 改造 + init 追加） | 低 |
| Step 8 | ~12 行（goExplore + show + renderExplorePage 三处守卫）⚠️ F1 | 低（纯守卫插入） |
| Step 9 | 0（验证为主） | — |

> **单次 diff 控制原则**（workflows.md）：Step 5（home.js）超 200 行，建议在执行阶段进一步拆为 5a（init+renderUI 骨架）/5b（4 按钮+救援）/5c（家具+立绘状态机）三批提交，每批跑对应 AC。

---

## 附：裁决残留风险落地速查

| 风险 | 落地 Step | 验证 AC |
|---|---|---|
| R3（PointsSystem.spend 不存在） | Step 2 + Step 4（spendPoints 封装） | AC-6 |
| R4（decay 双结算） | Step 3（decay 内立即写 last_home_ts）+ Step 4（init 补算） | AC-11（幂等） |
| R5（探索禁用双守卫） | Step 5（UI 层 Tab 灰）+ Step 8（goExplore/ExplorationDetail.show 真正入口守卫，F1 修订；renderExplorePage 降级为渲染层兜底） | AC-18 |
| R2（cleanliness 隐藏维度） | Step 1（默认 50）+ Step 5（仅角落小图标，不进五维条） | AC-5/8/14 |

---

*本文档为 solution-loop 阶段 3「计划」产出，执行阶段以 §1 步骤为蓝图、§2 AC 映射为验收、§3 测试方案为验证手段、§4 回归清单为质量门、§5 执行顺序为节奏。任何范围变更须回溯 [宠物小屋-方案.md](./宠物小屋-方案.md) §3/§5/§8。*
