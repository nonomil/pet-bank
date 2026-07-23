# 独立项目拆分盘点

> 盘点日期：2026-07-24
>
> 本文记录当前工作树的事实，不表示任何迁移已经完成。拆分阶段默认只读、复制和双运行；在独立项目通过验证前，不删除或覆盖主站实现。

## 1. 当前项目快照

| 项目 | 当前状态 | 关键事实 | 当前 Git 状态 |
| --- | --- | --- | --- |
| `G:\StudyCode\宠物积分系统` | 主站完整运行 | Vanilla JS SPA；入口、Profile、积分、宠物、家长区和多个学习/游戏页面仍在同一站点 | `main`，扫描时有 35 个变更项 |
| `G:\StudyCode\绘本项目` | 已独立并发布 | Vite 项目；独立内容构建、阅读器、按 `profileRef` 分区的收藏/进度、`postMessage` 桥接和项目互链页脚；发布制品仓库 `nonomil/picturebook-library` | Pages：`https://nonomil.github.io/picturebook-library/` |
| `G:\StudyCode\卡片式单词学习游戏记忆系统` | 已独立并发布 | 独立词库、Profile、复习、游戏适配器、静态制品、资源同步、奖励桥接和项目互链页脚；发布制品仓库 `nonomil/word-quest-learning-game` | Pages：`https://nonomil.github.io/word-quest-learning-game/` |
| `G:\StudyCode\学习中心` | 已建立并发布独立静态项目 | 独立 hub、精选学习包、本地进度、打印页、项目互链和 `PetBank Bridge v1` 完成回传；开发端口 `7001` | Pages：`https://nonomil.github.io/learning-center/` |
| `G:\StudyCode\小游戏项目` | 已建立并发布独立静态项目 | 独立 hub、汉字泡泡跑酷、拼音星际巡航、项目专属资源、项目互链和 `PetBank Bridge v1` 转发；开发端口 `7003` | Pages：`https://nonomil.github.io/mini-games/` |

两个已有独立仓库和主站都有大量未提交内容。后续工作不得用清理、重置或整目录复制的方式处理这些变更。

## 2. 模块归属清单

| 业务域 | 当前实现位置 | 目标项目 | 当前处理 | 迁移前置条件 |
| --- | --- | --- | --- | --- |
| 总入口、孩子 Profile、家长区、任务、积分、奖励、宠物、小屋、商城、背包 | `index.html`、`js/app.js`、`js/profiles.js`、`js/parent-account.js`、`js/pet.js`、`js/home.js`、`js/shop.js`、`js/inventory.js` | 宠物积分系统 | 保留 | 只新增外部项目入口，不改变主账本 |
| 宠物故事探索、旅行记忆、卡牌收集/对战 | `js/exploration*.js`、`js/travel-memory.js`、`js/card-collection.js`、`js/card-arena*.js` | 宠物积分系统 | 暂时保留 | 后续按宠物成长闭环单独评估，不与普通小游戏混搬 |
| 绘本 portal 和外部奖励宿主 | `js/picturebook-external-bridge.js`、`data/picturebooks/portal.json`、`data/picturebooks/portal-catalog.json` | 宠物积分系统 | 已接入 | 继续保留主站兼容入口；独立 Pages 已回归 |
| 绘本目录、阅读器、内容和本地进度 | 主站 `js/picturebooks.js`、`data/picturebooks/`；独立项目 `G:\StudyCode\绘本项目\src`、`content` | 绘本项目 | 独立项目已存在，主站仍有旧实现 | 独立站构建、桥接和浏览器验证通过后再切外链 |
| 单词卡、词库、复习路线和英语单词游戏 | 主站 `js/minecraft-vocab-*.js`、`app/playground/word-memory-map`、`app/playground/typing-defense`、部分 `prj`；独立项目 `G:\StudyCode\卡片式单词学习游戏记忆系统` | 卡片式单词学习游戏记忆系统 | 独立项目已存在，主站仍有重复运行时 | 补主站启动桥接；统一 `profileRef`；确认独立项目奖励不再冒充主站积分 |
| 课程、学习包、学习计划、学习课、打印和学习单 | 主站 `js/learn-center.js`、`index.html` 中 `learn-*`/`learning-sheet` 容器、`data/learn` | 学习中心 | 目标目录为空，尚未迁移 | 先建立独立项目骨架和内容白名单，不直接搬主站目录 |
| 数学 PK、汉字游戏、短局拼音/反应玩法 | 主站 `js/math-pk.js`、`js/hanzi-game.js`、`app/playground`、部分 `prj` | 小游戏项目 | 目标目录为空，尚未迁移 | 先按“是否产生课程/词卡进度”分流；需要词卡的玩法归单词项目 |

## 3. 已存在的桥接能力与缺口

### 绘本

- 主站 `data/picturebooks/portal.json` 已指向独立绘本站：`https://nonomil.github.io/picturebook-library/`。
- 主站通过 `sessionStorage` 保存 `launchId` 和书目，独立站通过 URL hash 读取 `petbankLaunch`。
- 独立站通过 `postMessage` 回传 `bookId`、`completionId` 和完成时间。
- 主站会校验来源、会话有效期和重复领取，再经 `CoreRewardService` 发放奖励。
- 独立站存储键 `picturebook_library_progress_v1` 和 `picturebook_library_preferences_v1` 已按 `profileRef` 分区；主站通过 URL hash 传递匿名档案引用。
- 独立站页脚提供主站、学习中心、单词远征和小游戏项目的新窗口链接；四个正式 URL 已写入发布制品并逐一返回 HTTP 200。

### 单词

- 独立项目已经有自己的 Profile 选择器和 `wordquest_active_profile`。
- 独立项目拥有自己的学习进度和奖励状态；`scripts/sync-from-petbank.mjs` 是构建期白名单同步，不是运行时依赖。
- 独立单词项目已经通过 `petbank.bridge.v1` 向主站回传完成事件，主站统一发放成长分和宠物经验。
- 独立单词项目页脚提供主站、学习中心、绘本馆和小游戏项目的新窗口链接；本地开发时使用各项目独立端口。
- 主站内部仍有 `petbank_minecraft_*` 和其他单词玩法状态，不能在没有迁移映射和回归测试时删除。

### 学习中心和小游戏

- 两个目录已经建立独立入口并发布；本地开发端口分别为 `7001` 和 `7003`，生产地址分别为 `https://nonomil.github.io/learning-center/` 和 `https://nonomil.github.io/mini-games/`。
- 学习中心只复制精选学习包和运行所需数据；小游戏只复制两个原型的运行文件和必要资源，没有复制主站 `js/`、`data/` 或 `prj/` 整目录。
- 两个项目都使用自己的 localStorage 命名空间，并通过 hub 转发完成事件；主站仍是唯一成长积分账本。
- 两个项目的 hub 均提供其他独立项目链接，具体小游戏仍由 hub 新窗口打开，不嵌入主站。

## 4. 数据所有权规则

1. 宠物积分系统是唯一的成长积分账本所有者。子项目不能直接写 `petbank_points`，也不能自行决定主站积分数。
2. 子项目拥有自己的内容和学习进度，并使用项目命名空间的 localStorage 键。
3. 从主站启动时，子项目使用匿名 `profileRef` 对本地进度分区；直接打开时使用自己的默认档案。
4. `launchId` 只负责一次启动会话，`completionId` 负责完成事件幂等；主站必须同时校验来源、项目、档案和事件类型。
5. 构建期资源同步必须使用 manifest 白名单。研究资料、缓存、原始生成素材、账号配置和后端数据库不得进入子项目运行制品。

## 5. 禁止动作

- 不删除主站绘本、单词、学习或小游戏实现，直到对应独立站完成发布和浏览器回归。
- 不覆盖 `G:\StudyCode\绘本项目`、`G:\StudyCode\卡片式单词学习游戏记忆系统` 的未提交修改。
- 不把 `G:\StudyCode\宠物积分系统\prj` 整体复制到任何新项目。
- 不把 `petbank_points`、账号凭证、Profile 快照或自托管数据库同步到子项目。
- 不把本地开发端口当作生产地址；发布制品更新后必须重新验证 Pages 首页、配置资源和桥接。

## 6. 后续顺序

1. 保持已验证的 `PetBank Bridge v1`：启动参数、`profileRef`、完成事件、奖励结果和来源校验。
2. 保留绘本和单词项目的独立内容、Profile 与主站兼容入口；不要在未完成发布切换前删除主站重复运行时。
3. 四个生产地址和发布制品仓库已确定；后续只通过各项目制品组装流程更新，不把原始素材目录整体推送到 Pages 仓库。
4. 对每个项目继续完成独立构建、静态发布、深层链接、移动端、互链和桥接回归；在回归稳定前不清理主站重复 bundle。
