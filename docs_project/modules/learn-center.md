# 学习中心 (LearnCenter)

> 核心文件: [js/learn-center.js](../../js/learn-center.js)（约 3800 行）—— 当前最大业务模块，行号会随内容调整漂移
> 数据文件: [data/learn/](../../data/learn/) (catalog + 3个学习包)
> Smoke: [scripts/learning-center-smoke.mjs](../../scripts/learning-center-smoke.mjs)

---

## 原理

### 设计目标
学习中心是教育内容的分发层。将学习资料组织成"资料包(pack)→模块(module)→课时(lesson)"的三层结构，支持晨读/识字/古诗/英语/外部网站等多种课时类型，并通过每日学习单模板帮孩子建立学习节奏。

### 核心模型

```
资料包 (Pack)
  3 个学习包:
    summer-chinese-bridge-2026/    暑期语文衔接（晨读/识字45天/古诗/经典/复盘）
    english-mc-hybrid-2026/       英语 MC 混合（Minecraft词汇/故事/复盘/自定义）
    learning-sites-gateway-2026/  学习站点导航（引导站点/复盘）

    manifest.json → { id, title, description, modules:[...], plan }
    plan.json     → 周计划 { weeks: [{ focus, days: [{ moduleId, lessonId }] }] }

模块 (Module)
    每个 pack 下的 modules/*.json → { id, title, type, summary, lessons[...] }

课时 (Lesson)
    每个 module 的 lessons[] → { id, title, day, content/pinyin/explanation, quiz }

课时类型 (module.type / lesson.kind):
    internal-content   站内内容（晨读/识字/古诗/经典）
    internal-review    站内复盘
    internal-worksheet 站内练习单
    external-reader    外部点读页（英语故事）
    external-site      外部网站入口
    guided-site        引导式网站入口（学习站点导航）

每日学习单 (Daily Sheet)
    3 套模板:
      模板A: 幼小衔接超轻量版（4项：晨读+古诗+识字+睡前复盘）
      模板B: 轻量标准版（5项：+拓展+明天先做什么）
      模板C: 错题加强版（5项：+错题整理+状态+时长）
    持久化 key: petbank_learning_daily_sheet (按日期)
```

### 数据流

```
catalog.json → pack manifest.json → module json → lesson (content)
                                       ↓
                                renderHub (首页)
                                renderPack (资料包页)
                                renderPlan (周计划页)
                                renderLesson (课时页)
                                renderPrint (打印页)
                                renderDailyCheckin (每日学习单)
```

---

## 实现

### 公共 API

| 函数 | 行号 | 说明 |
|------|------|------|
| **初始化** | | |
| `LearnCenter.init()` | :106 | 初始化：加载 catalog + 清理旧版数据 |
| **数据加载** | | |
| `LearnCenter.getCatalog()` | :126 | 获取学习目录（fetch catalog.json） |
| `LearnCenter.getPack(packId)` | :131 | 获取单个资料包 manifest |
| `LearnCenter.getModule(packId, moduleId)` | :152 | 获取单个模块数据 |
| `LearnCenter.loadAllModules(packId)` | :162 | 预加载资料包下所有模块 |
| **页面渲染** | | |
| `LearnCenter.renderHub(containerId)` | :2778 | 渲染学习中心首页（聚合3个资料包入口） |
| `LearnCenter.renderDailyCheckin(containerId)` | :1403 | 渲染每日学习单（根据用户选定的模板A/B/C） |
| `LearnCenter.renderPack(containerId)` | :3264 | 渲染资料包详情页 |
| `LearnCenter.renderPlan(containerId)` | :3325 | 渲染周计划页 |
| `LearnCenter.renderLesson(containerId)` | :3366 | 渲染课时页（根据 lesson 类型路由到对应渲染器） |
| `LearnCenter.renderPrint(containerId)` | :3558 | 渲染 A4 打印页 |
| **导航** | | |
| `LearnCenter.openPack(packId)` | :3794 | 切换到资料包页 |
| `LearnCenter.openLesson(packId, moduleId, lessonId)` | :3805 | 切换到课时页 |
| `LearnCenter.openPlan(packId)` | :3818 | 切换到周计划页 |
| `LearnCenter.openPrint(packId)` | :3829 | 切换到打印页 |
| **课时完成** | | |
| `LearnCenter.completeLesson(packId, moduleId, lessonId, rewardPoints)` | 约 :3780 | 标记课时完成 + 积分奖励 + 连续学习奖励；返回 `persisted: false` 表示本次没有完成结算 |
| `LearnCenter.isLessonCompleted(packId, moduleId, lessonId)` | :455 | 检查课时是否已完成 |
| **每日学习单** | | |
| `LearnCenter.getDailySheetMode()` | :269 | 获取当前选定的学习单模板 |
| `LearnCenter.setDailySheetMode(modeId)` | :273 | 设置学习单模板 |
| `LearnCenter.getDailySheetModes()` | :265 | 获取所有可用模板定义 |
| **工具** | | |
| `LearnCenter.resolvePackCapabilities(manifest)` | :466 | 解析资料包能力（quiz/en/reader/sheet） |
| `LearnCenter.resolveLessonSource(pack, module, lesson)` | :477 | 解析课时数据源路由 |
| `LearnCenter.resolveLessonLaunchUrl(pack, module, lesson)` | :494 | 解析外部课时跳转 URL |
| `LearnCenter.resolveLessonReward(manifest, moduleId, lesson)` | :504 | 解析课时积分奖励 |
| `LearnCenter.getModuleProgress(packId, module)` | :419 | 获取模块学习进度 |
| `LearnCenter.getPackProgress(packId, modulesById)` | :439 | 获取资料包整体进度 |
| `LearnCenter.getContinueLessonId(packId, module)` | :582 | 获取下一个待学课时 id |

### 课时完成与奖励持久化顺序

`completeLesson()` 的结算顺序是固定的：

1. 写入 `petbank_learning_progress`；失败立即返回 `persisted: false`，不发积分。
2. 写入 `petbank_learning_rewards`，包含课时奖励、每日 bundle 和资料包连续奖励；失败会回滚本次学习进度，不发积分。
3. 通过 `PetBankPoints.add()` 发放本次合计积分；积分 API 不可用时恢复本次修改前的进度和奖励记录，并返回失败。

完成按钮只有收到 `persisted: true` 才显示成功状态。英语词卡由 `EnglishVocabProgress` 管理显式 Profile 键：`record()` 返回 `persisted: false` 时，界面只提示重试，不推进词卡；里程碑兑换券写入失败时不会渲染为已获得。

### 课时类型渲染路由

```
renderLessonBody (pack, module, lesson, showPinyin) → :2733
  ├── internal-content  → renderReadingWorksheet (:2185)
  │                        或 renderLiteracyWorksheet (:2215)
  ├── internal-review   → renderReviewWorksheet (:2660)
  ├── internal-worksheet → renderResourceHubWorksheet (:2265)
  ├── external-reader   → renderExternalReaderWorksheet (:2315)
  ├── external-site     → (外部跳转，无站内渲染)
  └── guided-site       → (引导页，无站内渲染)
```

### 每日学习单模板

| 函数 | 行号 | 说明 |
|------|------|------|
| `renderDailySheetTemplateA(options)` | :818 | 模板A渲染（幼小衔接超轻量版） |
| `renderDailySheetTemplateB(options)` | :933 | 模板B渲染（轻量标准版） |
| `renderDailySheetTemplateC(options)` | :1073 | 模板C渲染（错题加强版） |

### 英语词汇功能

| 函数 | 行号 | 说明 |
|------|------|------|
| `renderVocabWorksheet(module)` | :2477 | 渲染词汇学习页 |
| `renderVocabLesson(container, containerId, packId, moduleId, moduleMeta, module)` | :2638 | 渲染词汇课时 |
| `getVocabStageItems(cards, focusIndex)` | :382 | 按阶段获取词汇卡片（每阶段 6 词） |
| `getVocabCardImage(card)` | :393 | 获取词汇配图 |
| `playVocabAudio(src)` | :407 | 播放词汇发音 |
| `getVocabFocusIndex(module, cards)` | :362 | 获取当前学习焦点 |

### Minecraft 单词远征

英语资料包中的 Minecraft 词卡有两条入口：原有 `learn-lesson` 词卡页继续作为资料包内的回退路径；新的 `/app/learn/minecraft-vocab` 是按日运行的短会话页面。完整 Anki 档案仍在 `prj/anki-minecraft-vocab/` 独立站，不由学习中心全量加载。

- 默认学习池为 `data/learn/packs/english-mc-hybrid-2026/` 中 2,168 个去重词，合并现有精选卡、参考站公开接口的 500 条结构化快照和 Anki 可读官方词条；完整 11,241 张 Anki 原始卡片与目录位于 `prj/anki-minecraft-vocab/`。
- 每次会话固定为 2 个复习位、5 个新词位、3 个主动回忆位和 1 个场景句位，共 11 步；无历史复习词时只用稳定顺序补足复习位，不伪造词卡掌握状态。
- `MinecraftVocabSession` 负责 Profile 会话快照、队列和完成判定；`MinecraftVocabPage` 负责页面渲染、音频回退和离页清理。页面由 `runtime-loader.js` 按 `minecraft-vocab` bundle 加载。
- 完成后只通过 `GameRewardReceipts` 发放 `source=minecraft-vocab`、`eventId=session:<localDate>` 的 10 成长分，重复完成返回 duplicate，不直接写积分键。
- 离开页面时必须执行 `MinecraftVocabPage.stop()`；媒体播放和页面 timer 不得跨页面继续运行。Profile 切换由现有快照策略隔离 `petbank_minecraft_vocab_session_v1_*`。
- 视觉资源分为运行场景包 `minecraft-vocab-visual-pack` 和 GPT UI 组件包 `minecraft-vocab-ui-pack`；后者只包含无文字透明 PNG，页面文字、按钮和可访问名称继续由 HTML/CSS 提供。

### 持久化

```
key: petbank_learning_catalog_state  → 目录状态 (JSON)
key: petbank_learning_progress       → 学习进度 (JSON)
key: petbank_learning_rewards        → 奖励记录 (JSON)
key: petbank_learning_quiz_attempts  → 测验记录 (JSON)
key: petbank_learning_print_prefs    → 打印偏好 (JSON)
key: petbank_learning_daily_sheet    → 每日学习单数据 (JSON)
key: petbank_learning_sheet_mode     → 模板选择 ('template-a'|'template-b'|'template-c')
key: petbank_learning_vocab_focus    → 词汇焦点索引 (JSON)
key: petbank_minecraft_vocab_session_v1_{profileId} → Minecraft 单词远征会话快照（JSON，按 Profile 隔离）
```

---

## 注意事项

- **learn-center.js 是内容/代码分离的最大违规者**：~1500行中文文案硬编码在 JS 中（模板A/B/C的完整文案、入口卡片、打印引导语）。详见 [review/content-code-separation.md](../review/content-code-separation.md) #1-#4
- `renderLesson()` 的路由逻辑根据 `lesson.type`/`lesson.kind`/`module.type` 三级判断，分支复杂
- 每日学习单的 3 套模板在 learn-center.js 和 profiles.js 中各定义了一份（重复），需统一数据源
- Pinyin 功能（`getLabelPinyin`/`toLibraryPinyin`/`getReadingTitlePinyin`）依赖 `char-library.json`，仅在打印功能中使用
- 英语词汇音频播放依赖浏览器 Media API，移动端有自动播放限制
- `completeLesson()` 内含 `maybeGrantDailyBundle()` 和 `maybeGrantPackStreak()` 两个奖励计算
