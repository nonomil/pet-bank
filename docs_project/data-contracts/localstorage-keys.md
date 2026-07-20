# localStorage 数据契约

> 当前基线：2026-07-12。浏览器本地模式的状态边界。代码仍有历史裸读写，下面的清单按 key 家族和 owner 维护；新增/改名/删除前必须同步本文件并补迁移测试。

## 1. 总规则

- 业务 key 使用 `petbank_` 前缀；不要把真实密钥、数据库、第三方 SDK 状态写入这里。
- 每个 key 需要明确 `owner`、数据类型、profile scope、schema/version、迁移方式和是否进入未来云快照。
- 新代码优先调用模块 API，不在多个模块直接写同一个 key。
- JSON 读取必须校验顶层类型和关键字段；损坏数据返回合法默认值并记录模块警告。
- `localStorage` 写入可能失败（配额、隐私模式、浏览器限制），关键操作不能把写入失败当成功。
- `ProfileManager` 通过 `js/profile-storage-policy.js` 排除设备、家长、账号和 Profile 元数据键；未知 `petbank_*` 仍默认动态快照，以避免漏登记造成数据隔离回归。新增非 Profile 键必须同时更新 registry、运行时策略和契约测试。

## 2. Profile 元数据与快照

| Key | 类型 | Scope | Owner | 说明 |
| --- | --- | --- | --- | --- |
| `petbank_profiles_meta` | JSON array | 全局 | `profiles.js` | profile 元数据 `{id,name,emoji,createdAt}` |
| `petbank_active_profile` | string | 全局 | `profiles.js` | 当前 profile id |
| `petbank_profile_data_{id}` | JSON object | 全局存档 | `profiles.js` | 目标 profile 的业务 key/value 快照 |

元数据不能随 profile swap 清空。快照 key 不能再次被当作业务 key；修改 profile 结构必须保留旧快照读取和删除/导入测试。

## 3. 成长、宠物和经济

| Key/家族 | 类型 | Owner | Scope/备注 |
| --- | --- | --- | --- |
| `petbank_points` | number | `app.js` | 当前 profile 的成长分余额；高风险共享读者 |
| `petbank_completed` | JSON array | `app.js` | 每日任务旧兼容键，不能作为新日切来源 |
| `petbank_tasks_completed_today` | number | `app.js` | 每日任务旧兼容计数，宝箱保留 fallback |
| `petbank_daily_state` | JSON object | `app.js` | 当前日合同：`date/profileId/completedTasks/dailyChestClaimed/dailyChestCount` |
| `petbank_daily_state_migrated` | flag | `app.js` | 旧每日状态迁移标记 |
| `petbank_daily_claim_date` | string | `app.js`/宝箱兼容路径 | 旧本地化日期格式；只读迁移/兼容 |
| `petbank_scheduled_checkins_v1` | JSON object | `scheduled-checkins.js` | Profile 快照内的暑假作息打卡状态；`{schemaVersion:1,date,profileId,checkins}`，窗口内奖励经 `CoreRewardService` receipt 去重，错过时段补记不发分 |
| `petbank_pet` | JSON object | `pet.js` | 宠物完整状态、经验、进化、衰减时间 |
| `petbank_growth_history_v1` | JSON array | 成长历史模块 | 奖励/成长事件历史 |
| `petbank_pet_story_cases_v1` | JSON object | `pet-story-cases.js` | 当前 profile 快照内的故事案件收据；记录含 `storyId/caseId/profileId/petIdentity/receiptId`，同一 scope 不可重复结案 |
| `petbank_space_growth_collectibles_v1` | JSON object | `space-growth-detective.js` | 当前 profile 的第二故事收藏；按 profile 隔离并进入快照 |
| `petbank_growth_works` | JSON array | `app.js`/作品页 | 成长作品记录 |
| `petbank_care_streak_v1` | JSON | 照料模块 | 宠物照料连续状态 |
| `petbank_chests` | JSON object | `treasure.js` | `daily/explore/milestone` 库存 |
| `petbank_claimed_milestones` | JSON array | `treasure.js` | 已领取里程碑 |
| `petbank_inventory` | JSON object | `inventory.js` | 物品堆叠/装备 |
| `petbank_cards` | JSON array | `card-collection.js`/竞技场 | 已收集卡牌 |
| `petbank_awarded_series` | JSON array | `card-collection.js` | 已发放系列套票奖励 |
| `petbank_starter_cards` | flag | `app.js` | 新手卡发放标记 |
| `petbank_custom_items` | JSON array | `app.js` | 家长自定义兑换项 |
| `petbank_unlocked_scenes` | JSON object | `exploration.js` | 已解锁场景 |
| `petbank_exploration_progress_v1` | JSON | 探索进度模块 | 场景/章节进度 |
| `petbank_walk_data`、`petbank_walk_logs` | JSON/array | `walk.js` | 遛弯状态与日志，旧日切格式需兼容 |
| `petbank_battle_milestone_rewards`、`petbank_battle_recent_activity` | JSON | `app.js`/战斗 UI | 战斗里程碑与最近活动 |

积分、任务计数、卡牌、遛弯和每日宝箱是跨模块共享高风险 key。修改时要查 `rg` 的全部读写者，不只看 owner 文件。

## 4. 奖励与事件

| Key | 类型 | Owner | 规则 |
| --- | --- | --- | --- |
| `petbank_core_reward_receipts_v1` | JSON object | `core-reward-service.js` | 核心奖励事件去重；eventId/profile/source 必须稳定 |
| `petbank_game_reward_receipts_v1` | JSON object | `runtime-loader.js` | iframe/游戏奖励 receipt，限制重复消息 |
| `petbank_task_reward_events_v1` | JSON array | `task-reward-events.js` | 任务完成/撤回操作日志，不是余额账本 |
| `petbank_guided_feedback_history` | JSON array | `app.js`/`family-review.js` | 本机数学/探索卡点和下一步建议 |

receipt 不等于余额：奖励事件必须先校验和去重，再调用既有积分/经验 API。新模块禁止另造第二套积分账本或只更新 UI。

跨模块积分 API：`window.PetBankPoints.get()` 读取余额，`add(n)` 增加，`spend(n)` 消费，`deduct(n)` 记录惩罚扣减。`app.js` 的 `addGrowthPoints` 仅作为主编排器和旧兼容入口；玩法模块不得直接写 `window.totalPoints` 或 `petbank_points`。

## 5. 学习状态

| Key/家族 | 类型 | Owner | Scope |
| --- | --- | --- | --- |
| `petbank_learning_catalog_state` | JSON | `learn-center.js` | 当前 profile 学习目录状态 |
| `petbank_learning_progress` | JSON | `learn-center.js` | 学习包/课程进度 |
| `petbank_learning_rewards` | JSON | `learn-center.js` | 学习奖励领取状态 |
| `petbank_learning_quiz_attempts` | JSON | `learn-center.js` | 测验尝试 |
| `petbank_learning_daily_sheet` | JSON | `learn-center.js` | 每日学习单 |
| `petbank_learning_daily_rewards` | JSON | `learn-center.js` | 学习单奖励 |
| `petbank_learning_sheet_mode`、`petbank_learning_print_prefs` | string/JSON | `learn-center.js` | 学习模板/打印偏好 |
| `petbank_learning_vocab_focus`、`petbank_learning_vocab_progress` | JSON | `learn-center.js` | 词汇焦点/进度 |
| `petbank_learning_english_rewards` | JSON | `english-vocab-progress.js` | 英语奖励状态 |
  | `petbank_learning_vocab_progress_{profileId}` | JSON | `english-vocab-progress.js` | 英语显式 Profile 进度；每张卡记录 `seen/correct/wrong/streak/status/repetitions/intervalDays/ease/lapses/dueAt/lastReviewedAt/lastGrade/hintUsed/responseMode/lastResponseMs/lastReviewId` 以及 `schedulerVersion/stabilityDays/difficulty/retrievability`，旧 SM-2 数据读取时迁移并标记 `schedulerMigration=sm2-to-fsrs5`；按 Profile 隔离并进入快照 |
  | `petbank_learning_english_rewards_{profileId}` | JSON | `english-vocab-progress.js` | 英语显式 profile scope，当前主读写键 |
  | `petbank_learning_vocab_review_events_{profileId}` | JSON array | `english-vocab-progress.js` | Profile 作用域的最近复习事件（最多保留 365 条）；记录 `reviewId/cardId/grade/correct/reviewedAt/localDate/dueAt/status/intervalDays/schedulerVersion/elapsedDays/previousStabilityDays/previousDifficulty/previousRetrievability/stabilityDays/difficulty/retrievability/lapses/hintUsed/responseMode/responseMs`，用于 7 日复习报告、FSRS 校准和幂等重试，不是积分账本；词卡跨设备合并按 `reviewId` 去重。代码中的无后缀基键仅作 scope 前缀，不直接写入 |
  | `petbank_learning_vocab_scheduler_calibration_{profileId}` | JSON object | `english-vocab-progress.js` | FSRS-5 + 艾宾浩斯 Profile 校准结果 `{algorithm,sampleSize,observedRetention,targetRetention,calibrated,confidence,minimumReviews,minimumTransitions,parametersReady,parameterCalibration,ebbinghaus,updatedAt}`；达到 20 条有效 review event 且至少 5 次同卡复习转移后用受限坐标下降拟合 19 个 FSRS 权重和 `R(t)=exp(-lambda*t)`，调度器仅在 `parametersReady`/拟合字段有效时采用参数；云端词卡合并后会标记 `needsRecalibration`，积分/宠物冲突仍不自动合并；按 Profile 隔离并进入快照。代码中的无后缀基键仅作 scope 前缀，不直接写入 |
| `petbank_english_vocab_scope_migration_v2_{id}` | flag | `english-vocab-progress.js` | 固定旧键迁移标记 |
| `petbank_hanzi_progress_{id}` | JSON | `hanzi-progress.js` | 汉字 profile 进度 |
| `petbank_learning_arcade_progress`、`petbank_learning_arcade_settings` | JSON | `app.js`/学习机桥 | 独立学习机结果与设置 |
| `petbank_learning_arcade_word_shooter_progression_v1` | JSON object | `prj/学习机玩法原型/game.js` | 飞机大战独立机库存档：`version/level/experience/starDust/totalRuns/selectedShip/equippedWeapon/shipUpgrades`；当前原型 scope，损坏时回退默认值，不进入主站积分账本 |
  | `petbank_pixel_worlds_progress_v1` | JSON | `js/pixel-story-engine.js` | 三世界像素故事与 20 个侦探小游戏进度（`schemaVersion/storyId/chapters`）；认字内容不产生答题统计，按 Profile 快照隔离。旧 `petbank_pixel_story_progress_v1` 保留用于 04 故事包兼容回退 |
  | `petbank_minecraft_vocab_session_v1_*` | JSON object | `minecraft-vocab-session.js` | 主站 Minecraft 单词远征的 Profile 会话状态；按 Profile 隔离，不进入主站积分账本；完整 Anki 工作台仍独立部署 |
  | `petbank_minecraft_vocab_level_v1` | string | `minecraft-vocab-page.js` | 阶段选择键前缀；实际运行键带 Profile 后缀 |
  | `petbank_minecraft_vocab_level_v1_*` | string | `minecraft-vocab-page.js` | Minecraft 单词远征的学习阶段选择；按 Profile 隔离，默认 `kindergarten`，不进入积分账本 |
  | `petbank_minecraft_vocab_band_v1_*` | string | `minecraft-vocab-page.js` | Minecraft 初级内部层级选择；按 Profile 隔离，默认 `minecraft-core`，用于把 2039 张初级词卡拆成常用核心、基础、建造、生物、世界、进阶六层；不进入积分账本 |
  | `petbank_minecraft_expedition_state_v2_*` | JSON object | `minecraft-vocab-expedition.js` | Minecraft 单词远征营地/地图节点状态；按 Profile 隔离，记录节点状态、当前节点、已清除任务、区域印章、`wordCardIds` 词卡收藏、经验等级、能力道具和 Boss 战斗结果，进入 Profile 快照但不单独记积分；词卡熟练度仍由英语进度键维护；读取旧 v1 状态兼容升级 |
  | `petbank_minecraft_expedition_state_v2` | JSON object | `minecraft-vocab-expedition.js` | 远征状态键前缀；实际运行键带 Profile 后缀 |
  | `petbank_minecraft_expedition_state_v1_*` | JSON object | `minecraft-vocab-expedition.js` | 旧版 Minecraft 单词远征状态；仅用于 v2 首次读取迁移，不再写入 |
| `petbank_picturebook_progress_v1` | JSON | `js/picturebooks.js` | 当前 Profile 的绘本阅读进度；`{schemaVersion:1,books:{storyId:{currentPage,completedCount,lastReadAt,lastCompletedAt,completionEventId,rewardClaimed}}}`，首读奖励由核心 receipt 去重 |
| `petbank_picturebook_library_v1` | JSON | `js/picturebooks.js` | 当前 Profile 的收藏偏好；`{schemaVersion:1,favorites:string[]}` |

英语当前采用显式 profile 后缀并保留旧固定键迁移；不能删除旧键直到迁移窗口和回滚验证完成。`mastered` 目前仍主要是短时连续答对语义，不能把它当作跨日保持证明。复习报告使用事件日志重算近 7 日复习量、正确率、题型表现和薄弱卡；FSRS-5 使用官方 19 参数、儿童学习步骤和基于事件的目标保持率校准。跨设备冲突只对词卡进度和 review events 自动合并，其他业务键不一致时仍进入家长人工冲突处理。

## 6. 玩法与设备设置

| Key/家族 | Owner | 备注 |
| --- | --- | --- |
| `petbank_math_difficulty`、`petbank_math_high_score` | `math-pk.js` | 难度与最高分 |
| `petbank_math_support_progress`、`petbank_math_support_selected`、`petbank_math_support_unlocks` | `math-pk.js` | 数学支援卡状态 |
| `petbank_arena_progress`、`petbank_arena_battle_day_{date}` | 竞技场 UI | 卡牌进度与每日限制 |
| `petbank_lb_{gameId}` | `leaderboard.js` | 本机 profile 成绩，gameId 必须受控 |
| `petbank_sfx_volume`、`petbank_sfx_muted` | `sfx.js` | 设备偏好，不应进入孩子云快照 |
| `petbank_advanced_tools`、`petbank_parent_admin_tools` | `tools.js`/设置 | 家长/设备工具开关，scope 需明确 |
| `petbank_pomodoro_today` | `tools.js` | 番茄钟本地日状态 |

设备设置、家长设置、孩子成长状态和未来认证/云配置不能只靠同一个 `petbank_` 前缀区分；registry 必须补充 scope。

## 7. 迁移与验证

新增或改动 key 时必须说明：

1. owner 和所有读写者。
2. JSON/schema/version 和默认值。
3. profile scope、设备/家长 scope、是否进入快照。
4. 旧 key 读取、一次性迁移、回滚和损坏数据行为。
5. 对应测试：每日状态、英语 profile、奖励 receipt、Profile round-trip 或业务专项测试。

当前运行时已先采用“显式排除 + 未知默认纳入”的过渡策略。下一步应继续补齐 key owner/schema，并在覆盖率和迁移验证充分后，再把 Profile 和未来云快照收口到显式白名单。
