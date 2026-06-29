# Changelog

本项目版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。完整阶段性进度见 [docs/进度/](docs/进度/)。

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
