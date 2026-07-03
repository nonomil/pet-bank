# 🎡 汉字游乐场（专题）

> 把参考案例「汉字游乐场」的答题卡片游戏 + 本地排行榜，合入本项目「萌宠冒险岛」形成的功能专题。
> 来源：[../参考案例/汉字游乐场.md](../参考案例/汉字游乐场.md) + [../参考案例/汉字游乐场-2.md](../参考案例/汉字游乐场-2.md)
> 状态：**E1-E4 已落地并通过真机验证（11/11 PASS）**；E5 生图 / E6 收口待做。

---

## 这个专题做了什么

参考案例是一个独立的汉语启蒙答题游戏。合入本项目时，识别出它真正的价值不是「再造一个游戏」，而是：

1. **补一个通用本地排行榜**（本项目此前完全空白）—— 跨玩法、按孩子隔离，「与自己赛跑」。
2. **给现有答题引擎喂汉字题库** —— 复用 math-pk 结算骨架，落地汉字四要素卡片玩法。
3. **HSK 3.0 词库体系化** —— 让汉字玩法有「考纲内核」，按 HSK 1 级出题。
4. **游乐场 Hub** —— 把数学 PK / 汉字 / 卡牌对战 / 排行榜 收拢到一个 tab。

---

## 文档清单（各个文档说明）

| 文档 | 类型 | 说明 | 状态 |
|---|---|---|---|
| [2026-07-02-汉字答题与排行榜-设计稿.md](./2026-07-02-汉字答题与排行榜-设计稿.md) | DESIGN 设计稿 | **为什么这样设计**：产品边界、交互流程、数据模型（排行榜存储 / 题库 schema）、备选方案权衡、HSK 词库(§10)、游乐场 hub(§11)、风险与回滚、验收标准、完整决议清单(§12)。读这个看全貌。 | E1-E4 已落地 |
| [2026-07-02-汉字答题与排行榜.md](./2026-07-02-汉字答题与排行榜.md) | PLAN 实施计划 | **怎么落地**：Leaderboard API 契约、题库 schema 详例、文件清单（新建/改动）、分步验证。读这个看改了哪些文件。 | P0-P1 已落地 |
| [../plans/2026-07-02-汉字拼音笔画学习系统-v2-design.md](../plans/2026-07-02-汉字拼音笔画学习系统-v2-design.md) | DESIGN V2 设计稿 | **下一阶段往哪里长**：汉字 + 拼音 + 笔画 + 到期复习系统，含开源参考（Hanzi Writer / Make Me a Hanzi / pinyin-pro / ts-fsrs）与网页端写字可行性判断。读这个看下一步。 | 新增 |
| [../参考案例/汉字游乐场.md](../参考案例/汉字游乐场.md) | 参考素材 | 原始博文①：卡片引擎跑通、交互闭环、本地排行榜、HSK 计划。 | 素材 |
| [../参考案例/汉字游乐场-2.md](../参考案例/汉字游乐场-2.md) | 参考素材 | 原始博文②：**卡片四要素（汉字+拼音+图片+例句）**、按进度动态生成、翻牌交互、SQLite。 | 素材 |

---

## 方案要点速览（5 个子方案）

1. **通用排行榜**（`js/leaderboard.js`）—— `record/getBest/getRecent/renderUI`，存储 key `petbank_lb_{gameId}_{profileId}`，最高分 + 最近 10 次 + sparkline，按孩子隔离；旧 `petbank_math_high_score` 幂等迁移。
2. **汉字答题玩法**（`js/hanzi-game.js`）—— 复用 math-pk 结算骨架（出题→判对错→计分→addGrowthPoints→入榜），UI/题库独立；两种模式：看拼音选字 / 例句填空。
3. **HSK 词库接入**（`data/hanzi-hsk.json`）—— HSK 3.0 Level 1 共 594 题（294 词组填空 + 300 单字看拼音选字）；`scripts/generators/gen_hanzi_hsk.py` 从 ivankra/hsk30 词表生成；`fill_hanzi_examples.py` 用 LLM（opencode.ai/zen + deepseek-v4-flash）补全单字例句 + 校准多音字 pinyin（594/594 完成）。
4. **游乐场 Hub**（`page-playground`）—— 替换原「更多」tab（works 页降级为子页、入口不丢），收拢数学 PK / 汉字 / 卡牌对战（`CardArenaUI.openStages()`）/ 排行榜 四入口；首页瘦身。
5. **生图（E5，待做）** —— 用 Agnes（agnes-image-2.1-flash）为汉字/词组生成儿童课本插图，替代当前 emoji；先 10 张验证风格。

---

## 已交付（代码 / 数据）

**前端**：`js/leaderboard.js` · `js/hanzi-game.js`（含 HSK 接入）· `css/leaderboard.css` · `css/hanzi-game.css` · `css/playground.css` · `index.html`（游乐场 tab + 首页瘦身）· `js/app.js`（路由 + PAGE_TO_TAB）· `js/math-pk.js`（排行榜接入）

**数据/脚本**：`data/hanzi-questions.json`（启蒙关 30 题）· `data/hanzi-hsk.json`（HSK1 共 594 题）· `scripts/generators/gen_hanzi_hsk.py` · `scripts/generators/fill_hanzi_examples.py` · `.env`（LLM token，已 gitignore）

**过程摘要**（临时，`.tmp/`）：`e1~e4-summary.md`、`e2-5-summary.md`、`e3-retry-summary.md`、`e4-shot-v2-*.png`（真机截图 14 张）

---

## 进度

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | 通用排行榜 + math-pk 接入 | ✅ 真机通过 |
| P1 | 汉字玩法（启蒙关 30 题） | ✅ 真机通过 |
| E1 | 游乐场 hub 导航重构 | ✅ 真机通过 |
| E2 | HSK1 题库骨架（594 题） | ✅ |
| E2.5 | hanzi-game 接入 HSK1 | ✅ 真机通过 |
| E3 | LLM 补单字例句 + pinyin 校准 | ✅ 594/594 |
| E4 | 真机集成验证 | ✅ 11/11 PASS |
| E5 | Agnes 生图（儿童课本插图） | ⏳ 先 10 张验证 |
| E6 | 收口（favicon + 积分页清理 + CHANGELOG + 状态翻正） | ⏳ |

---

## 当前能力与下一步

### 当前已经具备

1. 题卡玩法已接入轻量记忆状态机 `js/hanzi-progress.js`，支持 `new -> learning -> mastered`。
2. 当前出题已支持错题优先、局内去重、按孩子隔离进度。
3. 空等级开始已守卫，不再写入假的 `0` 分排行榜记录。

### 当前仍未覆盖

1. 还没有真正的“到期复习”调度，当前更像加权抽题。
2. 还没有笔画/写字台。
3. 拼音还没有独立玩法链路。
4. 阅读还没有按已学字做“子集阅读”。

这也是为什么专题下一阶段不建议继续只加题，而是按 V2 设计稿补齐课程闭环。

---

## 阅读建议

- **想看为什么这么设计 / 有哪些取舍** → 设计稿 §1-§5、§10、§11
- **想看改了哪些文件、API 契约** → 实施计划
- **想看决策怎么定的** → 设计稿 §12（完整决议清单）
- **想接手继续做（E5/E6）** → 本 README「已交付」+ 设计稿 §12 待执行项
- **想看真机跑起来什么样** → `.tmp/e4-shot-v2-*.png`
