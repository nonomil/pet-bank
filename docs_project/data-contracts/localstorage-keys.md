# localStorage Key 清单

> 所有 `petbank_*` 前缀的 localStorage key 及其读写者。
> 新增 key 必须先在此注册。

## Key 总览

| Key | 类型 | 写入者 | 读取者 | 说明 |
|-----|------|--------|--------|------|
| `petbank_points` | number | app.js:162 | app.js:166,342, exploration.js:151,331 | 总积分 |
| `petbank_completed` | JSON array | app.js:163 | app.js:167 | 已完成任务 ID 集合 |
| `petbank_tasks_completed_today` | number | app.js:169,188,629 | treasure.js:43 | 今日完成任务数 |
| `petbank_pet` | JSON | pet.js:110 | pet.js:90 | 宠物完整状态 |
| `petbank_inventory` | JSON | inventory.js:38 | inventory.js:25 | 背包物品堆叠 |
| `petbank_cards` | JSON | card-collection.js:658 | card-collection.js:649, card-arena-ui.js:379 | 已收集卡牌 |
| `petbank_awarded_series` | JSON array | card-collection.js:685 | card-collection.js:682 | 已领取套票奖励 |
| `petbank_starter_cards` | flag | app.js:1126 | app.js:1117 | 新手卡牌已发放 |
| `petbank_walk_data` | JSON | walk.js:103 | walk.js:90,101, app.js:1504 | 遛弯数据 |
| `petbank_walk_logs` | JSON array | walk.js:113 | walk.js:117 | 遛弯日志 |
| `petbank_home_state` | JSON | home.js:122 | home.js:47 | 小屋家具摆放 |
| `petbank_home_furniture` | JSON array | home.js:125 | home.js:62 | 已拥有家具 |
| `petbank_unlocked_scenes` | JSON | exploration.js:120 | exploration.js:113 | 已解锁探索场景 |
| `petbank_chests` | JSON | treasure.js:17 | treasure.js:28 | 宝箱库存 |
| `petbank_daily_claim_date` | string | treasure.js:112 | treasure.js:36 | 日常宝箱领取日期 |
| `petbank_claimed_milestones` | JSON array | treasure.js:64 | treasure.js:54 | 已领取里程碑 |
| `petbank_learning_catalog_state` | JSON | learn-center.js:75 | learn-center.js:66 | 学习目录状态 |
| `petbank_learning_progress` | JSON | learn-center.js:75 | learn-center.js:66 | 学习进度 |
| `petbank_learning_rewards` | JSON | learn-center.js:75 | learn-center.js:66 | 学习奖励 |
| `petbank_learning_quiz_attempts` | JSON | learn-center.js:75 | learn-center.js:66 | 测验记录 |
| `petbank_learning_print_prefs` | JSON | learn-center.js:75 | learn-center.js:66 | 打印偏好 |
| `petbank_learning_daily_sheet` | JSON | learn-center.js:75 | learn-center.js:66 | 每日学习单 |
| `petbank_learning_sheet_mode` | string | learn-center.js:75 | learn-center.js:66 | 学习单模板 |
| `petbank_learning_vocab_focus` | JSON | learn-center.js:75 | learn-center.js:66 | 词汇焦点 |
| `petbank_cloud_config` | JSON | cloud-client.js:94,101 | cloud-client.js:15 | 云端配置（持久化） |
| `petbank_custom_items` | JSON array | app.js:495,588 | app.js:474 | 自定义积分兑换项 |
| `petbank_hanzi_progress` | JSON | hanzi-progress.js:39 | hanzi-progress.js:28 | 汉字学习进度 |
| `petbank_english_vocab_progress` | JSON | english-vocab-progress.js:20 | english-vocab-progress.js:11 | 英语词汇进度 |
| `petbank_mathpk_*` | JSON | math-pk.js (多处) | math-pk.js (多处) | 数学PK数据（多key） |
| `petbank_leaderboard_*` | JSON | leaderboard.js:42 | leaderboard.js:28 | 排行榜（多key，按gameId） |
| `petbank_social_local_visits` | JSON | social.js:177 | social.js:168,173 | 本地串门记录 |
| `petbank_sfx_volume` | number | sfx.js:180 | sfx.js:41 | 音效音量 |
| `petbank_sfx_muted` | flag | sfx.js:176 | sfx.js:43 | 音效静音 |
| `petbank_advanced_tools` | flag | tools.js:552,557 | tools.js:29 | 高级工具开关 |
| `petbank_family_members` | JSON | tools.js:49 | tools.js:38 | 家庭成员 |
| `petbank_pomodoro_today` | number | tools.js:50 | tools.js:42 | 今日番茄钟数 |

## Profile 管理键（ProfileManager 专用）

| Key | 类型 | 说明 |
|-----|------|------|
| `petbank_profiles_meta` | JSON array | 所有 profile 元数据 `[{id,name,emoji,createdAt}]` |
| `petbank_active_profile` | string | 当前活跃 profile id |
| `petbank_profile_data_{id}` | JSON | 该 profile 所有业务键的快照 `{key: value}` |

## 命名规范

- 所有业务键必须以 `petbank_` 开头
- Profile 快照键格式：`petbank_profile_data_{profileId}`
- 模块私有键建议加模块前缀，如 `petbank_learning_*`、`petbank_mathpk_*`
- 严禁在 `petbank_profile_data_*` 和 `petbank_profiles_meta`/`petbank_active_profile` 之外创建不以 `petbank_` 开头的键

## 跨模块共享键（高风险）

以下键被多个模块直接读写，修改时需检查所有读写者：

| Key | 共享模块 |
|-----|---------|
| `petbank_points` | app.js, exploration.js |
| `petbank_tasks_completed_today` | app.js, treasure.js |
| `petbank_cards` | card-collection.js, card-arena-ui.js |
| `petbank_walk_data` | walk.js, app.js |
