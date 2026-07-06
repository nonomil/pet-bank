# Changelog

本项目版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。完整阶段性进度见 [docs/进度/](docs/进度/)。

## [v0.7.7] - 2026-07-06
### 🏠 首页仪表盘重平衡

- 首页恢复为更接近原版的 dashboard 骨架：顶部轮播、成长概览、同行宠物、6 个快捷入口与宝箱仓库重新形成主路径
- 成长概览压缩信息密度：总积分、宠物等级、战斗胜场移动到左侧标题区下方，右侧只保留同行宠物卡，减少大空白和大面板感
- 轮播与成长概览改成更连贯的首页主舞台，保留森林、米色、柔和玻璃质感，不使用蓝色硬框/箭头作为最终 UI
- 首页桌面侧栏恢复任务与积分上下文，窄屏继续隐藏侧栏并保持两列快捷入口，避免移动端首屏过长

## [v0.7.6] - 2026-07-05
### 🐾 班宠乐园2 动物并册 + 🖼️ 图鉴图片 `.webp` 提速

**🐾 `班宠乐园2` 动物导入 `奇趣冒险馆 -> 萌爪伙伴册`**
- 新增独立来源 `banchong2`，把 `班宠乐园2` 的 `40` 只动物宠物正式并入当前项目，不新开顶层分馆，统一归档到 `奇趣冒险馆`
- 在 adventure 主题册下新增 `萌爪伙伴册`，作为这批动物宠物的正式子册入口；图鉴页、来源筛选、主题册进度与卡片档案链路同步打通
- 本轮导入沿用 `10 -> 6` 阶段映射（`1 / 2 / 4 / 6 / 8 / 10`），保证新来源能直接复用现有成长 UI，不额外分叉一套十阶展示逻辑

**🖼️ 新素材统一本地化为 `.webp`**
- 新增 `assets/banchong2/萌爪伙伴族/`，落地 `240` 张本地成长阶段图（`40` 只宠物 × `6` 阶段）
- 新导入宠物的运行时图片不再走默认外部 `bmp/jpg/png` 加载，而是统一改成站内 `.webp`，重点解决宠物图鉴与卡片详情首屏慢的问题
- 新增图片格式与卡片加载回归，防止后续又把慢格式路径带回运行时

**📖 图鉴故事、快照与导入工具**
- 新增 `scripts/import_banchong2_animals.py`，固化 `班宠乐园2` 动物导入流程、阶段映射和素材落盘规则
- 新增 `data/source-snapshots/banchong2-animals.json`、`banchong2-levels.json`、`banchong2-import-manifest.json`，保留来源快照与导入清单，便于后续补图或重建
- `data/pokedex-lore-draft.json` 补齐 `萌爪伙伴册` 卡片故事与档案字段，`data/pets.json` 总宠物数同步更新为 `238`

## [v0.7.5] - 2026-07-05
### 📚 学习入口重排 + 🧩 Minecraft我的世界英语故事 + ✅ 积分区独立学习单子页

**📚 学习页体验重排**
- 学习页把资料入口前置到头部 hero 下方，先让孩子和家长一眼看到“学什么、从哪里开始”，统计信息下移为概览区
- 中文资料包、英语资料包、学习网站入口包统一改成卡片式入口；中文入口使用站内学习插图，学习网站入口卡接入真实网页截图
- 中文资料包入口进一步替换为 Agnes 生成的 `暖黄绘本课堂` 主视觉封面，不再复用旧书堆图；同时补上 `scripts/generators/gen_learning_portal_covers.py` 与中文封面 smoke 路径断言
- `今日学习` tab 从“再放一遍大入口”改成“今日推荐入口”，减轻页面层级，让学习页更像轻量学习导航页

**🧩 学习资料扩展成通用模块**
- 在 `summer-chinese-bridge-2026` 之外，新增 `learning-sites-gateway-2026` 与 `english-mc-hybrid-2026`
- 英语包采用“当前项目做计划 / 进度 / 计分，外部站做章节阅读”的混合式结构，当前已落地 `mcbook56-story`、`mcbookstarters-reader`、`english-weekly-review` 与 `custom-entry-slot`
- 学习中心的资料包能力继续通过 `packType`、`sourceAdapter`、`customPackEnabled` 扩展，后续可继续接更多学习网站和自定义资料

**✅ 积分区独立学习单子页**
- 学习页当前优先负责“找到学习入口”，`积分 -> 学习单` 子页承接“今日学习单”打勾与收尾记录，`积分 -> 今日打卡` 回到日常积分主线，更符合家长实际使用路径
- 默认启用更适合幼小衔接的 `模板 A`；设置页可切换到 `模板 B` / `模板 C`，在不改积分底座的前提下逐步加字段
- 学习单当前只负责总时长、卡点、睡前复盘、拓展勾选与打印联动，不再额外发“学习单管理奖励”
- 主积分继续由 lesson 完成、中文晨读 + 识字组合奖励、英语连续学习奖励结算，避免双重发分

**🏠 好友小屋访客页 + 🚶 一起遛弯邀请**
- `串门` 不再只是写入互动记录，而是新增真正的“好友小屋”访客页；进入后可只读查看对方宠物摘要、小屋主题、家具数量与探索 / 胜场概览
- 家庭内孩子访问“仅家庭可见”的小屋时不再被错误拦住；跨家庭好友仍遵守小屋可见性与串门权限
- `一起遛弯` 改成异步路线邀请：发起方先选路线，对方会在自己小屋的“最近来访”里看到待响应卡片
- 接收方点击“按同路线遛弯”后，会自动跳到自己的遛弯页并按同一路线开始，随后回写一条已响应的互动记录
- 补齐好友小屋访客页与一起遛弯邀请的前端合同测试，覆盖路由页、邀请元数据与接受入口

**🌿 遛弯页收口为“户外版宠物小屋”**
- 遛弯页整体结构从 `hero + 双列表 + 路线卡` 收口成 `左侧户外大舞台 + 右侧三张侧栏卡`
- 左侧主舞台保留宠物场景、顶部状态 chip、气泡和路线切换，去掉原先占空间的舞台内大说明块与四个大操作按钮
- 右侧第一张卡补齐 `HP / 饱食 / 快乐 / 亲密 / EXP` 条形状态，交互按钮与“回小屋 / 看成长档案”入口统一移到状态卡中
- 好友遛弯与路线记录区同步压缩成更适合侧栏的紧凑样式：邀请列表、好友列表和日志区都改成限定高度的轻量滚动区域，路线缩略图与详情卡也进一步收短
- 新增 / 更新遛弯页合同测试，保证页面保持“宠物小屋式”骨架、右侧 vitals 状态卡和紧凑侧栏结构

**📄 文档与数据合同**
- 更新根目录 `README.md`、`docs/README.md`、`docs/plans/README.md`、英语学习专题与积分学习打勾方案专题
- 补齐 `petbank_learning_daily_sheet`、`petbank_learning_sheet_mode` 等学习单存储口径与扩展说明

---

## [v0.7.4] - 2026-07-05
### 👨‍👩‍👧 家庭账号社交最小版 + 🛠️ 轻后台骨架 + 🤖 Hermes 部署描述

**👨‍👩‍👧 家庭账号社交最小版**
- 主站补上可选 Supabase 云端配置入口与家长账号登录 / 注册壳，仍保留“本地即可运行”的轻量模式
- 接入注册邀请码、家庭关系、多孩子隔离与同步、好友码 / 串门 / 互动 feed 的最小闭环
- 数学 PK 与识字 PK 收口为“同题组异步对战”骨架，一期默认隐藏复杂诊断和重运营控件
- 宠物小屋补上可切换主题背景与访客位，便于多个孩子、多个家庭互相串门

**🛠️ 轻后台骨架**
- 新增 `admin.html`，复用家长账号登录态作为轻后台入口
- 新增 `public.user_roles`、`public.admin_audit_logs` 与 `public.is_admin()`，为管理员角色与审计留出正式数据底座
- 新增 `admin-search-entities` 与 `admin-list-invites` Edge Functions 骨架，先打通后台查询链路

**🤖 部署与数据安全**
- 新增 `supabase/config.toml`、`.env.production.example`、`ops/hermes.yaml`，统一人类、AI 与 CI 可读的部署约定
- 明确前端发布与数据库发布分离，数据库结构演进统一走 `supabase/migrations/*.sql`
- 默认采用 additive-first 升级策略，强调生产环境先备份、浏览器端禁止持有 `service_role`

**🎨 首页与导航细化**
- 首页移除“路线地图”栏目，避免与探索页重复；`宝箱宝库` 卡片改成更宽的双列空间
- `积分` / `宠物` / `游乐场` 的子页入口合入顶部一级导航下拉，同时保留页面内的快捷切换按钮
- 修复顶部下拉被通用收口逻辑立即关闭的问题，并把箭头升级为更明显、更好点按的图标按钮
- 探索页“宠物倒下了，需要去宠物小屋救援”升级为游戏提示框式救援卡片，文案更清晰

**🧪 验证与文档**
- 补齐家庭账号社交专题文档、后台 / Hermes 设计稿与实施计划
- 新增管理员后台、云端配置、家庭社交与部署约定的合同测试与联调说明

---

## [v0.7.3] - 2026-07-05
### 📚 学习中心上线 + 幼小衔接暑假中文资料包

**📚 学习中心（当前仓库内的新产品域）**
- 顶部导航新增 `学习` 一级入口，学习中心仍保持在当前 `pet-bank` SPA 内，不拆新仓库、不拆新站点
- 新增 5 个页面壳：`learn` / `learn-pack` / `learn-plan` / `learn-lesson` / `learn-print`
- 新增 `js/learn-center.js` + `css/learn-center.css`，形成通用资料包平台而不是一次性静态页面

**🧒 幼小衔接暑假中文资料包**
- 新增 `data/learn/` 资料包目录与首套 `summer-chinese-bridge-2026`
- 首套资料包完整接入：
  - `60 天晨读`
  - `45 天识字`
  - `每周复盘`
  - `古诗积累`
  - `经典短句`
- 新增 `scripts/generators/gen_summer_chinese_pack.py`，可批量重建暑假中文资料包内容

**⭐ 进度、发分与打印**
- 学习中心新增 `petbank_learning_catalog_state` / `petbank_learning_progress` / `petbank_learning_rewards` / `petbank_learning_print_prefs`
- lesson 完成统一通过 `window.addGrowthPoints(delta)` 发放成长分，并用唯一奖励键防重复刷分
- 同一天完成晨读与识字可额外领取组合奖励
- 新增浏览器 A4 打印友好页，可直接预览后原生打印 / 导出 PDF

**👨‍👩‍👧 多孩子隔离**
- 学习中心沿用 `petbank_*` 前缀，自动纳入 `ProfileManager` 快照切换
- 每个孩子的学习资料进度、奖励记录和打印偏好彼此隔离

**🧪 验证与文档**
- 新增 `scripts/learning-center-smoke.mjs`，覆盖导航、资料包加载、lesson 完成、一次性发分、组合奖励、打印页和多孩子隔离
- 更新技术架构、模块清单、项目总览与计划索引，补齐学习中心的架构口径

---

## [v0.7.2] - 2026-07-05
### 🗺️ 图鉴探索体验升级 + 场景数学任务反馈

**🧩 12 场景数学任务升级**
- 12 个探索场景数学事件全部改成来自现场线索的任务题：脚印比较、路线合计、配方分组、补给分配、巡逻组队、机关规律、星轨规律等
- 每道题补齐 `skill` / `hint` / `explanation`：题面展示能力点，答错给观察提示，答对给解法解析
- galgame 数学答题 UI 新增能力点标签、提示文本和解析文本，让数学题从“开门机关”变成“图鉴调查记录”

**🗺️ 探索页稳定性**
- `ExplorationDetail.show()` 改为等待故事 JSON 加载完成后再进入场景，避免首次点击时误判故事加载失败
- 故事加载 promise 去重，防止连续进入场景时重复 fetch 或出现竞态
- 返回探索地图时优先复用地图壳 `ensureExploreMapShell()`，避免从 galgame 回到地图时清空结构或出现空白页

**🃏 图鉴分馆体验优化**
- 4 张图鉴分馆封面重新合成，宠物卡改为右侧横排展示，入口画面更稳定、更像“分馆封面”
- 分馆入口卡片压缩文字层级，保留名称、简介和收集进度，减少视觉拥挤
- 图鉴详情书页弹窗支持视口内纵向滚动，关闭按钮固定在弹窗内，移动端长内容可正常关闭

**📄 文档与验证**
- 更新探索剧情改造设计、12 场景故事稿和测试验收清单，明确数学题必须绑定场景线索、能力点和反馈
- 补充图鉴详情布局回归断言，覆盖弹窗滚动与关闭按钮样式

---

## [v0.7.1] - 2026-07-03
### 🎨 UI 统一：4 界面自然场景绘本风 v2 + 汉字手绘插图

**🖼️ 游乐场 Hub 童趣卡通风重设计**
- playground hub 重写：Agnes 生童趣背景图（暖黄→橙渐变+星星云朵气球）；4 游戏卡纯色块改玻璃态半透明+主题色边框（数学蓝/汉字绿/卡牌紫/排行橙）
- 柴犬 emoji 吉祥物 + 金币徽章 + 装饰元素 + 圆润字体
- design-to-code 流程（browser-act→ChatGPT 生设计图→读图提取要素→Agnes 生背景→还原 CSS→真机截图迭代）

**🏆 汉字 / 排行榜 UI 统一**
- 汉字玩法 3 界面（等级大厅/答题题卡+选项/结算）+ 排行榜童趣化改造
- 各自 Agnes 主题背景（汉字黄绿+铅笔书本水印 / 排行榜金橙+奖杯彩纸）
- 玻璃态题卡 + 圆润选项按钮 + 金边最高分卡 + 胶囊 tab

**🌄 自然场景绘本风 v2 + 汉字手绘插图**
- 3 张 Agnes 重绘自然场景背景（游乐场草原/汉字森林花田/排行榜山顶颁奖台）
- 新增 **35 张汉字手绘插图**（`assets/ui/hanzi-img/`，汉字命名），题卡有图显图/无图 emoji fallback
- CSS 参数收敛：白底偏白(0.88+blur6)+圆角节奏(10/14/20/胶囊)+border 统一+强调色调色板

**🐛 修复**
- `::before` 全屏背景层挡住 body 地图板：3 页(playground/hanzi/leaderboard)背景从 `#page-xxx` 移入 `::before` 伪元素（position:fixed, inset:0）
- 3 页背景被 `style.css` `.map-page-bg .page` 透明规则压透明 → 用 ID+`!important` 覆盖

---

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
