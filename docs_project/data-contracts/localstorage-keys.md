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
| `petbank_learning_vocab_progress_{profileId}` | JSON | `english-vocab-progress.js` | 英语显式 profile scope，当前主读写键 |
| `petbank_learning_english_rewards_{profileId}` | JSON | `english-vocab-progress.js` | 英语显式 profile scope，当前主读写键 |
| `petbank_english_vocab_scope_migration_v2_{id}` | flag | `english-vocab-progress.js` | 固定旧键迁移标记 |
| `petbank_hanzi_progress_{id}` | JSON | `hanzi-progress.js` | 汉字 profile 进度 |
| `petbank_learning_arcade_progress`、`petbank_learning_arcade_settings` | JSON | `app.js`/学习机桥 | 独立学习机结果与设置 |

英语当前采用显式 profile 后缀并保留旧固定键迁移；不能删除旧键直到迁移窗口和回滚验证完成。`mastered` 目前仍主要是短时连续答对语义，不能把它当作跨日保持证明。

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
