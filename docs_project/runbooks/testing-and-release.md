# 运行与验证入口

> 最后更新: 2026-07-08
> 目的: Codex/Claude 修改代码后知道怎么验证

---

## 本地启动

### 方式 1: 批处理（Windows）

```
启动服务.bat
→ 启动 python http.server 8765
→ 自动打开浏览器 http://127.0.0.1:8765/
```

### 方式 2: 命令行（跨平台）

```bash
cd 宠物积分系统/
python -m http.server 8765 --bind 127.0.0.1
# 然后浏览器打开 http://127.0.0.1:8765/
```

### 为什么必须用 http server

项目使用 `fetch()` 加载 `data/` JSON 文件。`file://` 协议下 fetch 会被浏览器拦截（CORS）。
探索场景的故事加载也会失败，提示"请用本地服务器打开"。

---

## 验证入口

### 全量回归（推荐）

```bash
cd 宠物积分系统/
node scripts/run-full-regression.mjs
```

覆盖 44 项测试：
- `prj/regression_runner_contract.test.mjs` — 回归合约
- `prj/runtime_loader_route_base_contract.test.mjs` — Runtime Loader 路由基准合约
- `prj/audio_battle_feedback_contract.test.mjs` — 音频/战斗反馈
- `prj/test_homepage_focus_layout_contract.py` — 首页焦点 Hero 布局
- `prj/url_routing_and_settings_subpages.test.mjs` — 路由与设置子页
- `prj/top_nav_hub_menu.test.mjs` — 顶栏 Hub 菜单关闭逻辑
- `prj/parent_settings_sections_contract.test.mjs` — 家长设置分区结构
- `prj/parent_management_hidden_interfaces.test.mjs` — 家长区隐藏管理入口
- `prj/mayihaoke_resource_snapshot_contract.test.mjs` — mayihaoke 资源快照
- `prj/pet_asset_integrity.test.mjs` — 宠物运行时图片资产完整性
- `prj/petbank_ui_alignment_regression.test.mjs` — 整站 UI 对齐回归
- `prj/math_pk_guided_feedback_contract.test.mjs` — 数学PK/探索小题引导式反馈
- `prj/math_pk_support_cards_contract.test.mjs` — 数学PK支援卡与奖励星轨
- `prj/playground_hanzi_hub.test.mjs` — 游乐场与汉字中心导航
- `prj/vocab_registry_contract.test.mjs` — 英语词库注册层
- `prj/word_memory_external_vocab_merge_contract.test.mjs` — 单词记忆外部词库合并
- `prj/gameplay_core_flows_simulation.mjs` — 核心玩法流程
- `prj/full_game_loop_simulation.mjs` — 完整游戏循环
- `prj/learning_and_card_progression_simulation.mjs` — 学习+卡牌进度
- `prj/hanzi_and_english_playground_simulation.mjs` — 汉字+英语游乐场
- `prj/exploration_battle_guided_feedback.test.mjs` — 探索战斗失败复盘
- `prj/pinyin_star_scout_voice_contract.test.mjs` — 拼音块原型本地语音链路
- `prj/word_memory_map_bomb_throw.test.mjs` — 单词记忆地图投掷
- `prj/word_memory_map_movement_fx.test.mjs` — 单词记忆地图移动动效
- `prj/word_memory_map_rewards_ui.test.mjs` — 单词记忆地图连击与任务条
- `prj/word_memory_map_voice_contract.test.mjs` — 单词记忆地图本地语音资产
- `prj/word_memory_map_voice_playback.test.mjs` — 单词记忆地图本地语音回放
- `prj/word_memory_map_walk_cycle.test.mjs` — 单词记忆地图角色走路循环
- `prj/word_memory_minecraft_adapter_contract.test.mjs` — 单词记忆 Minecraft 词库适配
- `prj/shared_prototype_voice_workflow.test.mjs` — 跨原型共享语音资产流程
- `prj/learning_arcade_hanzi_voice_reuse.test.mjs` — 学习机汉字语音复用
- `prj/exploration_story_and_state_resume_simulation.mjs` — 探索故事+状态恢复
- `prj/cloud_family_social_pk_simulation.mjs` — 云端家庭社交PK
- `prj/walk_page_standalone_simulation.mjs` — 遛弯页
- `prj/learning_center_deep_pages_simulation.mjs` — 学习中心深页
- `prj/pet_archive_standalone_simulation.mjs` — 宠物档案
- `prj/shop_inventory_standalone_simulation.mjs` — 商城背包
- `prj/local_profiles_standalone_simulation.mjs` — 本地Profile
- `prj/settings_parent_management_standalone_simulation.mjs` — 家长设置
- `prj/edge_states_standalone_simulation.mjs` — 边界状态
- `prj/leaderboard_standalone_simulation.mjs` — 排行榜
- `prj/test_cloud_contract_smoke.py` — 云端合约 smoke
- `prj/test_async_pk_contract.py` — 异步PK合约
- `prj/test_cloud_restore_contract.py` — 云端恢复合约

### 轻量 smoke（快速验证）

```bash
node scripts/smoke.mjs
```

### 学习中心专项

```bash
node scripts/learning-center-smoke.mjs
```

### 浏览器端验证

```bash
node scripts/playwright-browser.mjs
```

---

## 核心测试文件（prj/ 目录）

### 合约测试（contract .test.mjs）

| 文件 | 覆盖范围 |
|------|---------|
| `prj/regression_p1.test.mjs` | P1 回归 |
| `prj/runtime_loader_route_base_contract.test.mjs` | Runtime Loader 路由基准 |
| `prj/audio_battle_feedback_contract.test.mjs` | 音频战斗反馈 |
| `prj/test_homepage_focus_layout_contract.py` | 首页焦点 Hero 布局 |
| `prj/url_routing_and_settings_subpages.test.mjs` | 路由与设置子页 |
| `prj/top_nav_hub_menu.test.mjs` | 顶栏 Hub 菜单关闭逻辑 |
| `prj/parent_settings_sections_contract.test.mjs` | 家长设置分区结构 |
| `prj/parent_management_hidden_interfaces.test.mjs` | 家长区隐藏管理入口 |
| `prj/mayihaoke_resource_snapshot_contract.test.mjs` | mayihaoke 资源快照 |
| `prj/pet_asset_integrity.test.mjs` | 宠物运行时图片资产完整性 |
| `prj/petbank_ui_alignment_regression.test.mjs` | 整站 UI 对齐回归 |
| `prj/exploration_math_feedback.test.mjs` | 探索数学反馈 |
| `prj/exploration_battle_guided_feedback.test.mjs` | 探索战斗失败复盘 |
| `prj/math_pk_support_cards_contract.test.mjs` | 数学PK支援卡与奖励星轨 |
| `prj/playground_hanzi_hub.test.mjs` | 游乐场与汉字中心导航 |
| `prj/vocab_registry_contract.test.mjs` | 英语词库注册层 |
| `prj/word_memory_external_vocab_merge_contract.test.mjs` | 单词记忆外部词库合并 |
| `prj/pinyin_star_scout_voice_contract.test.mjs` | 拼音块原型本地语音链路 |
| `prj/word_memory_map_bomb_throw.test.mjs` | 单词记忆地图投掷 |
| `prj/word_memory_map_movement_fx.test.mjs` | 单词记忆地图移动动效 |
| `prj/word_memory_map_rewards_ui.test.mjs` | 单词记忆地图连击与任务条 |
| `prj/word_memory_map_voice_contract.test.mjs` | 单词记忆地图本地语音资产 |
| `prj/word_memory_map_voice_playback.test.mjs` | 单词记忆地图本地语音回放 |
| `prj/word_memory_map_walk_cycle.test.mjs` | 单词记忆地图角色走路循环 |
| `prj/word_memory_minecraft_adapter_contract.test.mjs` | 单词记忆 Minecraft 词库适配 |
| `prj/shared_prototype_voice_workflow.test.mjs` | 跨原型共享语音资产流程 |
| `prj/learning_arcade_hanzi_voice_reuse.test.mjs` | 学习机汉字语音复用 |
| `prj/math_pk_guided_feedback_contract.test.mjs` | 数学PK/探索小题引导式反馈 |
| `prj/math_pk_fx_contract.test.mjs` | 数学PK特效 |
| `prj/math_pk_character_assets.test.mjs` | 数学PK角色素材 |
| `prj/math_pk_multiplication_onboarding.test.mjs` | 乘法启蒙 |
| `prj/pet_card_image_loading_regression.test.mjs` | 宠物卡牌图片加载回归 |
| `prj/playground_hanzi_hub.test.mjs` | 游乐场汉字中心 |
| `prj/route_map_s1_multiring.test.mjs` | 路线地图S1 |
| `prj/task2_home_catalog.test.mjs` | 首页目录 |
| `prj/task3_shop_buy.test.mjs` | 商城购买 |
| `prj/task4_slot_compat.test.mjs` | 槽位兼容 |

### 模拟测试（simulation .mjs）

| 文件 | 覆盖范围 |
|------|---------|
| `prj/gameplay_core_flows_simulation.mjs` | 核心玩法全流程 |
| `prj/full_game_loop_simulation.mjs` | 完整游戏循环 |
| `prj/learning_and_card_progression_simulation.mjs` | 学习+卡牌 |
| `prj/hanzi_and_english_playground_simulation.mjs` | 汉字+英语 |
| `prj/exploration_story_and_state_resume_simulation.mjs` | 探索故事 |
| `prj/cloud_family_social_pk_simulation.mjs` | 云端社交PK |
| `prj/walk_page_standalone_simulation.mjs` | 遛弯 |
| `prj/learning_center_deep_pages_simulation.mjs` | 学习中心 |
| `prj/pet_archive_standalone_simulation.mjs` | 宠物档案 |
| `prj/shop_inventory_standalone_simulation.mjs` | 商城背包 |
| `prj/local_profiles_standalone_simulation.mjs` | 本地Profile |
| `prj/settings_parent_management_standalone_simulation.mjs` | 家长设置 |
| `prj/edge_states_standalone_simulation.mjs` | 边界状态 |
| `prj/leaderboard_standalone_simulation.mjs` | 排行榜 |

---

## 修改后验证速查

| 改了什么 | 跑什么 |
|---------|--------|
| app.js（任务/积分/路由） | `regression_p1.test.mjs` + `test_homepage_focus_layout_contract.py` + `url_routing_and_settings_subpages.test.mjs` + `top_nav_hub_menu.test.mjs` + `playground_hanzi_hub.test.mjs` + `gameplay_core_flows_simulation.mjs` |
| pet.js（宠物养成） | `pet_card_image_loading_regression.test.mjs` + `pet_archive_standalone_simulation.mjs` |
| `data/pets.json`（宠物运行时资源） | `pet_asset_integrity.test.mjs` |
| home.js（宠物小屋） | `edge_states_standalone_simulation.mjs` |
| `index.html` + `css/style.css`（家长设置结构） | `parent_settings_sections_contract.test.mjs` + `parent_management_hidden_interfaces.test.mjs` |
| mayihaoke 外部学习资源快照 | `mayihaoke_resource_snapshot_contract.test.mjs` |
| 全局页面对齐 / 图片懒加载 / 卡牌详情 | `petbank_ui_alignment_regression.test.mjs` |
| exploration.js（探索） | `exploration_battle_guided_feedback.test.mjs` + `exploration_math_feedback.test.mjs` + `exploration_story_and_state_resume_simulation.mjs` |
| `data/vocab/english-minecraft/*`（英语词库注册层） | `vocab_registry_contract.test.mjs` |
| `prj/拼音块收集台原型/game.js`（拼音块原型） | `pinyin_star_scout_voice_contract.test.mjs` + `prj/拼音块收集台原型/verify.mjs` |
| `prj/单词记忆射击场原型/game.js`（单词记忆地图） | `word_memory_map_bomb_throw.test.mjs` + `word_memory_map_movement_fx.test.mjs` + `word_memory_map_rewards_ui.test.mjs` + `word_memory_map_voice_contract.test.mjs` + `word_memory_map_voice_playback.test.mjs` + `word_memory_map_walk_cycle.test.mjs` + `word_memory_minecraft_adapter_contract.test.mjs` + `prj/单词记忆射击场原型/verify.mjs` |
| `data/vocab/word-memory-combined/*`（单词记忆外部词库层） | `word_memory_external_vocab_merge_contract.test.mjs` + `word_memory_minecraft_adapter_contract.test.mjs` |
| `prj/学习机玩法原型/game.js`（学习机原型） | `learning_arcade_hanzi_voice_reuse.test.mjs` + `prj/学习机玩法原型/verify.mjs` + `prj/学习机玩法原型/scripts/test-full-prototype-smoke.mjs` |
| `prj/prototype-voice-workflow/`（共享语音流水线） | `shared_prototype_voice_workflow.test.mjs` |
| card-arena/collection（卡牌） | `task4_slot_compat.test.mjs` + `learning_and_card_progression_simulation.mjs` |
| math-pk.js（数学PK） | `math_pk_guided_feedback_contract.test.mjs` + `math_pk_support_cards_contract.test.mjs` + `math_pk_fx_contract.test.mjs` + `math_pk_character_assets.test.mjs` + `math_pk_multiplication_onboarding.test.mjs` |
| learn-center.js（学习中心） | `learning-center-smoke.mjs` |
| cloud-*.js（云端） | `cloud_family_social_pk_simulation.mjs` |
| shop/inventory（商城） | `task3_shop_buy.test.mjs` + `shop_inventory_standalone_simulation.mjs` |
| profiles.js（多孩子） | `local_profiles_standalone_simulation.mjs` |
| 全局改动 | `run-full-regression.mjs` |
