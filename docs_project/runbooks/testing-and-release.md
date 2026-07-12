# 运行与验证入口

> 最后更新: 2026-07-12
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

成长报告导航专项契约：

```bash
node prj/growth_review_insights_contract.test.mjs
```

该测试覆盖有历史卡点时的玩法聚合、最新下一步策略，以及无记录空态。

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

覆盖 35 项当前仓库中存在、且由当前版本回归入口实际执行的测试。入口会先检查测试文件存在、无遗留账号运行时门禁、每项最多执行 120 秒，失败时停止并显示具体任务。静态 Pages 入口当前为 39 条，已移除的好友串门路径不再生成：

```text
node scripts/test-regression-runner-integrity.mjs
node prj/runtime_loader_route_base_contract.test.mjs
node prj/route_aware_shell_contract.test.mjs
node prj/profile_isolation_journey_simulation.mjs
node prj/growth_review_insights_contract.test.mjs
node --test prj/petbank-server/test/config.test.mjs
node --test prj/petbank-server/test/database.test.mjs
node prj/单词记忆射击场原型/verify.mjs
node prj/学习机玩法原型/verify.mjs
node prj/学习机玩法原型/scripts/test-full-prototype-smoke.mjs
node prj/消灭苦力怕打字游戏/web/verify.mjs
node prj/消灭苦力怕打字游戏/web/simulate.mjs
node scripts/test-child-journey-feedback.mjs
node scripts/test-child-journey-home.mjs
node scripts/test-core-reward-feedback.mjs
node scripts/test-core-reward-policy.mjs
node scripts/test-core-reward-presentation.mjs
node scripts/test-daily-state.mjs
node scripts/test-english-vocab-profile-scope.mjs
node scripts/test-game-reward-receipts.mjs
node scripts/test-narrative-closure.mjs
node scripts/test-no-legacy-account-runtime.mjs
node scripts/test-pages-fast-gate-contract.mjs
node scripts/test-pet-adventure-retention.mjs
node scripts/test-pet-care-daily-state.mjs
node scripts/test-pet-growth-feedback.mjs
node scripts/test-pet-growth-history.mjs
node scripts/test-playground-entry-shell.mjs
node scripts/test-repository-boundaries.mjs
node scripts/test-short-travel-chapter-browser.mjs
node scripts/test-static-route-entries.mjs
node scripts/test-task-reward-events.mjs
node scripts/test-travel-memory-assets.mjs
node scripts/test-travel-memory-browser.mjs
node scripts/test-travel-memory-real-journey.mjs
```

浏览器测试产生的截图统一写入 `tmp/test-artifacts/`，默认不修改 `docs/releases/`。需要导出临时证据时可设置 `PETBANK_TEST_ARTIFACT_DIR`。

当前版本的验证边界是本地-only 前端与自托管后端骨架；未实现的账号、家庭、快照和社交能力不作为已上线能力。

### 轻量 smoke（快速验证）

```bash
node scripts/smoke.mjs
```

### GitHub Pages 快速发布门禁

GitHub Pages 发布会在组装静态制品前运行以下无需本地服务的门禁；任一失败都会阻止制品上传与部署。该门禁不运行要求本地 HTTP 服务的全量回归。

```bash
node --check js/app.js
node scripts/test-static-route-entries.mjs
node prj/runtime_loader_route_base_contract.test.mjs
node prj/route_aware_shell_contract.test.mjs
node prj/profile_isolation_journey_simulation.mjs
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
| `prj/minecraft_vocab_selector_contract.test.mjs` | Minecraft 词库选择器 |
| `prj/minecraft_vocab_views_contract.test.mjs` | Minecraft 词库视图 |
| `prj/minecraft_core_vocab_expansion_contract.test.mjs` | Minecraft 核心词库扩展 |
| `prj/learning_center_english_quiz_vocab_contract.test.mjs` | 学习中心英语 quiz 数据 |
| `prj/word_memory_external_vocab_merge_contract.test.mjs` | 单词记忆外部词库合并 |
| `prj/word_memory_world_pack_selector.test.mjs` | 单词记忆地图主题选择器 |
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
| `data/vocab/english-minecraft/views/*`（Minecraft 词库选择与视图） | `minecraft_vocab_selector_contract.test.mjs` + `minecraft_vocab_views_contract.test.mjs` + `minecraft_core_vocab_expansion_contract.test.mjs` + `learning_center_english_quiz_vocab_contract.test.mjs` |
| `prj/拼音块收集台原型/game.js`（拼音块原型） | `pinyin_star_scout_voice_contract.test.mjs` + `prj/拼音块收集台原型/verify.mjs` |
| `prj/单词记忆射击场原型/game.js`（单词记忆地图） | `word_memory_map_bomb_throw.test.mjs` + `word_memory_map_movement_fx.test.mjs` + `word_memory_map_rewards_ui.test.mjs` + `word_memory_map_voice_contract.test.mjs` + `word_memory_map_voice_playback.test.mjs` + `word_memory_map_walk_cycle.test.mjs` + `word_memory_minecraft_adapter_contract.test.mjs` + `word_memory_world_pack_selector.test.mjs` + `prj/单词记忆射击场原型/verify.mjs` |
| `data/vocab/word-memory-combined/*`（单词记忆外部词库层） | `word_memory_external_vocab_merge_contract.test.mjs` + `word_memory_minecraft_adapter_contract.test.mjs` |
| `prj/学习机玩法原型/game.js`（学习机原型） | `learning_arcade_hanzi_voice_reuse.test.mjs` + `prj/学习机玩法原型/verify.mjs` + `prj/学习机玩法原型/scripts/test-full-prototype-smoke.mjs` |
| `prj/prototype-voice-workflow/`（共享语音流水线） | `shared_prototype_voice_workflow.test.mjs` |
| card-arena/collection（卡牌） | `task4_slot_compat.test.mjs` + `learning_and_card_progression_simulation.mjs` |
| math-pk.js（数学PK） | `math_pk_guided_feedback_contract.test.mjs` + `math_pk_support_cards_contract.test.mjs` + `math_pk_fx_contract.test.mjs` + `math_pk_character_assets.test.mjs` + `math_pk_multiplication_onboarding.test.mjs` |
| learn-center.js（学习中心） | `learning-center-smoke.mjs` |
| `prj/petbank-server/`（SQLite API） | `node --test prj/petbank-server/test/*.test.mjs` |
| shop/inventory（商城） | `task3_shop_buy.test.mjs` + `shop_inventory_standalone_simulation.mjs` |
| profiles.js（多孩子） | `local_profiles_standalone_simulation.mjs` |
| 全局改动 | `run-full-regression.mjs` |
