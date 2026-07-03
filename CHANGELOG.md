# Changelog

本项目版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。完整阶段性进度见 [docs/进度/](docs/进度/)。

## [v0.7.0] - 2026-07-02
### 🎡 游乐场 Hub + 🏆 通用排行榜 + 📝 汉字答题玩法 + 📚 HSK 3.0 词库 + 🧠 学习记忆系统

**🎡 游乐场 Hub（导航收口）**
- 顶部新增「🎡 游乐场」tab（替换「⋯更多」，works 降级为子页），收拢数学 PK / 汉字游戏 / 卡牌对战 / 排行榜 四大游戏入口，单一入口
- 首页 dash-card 瘦身（移除数学PK/汉字/排行榜卡）；其他页游戏类快捷按钮同步清理（积分页数学PK、兑换页宠物对战、宠物页训练营），保留非游戏类（背包/商店/工具箱/设置/每周复盘/奖励兑换/宠物小屋/卡片图鉴）
- 新建 `css/playground.css`（2×2 大卡 grid）+ `page-playground` hub 页

**🏆 通用本地排行榜**
- 跨玩法、按孩子隔离的进步记录（key `petbank_lb_{gameId}_{profileId}`），「与自己赛跑」
- 每玩法显示个人最高分 + 最近 ≤10 次战绩 + sparkline 趋势（emoji 八档 ▁▂▃▄▅▆▇█，零依赖）
- 接入 math-pk + 汉字两个玩法；旧 `petbank_math_high_score` 幂等迁移
- 新建 `js/leaderboard.js` + `css/leaderboard.css`

**📝 汉字答题玩法**
- 看拼音选字（choose-char-by-pinyin）+ 例句填空（fill-blank）双模式；启蒙关 30 题种子
- 复用 math-pk 结算骨架（计分/连击/写成长积分/入榜）；gameId='hanzi'
- 新建 `js/hanzi-game.js` + `css/hanzi-game.css` + `data/hanzi-questions.json`

**📚 HSK 3.0 Level 1 词库（594 题）**
- 词源 ivankra/hsk30（清洗后 500 词），生成 594 题：294 词组填空 + 300 单字选字
- 单字例句 + pinyin 由 LLM 补全（300/300 成功，opencode.ai/zen deepseek-v4-flash，含多音字校准）
- 二段加载：启蒙关 + HSK1 并存；输出 `data/hanzi-hsk.json`，生成脚本 `scripts/generators/`

**🧠 汉字学习记忆系统**
- 状态机 new → learning → mastered（连对 2 次掌握，答错回 learning）；按 profileId 隔离持久化
- 错题优先出题（加权 5/3/1.5/0.3 = 错题/新字/学习中/已掌握），避免连续重复
- 大厅进度 UI（已学/掌握/待复习）+ 题卡角标（新/复习）；新建 `js/hanzi-progress.js`（155 行）
- 真机 9/9 通过（含持久化、切孩子隔离、启蒙关与 HSK1 独立）

**🐛 修复**
- `index.html` 加 `<link rel="icon" href="data:,">`，消除控制台 /favicon.ico 404

**📄 文档**
- 专题文档归档至 `docs/汉字游乐场/`（设计稿 + 实施计划 + README）

---

## [v0.6.0] - 2026-07-01
### 🃏 卡牌图鉴 + ⚔️ 竞技场对战 + 🎟️ 训练券经济 + ⭐ 积分奖惩弹窗

**🃏 宠物图鉴卡牌系统**
- PVZ 风格卡牌边框 + 战斗数值（def/spd）+ Agnes 合成卡；图鉴两级浏览（大类卡片 → 瀑布流），告别 147 张混一起
- 未收集卡片详情隐藏（只显 ??? + 探索提示，不剧透）；无图宠物 emoji 兜底（Segoe UI Emoji 字体渲染，解决方框问题）
- 卡牌可达性修复：领养即入卡池 + 新玩家初始送 3 张；图鉴系列奖励收口为训练券（去掉 100 成长积分）

**⚔️ 竞技场对战（宠物训练营）**
- 宝可梦式 3v3 卡牌对战 PvE（P0 + P1）
- PvE 闯关：10 关 / 5 章 + 关卡选择 UI + 通关奖励
- PvP 本地热座彩蛋（两人各选 3 只轮流操作）
- 入口收口为「宠物训练营」；关卡列表 5 区域 / 10 轻章节 + 鼠尾草绿视觉；自由练习不计积分

**🎟️ 训练券经济**
- 每日登录送 3 + 初始 10；轻章节消耗 1；图鉴系列奖励由成长积分收口为训练券

**🐾 宠物扩充**
- 接入 MC 怪物 13 + PVZ 真实 38 species（总 147 → 198）
- 章末精英区遇图鉴 species 敌人（首胜定向掉卡 + 规则文档）

**⚔️ 战斗深化**
- 战斗 UI 重构（左右对峙 + 竞技场 + 大字 + 浮动伤害）+ 100% 必战斗
- 战斗状态气泡（浮动浮现）+ 语音按钮强制播放

**🏠 宠物小屋**
- 交互升级 + 立绘去白底 + 领养初始蛋；6 主题背景图接入

**⭐ 积分奖惩弹窗**
- 积分页新增「点宠物 → 加分/扣分」弹窗：加分/扣分双 tab + 2 列项目网格 + 搜索 + 浮动 ±N 反馈
- 预设项（加分 10 / 扣分 8）+ 自定义项（输入图标/名称/分数，自动收藏本地，网格内可删）
- 新增 `deductGrowthPoints`（允许扣到负数，惩罚语义）

**🚀 性能**
- 图片转 webp，线上资源 234MB → 16MB（93% 减小）

---

## [v0.5.4] - 2026-06-30
### 🏠 首页/积分 信息架构重排 + 🔢 数学PK 全屏竞技台 + 探索/小屋/战斗深化

**首页与导航（IA 重排）**
- 一级导航重排为 5 tab：🏠首页 / ⭐积分 / 🐾宠物 / 🗺️探索 / ⋯更多
- **首页独立成 dashboard**：hero 摘要(积分/宠物等级/战斗胜场 + 同行伙伴) + **6 张大卡片启动器**(一键跳转，不必点顶部 tab) + 宝箱仓库
- **积分 tab 纯积分**（今日打卡 + 每周复盘/数学PK/奖励兑换/兑换商店/背包），兑换并入积分
- 成长地图(路线图)归入「探索」tab；`HOME_TAB_MAP`/`PAGE_TO_TAB` 重写

**🔢 数学 PK 全屏人机竞技台**
- 全屏竞技台（竞技台背景 + 左人/右机器人立绘 + VS，Agnes 生图 `assets/arena/`），不复用旧卡片
- 同题竞速：机器人按难度有思考倒计时（简单4.5-8s/中等3.5-6s/困难2.8-4.5s），人在机器人之前答对赢该轮；答错不结束、继续抢答；共 5 轮
- 数字键盘输入答案 + 计算器显示屏 + 结果反馈；难度在「设置」页选（中等档约 30% 出 CMATH 应用题）；物理键盘支持
- 计分（赢一轮+10+连击、赢整局+25）+ 回写成长积分；美术 `agnes-image-2.1-flash`

**🗺️ 探索叙事收口**
- 12 场景 `ending_text` 叙事收尾 + 故事文本外置 `data/stories`（数据驱动 + 配音基础）
- 路线地图 5 章分组着色 + 章节名标签；CMATH 应用题 + 逻辑题（找规律/等式平衡）融入探索解谜

**⚔️ 战斗与🏠 小屋**
- 36 怪物立绘接入战斗 UI（Agnes 生图 + 去背景透明，emoji→立绘 img，onerror 回退）
- 宠物小屋 8 背景主题切换（Agnes 生图）+ 家具装饰图接入 + 6 件 P1 装饰积分购买

**其他**
- 三层语音播报系统（预生成 + 实时 + Web Speech）
- 多孩子账号管理页 + 项目改名「成长伙伴 · 萌宠冒险岛」

---

## [v0.5.3] - 2026-06-29
### ✨ 探索 galgame 重设计 + 数学解谜 + Agnes 生图
- **galgame 呈现层**：底部对话框 + 左右立绘 + 点击/▶ 推进 + 大字 19px + 选择卡片（替代卡片堆叠），借鉴 [Monogatari](https://monogatari.io/)（web VN 引擎）模式自实现轻量呈现层
- **数学解谜**：探索中加 `math` 事件（forest 示范）+ `genMathQuestion`（难度分级加减乘除）+ `answerMath`（答对 exp 奖励），把数学 PK 融入探索作"智力关卡"
- **Agnes 生图**（新 key 有效）：12 场景 galgame 背景（`assets/scenes-vn/`）+ 12 角色立绘（`assets/characters/`：蘑菇仙子/海鸥船长/雪狼/外星向导/糖果公主/水晶守卫/青蛙向导/木乃伊旅人/美人鱼/图书馆幽灵/火凤凰/星狐），`agnes-image-2.1-flash`
- **立绘接入**：`SCENE_CHAR_PORTRAIT` 场景→角色映射 + `setScenePortrait`，galgame 左侧场景角色 + 右侧宠物立绘
- `js/exploration-detail.js`（show/showNextEvent/choose/next galgame 重写 + math 分支 + genMathQuestion/answerMath）+ `css/style.css`（galgame 对话框/立绘/字体 19px/算式高亮）
- **playwright 验证**：galgame 呈现 6/6 + 数学解谜 6/6 + 立绘接入 ✅
- 设计稿：[docs/plans/2026-06-29-探索故事galgame重设计.md](docs/plans/2026-06-29-探索故事galgame重设计.md)（含开源 VN 调研 Monogatari/Ren'Py + 数学解谜方案 + 提示词）

---

## [v0.5.2] - 2026-06-29
### ✨ 奖励优化
- **盲盒稀有度分层**：新增 EPIC（城堡徽晶/幼龙鳞片/雪莲之魂/熔岩水晶）+ LEGENDARY（海皇冠/星星碎片/彩瀑灵晶）奖池，`pickRarityItem` 加权抽取
  - 普通盲盒：common 75% / rare 20% / epic 5%
  - 豪华盲盒：rare 60% / epic 30% / legendary 10%（可出传说道具）
- **卡片掉落 rarity 权重**：战斗胜利卡片按宠物稀有度加权（common 50/uncommon 30/rare 15/epic 4/legendary 1），图鉴收集有梯度（稀有宠物更难集齐，告别均等随机）
- `js/shop.js`：EPIC/LEGENDARY_ITEMS + pickRarityItem + openBlindBox 改豪华为 30%返利/20%经验/50%道具(rare+)
- `js/app.js`：卡片掉落按 rarity 权重
- **playwright 3/3 PASS**（豪华/普通盲盒权重 + 卡片 rarity 分布）

---

## [v0.5.1] - 2026-06-29
### ✨ 新增
- **数据导出/导入**（工具箱「数据管理」工具）：
  - 导出：收集所有 `petbank_*` 键（含 profiles 元数据 + 各孩子快照）→ JSON 文件下载，整家备份
  - 导入：JSON 文件 → 校验 → 覆盖 localStorage → reload（覆盖前 confirm 提醒先备份）
  - 配合多孩子：导出含所有 profile 数据，便于备份/迁移设备（B 云同步的手动轻量替代）
  - `js/tools.js`：工具箱加「数据管理」工具（createCard + openTool data_io + _initDataIO）
  - **playwright 4/4 PASS**（卡片/UI/导出收集完整/导入恢复）

---

## [v0.5.0] - 2026-06-29
### ✨ 新增
- **多孩子本地切换（ProfileManager swap）**：家庭多娃场景，纯前端，业务代码零改动
  - `js/profiles.js`：ProfileManager（swap 方案——切换时动态遍历 `petbank_*` 业务键快照存档/恢复）+ ProfileUI（nav 切换器：当前孩子+列表+新建/改名/删除）
  - 元数据 `petbank_profiles_meta` + `petbank_active_profile` + `petbank_profile_data_{id}` 快照
  - `ensureDefault` 幂等（老用户零感知：首次建 p_default，业务键原地不动）；`create/remove/rename/switchTo/resetCurrent`
  - `index.html` 引入 profiles.js + nav 切换器 DOM；`app.js` init 调 ensureDefault + render；`css/style.css` 切换器+面板样式
  - **playwright 7/7 PASS**（ensureDefault/创建/swap/数据隔离/恢复/删除）
  - 业务代码零改动（app/pet/inventory 等仍读写 petbank_*）
  - 方案：[banchong 账号机制分析与多孩子方案](docs/参考/banchong账号机制分析与多孩子方案.md)

---

## [v0.4.0] - 2026-06-29
### 📝 文档与工程
- **角色口径统一**：139（错误，115≠139 不自洽）→ **147**（banchong91+classpet40+PVZ8+MC8，数学自洽，数据实际值），14 处修正
- **docs 重构**：项目现状总览 + plans/changes/进度索引 + 战斗深化设计稿 + 商店家具联动设计/实施稿
- 综合冒烟清单 `scripts/smoke.mjs`（26 项全 PASS，探索/战斗/盲盒/宝箱）
- banchong 宠物互动分析 + 账号机制分析（playwright 实测）

---

## [v0.3.9] - 2026-06-29
### ✨ 新增
- **战斗深化（3 通用技能 + 道具快捷栏）**：
  - `data/skills.json`：3 技能 power_strike(强力击1.8x,CD2) / defend(防御,下回合减伤50%,CD3) / ultimate(必杀3x,CD5)
  - `js/pet.js`：state 加 skills/cooldowns/defending + 技能 API（loadSkills/getCooldown/startCooldown/tickCooldowns/canUseSkill）+ takeDamage applyDefend 减伤
  - `js/exploration.js`：battleTurn 加 skill/item 分支 + CD tick + 防御减伤时序 + flee_chance 对齐 combat.json(0.3)
  - `js/app.js`：showBattleModal 技能面板（3 按钮+CD 显示/禁用）+ 4 槽道具快捷栏（替代 prompt，0 灰显）+ useItemInBattle(id) 消耗 1 回合 + UI 锁定防连点
  - **playwright 24 项全 pass**（技能伤害1.8x/3x、CD 递减时序、防御减伤一次性、道具消耗回合敌人反击、flee 0.3、道具栏、普攻回归）
  - 严格边界：不引入 MP/buff/技能树/物种技能/AOE
- 设计稿：[docs/plans/2026-06-29-battle-depth-design.md](docs/plans/2026-06-29-battle-depth-design.md)

---

## [v0.3.8] - 2026-06-29
### ✨ 新增
- **商店家具联动（纯装饰版）**：积分消费 → 家具购买 → 小屋摆放 → 持久化的最小闭环
  - `data/furniture.json` 共享目录（8 家具：food_bowl/bath_tub 默认 + cozy_rug/soft_cushion/toy_box/night_lamp/wall_frame/star_mobile 购买）
  - `js/home.js`：loadCatalog 加载目录、ownership 归一化、getUnplacedFurniture、canPlace 槽位兼容（floor/corner/backdrop）、同槽位替换（旧家具回未摆放栏）
  - `js/shop.js`：buyFurniture + 「家园装饰」分类 + 已拥有禁用 + 联动 HomeSystem.addFurniture
  - **端到端 9/9 PASS**（买/重复拒/摆放/替换/不兼容拒/刷新保留/不进背包，0 页面错误）
  - 严格边界：纯装饰、无 buff、不进 InventorySystem、不拖拽、固定槽位
- **P1 宠物小屋互动**（v0.3.7）：点击宠物→随机台词气泡（23 条/6 组按状态）、背景层接口（3 主题 + setHomeBg）、进化进度可视化（Lv + 进度条）、微互动（hover/active 缩放）
- **MC 宠物 3 动作**（v0.3.6）：app.js 扩展 imageStyle 支持 minecraft，MC 宠物显示动作按钮 + 提示词文档（16 张 happy/attack）
- **playwright 浏览器配置化**：`scripts/playwright-browser.mjs`（候选：env > 系统 Chrome > chromium 缓存）+ `.env.example`，测试不再硬编码 executablePath

### 🐛 修复
- **宠物 3 动作映射**（v0.3.5）：getPetImagePath PVZ 动作用 poses/{pet}_{action}.png，修复"3 动作显示同一张"
- **MC 图段内单体**（v0.3.3-0.3.4）：strip 段内 cv2 提取最大块 + mask 清理，40 张全 1 主块（修复 wolf_mature 多体）

### 📝 文档
- banchong 宠物互动分析与合入方案（playwright 实测 /house）
- MC 动作图 / 宠物小屋背景 生图提示词文档

---

## [v0.3.2] - 2026-06-29
### 🔄 重做
- **MC 宠物图改用原版 strip 重切**：从 GitHub `nonomil/pet-bank` 的 `assets/pets/originals/strips/` 下载 8 张 MC 原版长条图（每只含 egg/baby/idle/mature/ultimate 5 阶段），用列密度分段 + 4段二分 + 裁切居中 + Lanczos → 40 张干净阶段立绘，替换 v0.3.1 的损坏图 cv2 提取版（原版原图，质量更高）
- 验证：视觉抽样 4 张（wolf_idle / axolotl_ultimate / enderman_mature / parrot_idle 跨宠物×阶段）全 PASS（1 个体/完整/无箭头/居中/阶段正确）
- v0.3.1 cv2 提取版备份在 `.tmp/mc-backup-v031/`，git 各版本可恢复
- 通过 V2RAY 代理（10808）下载 GitHub 原图

---

## [v0.3.1] - 2026-06-29
### 🐛 修复
- **MC 宠物图裁切**：40 张 Minecraft 宠物图（assets/pets/poses/mc_*.png）实为「多体+箭头」进化链对比图（34 张多体 + 6 张 ultimate 单体），作为单体立绘不合适。用 cv2 批量提取：形态学去箭头（椭圆核开运算）→ 最大连通块主体 → 裁切居中 → Lanczos 插值放大到 1024²
- 验证：playwright 视觉抽样 5 张（enderman/wolf/cat/parrot/turtle 跨阶段）全 PASS（1 个体/完整/无箭头/居中）
- 原图备份在 .tmp/mc-backup/，git v0.3.0 也有原版可恢复
- 注：Agnes API key（用户提供）返回 401 无效，未用；改走纯本地 cv2 方案

---

## [v0.3.0] - 2026-06-29

### ✨ 新增
- **宠物小屋系统**（`js/home.js`）：独立 Tab 入口、5 维状态条（HP/饱食/快乐/亲密/经验）、4 互动按钮（喂食/玩耍/洗澡/治疗）、家具槽、**倒下-救援闭环**（复用精灵乐园借鉴）、探索禁用守卫
- **PetSystem 扩展**（`js/pet.js`）：hunger/intimacy/cleanliness/last_home_ts 字段、`bath()`/`decay()`/`markHomeExit()` API、`feed(food,{homeContext})` 新旧语义分流、`spendPoints()` 积分预检
- **结构化文档体系**（7 份，`docs/`）：[需求规格书](docs/规格/需求规格书.md)、[技术架构](docs/设计/技术架构.md)、[模块清单与接口](docs/设计/模块清单与接口.md)、[差距清单与开发路线图](docs/路线/差距清单与开发路线图.md)、[参考索引](docs/参考/参考索引.md)、[精灵乐园借鉴分析](docs/参考/精灵乐园设计借鉴分析.md)、[文档总索引](docs/README.md)
- **生图提示词文档**（`docs/GPT生图/`）：9 只真缺宠物 × 6 阶段 = 54 条 GPT-IMAGE-2 prompt + 风格规范 + 接入指南
- 首页成长地图路线连线（polyline 路径）

### 🐛 修复
- **宠物图路径**：修复 1104 处坏路径（flat 546 + series 546 + 白鹿 12），**82 只 banchong 宠物图恢复显示**（残留 0）
- **首页地图连线层级 bug**（[CR-002](docs/方案/change-request-002-首页地图连线层级bug.md)）：节点 `transform` 的 stacking context + DOM 顺序覆盖 SVG → 翻转 DOM 顺序 + `z-index:5`
- **polyline points 语法**：百分比 → 数字坐标（console 错误 3→1）

### 📝 变更
- [需求规格书 §7.2](docs/规格/需求规格书.md)：倒下/救援优先级 P1 → P0（[CR-001](docs/方案/change-request-001-宠物小屋P0范围扩大.md)）
- [差距清单](docs/路线/差距清单与开发路线图.md)：宠物小屋 P0 范围扩大（含衰减闭环 + 救援 + 4 按钮 + 5 维常驻）

### ✅ 验证
- playwright 自动化（系统 Chrome + chromium-1187 双浏览器一致）
- 宠物小屋 20 条 AC 全 PASS（数据 + 截图视觉双验证）
- solution-loop 完整闭环（需求 → 方案三审 → 执行 → 复审）

### 🔗 详细
- 阶段性进度：[docs/进度/2026-06-29-宠物小屋P0与文档体系.md](docs/进度/2026-06-29-宠物小屋P0与文档体系.md)
- 方案文档：[docs/方案/宠物小屋-方案.md](docs/方案/宠物小屋-方案.md)

---

## [v0.2.x] - 2026-06-28 及之前
- 场景探索中间页（故事 + 互动 + 战斗）
- 首页地图刷新
- 宠物图片资源集成（PVZ/Minecraft/banchong）
- （未正式版本化，此处回溯记录）
