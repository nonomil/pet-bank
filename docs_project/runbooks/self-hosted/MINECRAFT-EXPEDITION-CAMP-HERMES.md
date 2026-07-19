# Minecraft 单词远征营地 Hermes 验收手册

这份手册给 Hermes 或其他自动化部署代理使用。它描述当前已经实现的第一版营地闭环，不代表完整 Minecraft 游戏或完整 Anki 工作台已经迁移到主站。

## 当前实现边界

- 主站入口是孩子端主导航中与“探索”同级的 `单词远征 / Word Quest`；学习中心和今日页也提供同一 `minecraft-vocab` 路由的辅助入口。
- 营地地图数据在 `data/learn/minecraft-expedition/camp-regions.json`，当前是五段连续路线：草原小径、村庄门口、深层矿洞、下界传送门和末影龙竞技场。
- 幼儿园默认只开放草原小径；阶段提升后才会进入村庄、深层矿洞、下界和末影龙路线。当前页面已实现营地 → 双语故事 → 本章词卡 → 轻量战斗 → 章节结算 → 返回营地。
- Profile 隔离状态由 `js/minecraft-vocab-expedition.js` 写入 `petbank_minecraft_expedition_state_v2_{profileId}`；读取旧 `v1` 状态时会兼容升级，不再写回旧键。
- 营地场景图及路线图由 `assets/learn/english-vocab/generated/minecraft-expedition/manifest.json` 管理；只发布 manifest 标记为 runtime 的 PNG，不发布参考站原始素材。
- 词卡、图片、发音、短语、例句继续由 `minecraft-vocab-page.js`、`minecraft-vocab-session.js` 和现有英语词库提供。
- 探索桥接由 `js/minecraft-vocab-exploration-bridge.js` 提供；当前只有方块故事 `block-01 → grassland-trail` 的单点接入，桥接不会改写通用探索战斗公式。
- 积分必须继续经过 `GameRewardReceipts` / `PetBankPoints`；不要新增营地积分账本。
- `docs/` 中的调研截图和生图参考、远征 `prompts/` 下的 Grok 提示词只用于设计/生成审查，不得复制到发布目录。

## 尚未实现

- 离线 outbox、跨设备复杂合并和多人联机。
- 小学中年级、高年级的完整课程和对应远征章节。
- 完整 Minecraft 世界模拟；末影龙是营地路线的终点挑战，不是实时联机 Boss。

## 发布前检查

在仓库根目录执行：

```powershell
node scripts/test-minecraft-expedition-contract.mjs
node scripts/test-minecraft-vocab-session.mjs
node scripts/test-minecraft-vocab-card-completeness.mjs
node scripts/test-minecraft-vocab-narration.mjs
node scripts/test-static-route-entries.mjs
node scripts/test-pages-fast-gate-contract.mjs
node scripts/assemble-pages-artifact.mjs _site_verify
node scripts/test-minecraft-vocab-publish-contract.mjs _site_verify
git diff --check
```

需要本地浏览器时：

```powershell
node scripts/local-server.mjs
node scripts/test-minecraft-expedition-browser.mjs
node scripts/test-minecraft-vocab-browser.mjs
```

浏览器验收必须确认：桌面横屏显示路线图、五个区域节点和战斗面板，手机竖屏节点与词卡单列显示，点击词卡可以翻转，六种中英文音频按钮存在；按顺序完成每个区域后只解锁下一个区域，经验、能力道具和 Boss 结果按 Profile 保存，重复进入不重复加分。

## Pages 制品验收

只部署组装后的制品：

```powershell
node scripts/assemble-pages-artifact.mjs site
```

Nginx 或静态服务器根目录必须指向 release 下的 `site`，不能指向仓库根目录。上线前检查：

```bash
curl --fail https://<domain>/app/learn/minecraft-vocab/
curl --fail https://<domain>/data/learn/minecraft-expedition/camp-regions.json
curl --fail https://<domain>/js/minecraft-vocab-expedition.js
```

若任一资源失败，不切换 `current`，保留旧 release 并回滚。不要把完整 Anki 原始素材目录、`docs/`、真实 token 或测试截图发布到站点。

## 回滚与数据说明

- 静态资源回滚：切回上一 release 的 `current` symlink。
- 本次没有新增数据库 migration。
- 孩子端状态是本地 Profile 快照；回滚代码后 `petbank_minecraft_expedition_state_v1_*` 和 `petbank_minecraft_expedition_state_v2_*` 都应安全保留，不得清空积分或其他学习记录。v2 读取旧状态时会补齐经验、等级、道具和战斗字段。
- 如果营地奖励重复或状态异常，先保留浏览器 localStorage 导出与 receipt 记录，再处理，不得直接清空整个 Profile。
