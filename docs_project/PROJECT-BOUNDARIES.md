# 项目运行边界

> 目标：让“网页发布所需文件”和“本机研究/素材/缓存”有明确边界，清理时不依赖个人记忆。

## 六类目录

| 类别 | 目录/文件 | 规则 |
| --- | --- | --- |
| 网页运行时 | `index.html`、`css/`、`js/`、`app/`、`assets/`、`data/`、`prj/` 中被 `scripts/assemble-pages-artifact.mjs` 精确放行的运行时 | 修改后必须运行静态路由和制品检查；不得按目录体积直接删除 |
| 受版本控制源码 | `.github/`、`scripts/`、`ops/`、`docs_project/`、`prj/petbank-server/`、受追踪的 `prj/` 与数据文件 | 必须通过 Git 变更、测试和文档同步管理 |
| 原始素材 | `assets/pets-originals/`、原始宠物姿态、原始图包、用户提供主角/背景素材 | 仅在确认已有可恢复来源或 Git 历史后才可移动；不得作为常规垃圾清理 |
| 可再生成产物 | 生图输出、图片切图、词库适配 JSON、Pages `_site*` 制品 | 必须记录生成脚本和验证命令；正式运行资源例外，需由发布白名单和测试证明 |
| 本地缓存 | `tmp/`、`_site_check*/`、`_pages_test_root/`、浏览器 profile、截图、测试产物、Python/Node 缓存 | 默认不入库；确认没有运行进程使用后可删除 |
| 参考资料 | `docs/参考/`、本地设计参考、生图提示词草稿、外部项目快照 | 默认不入库，保留用于调研；需要发布的摘要应提炼到 `docs_project/` 或允许追踪的 `docs/` 文档 |

## 发布边界

`scripts/assemble-pages-artifact.mjs` 是 GitHub Pages 的唯一静态制品入口。它复制主站运行目录，并通过以下精确规则收口独立玩法：

- `includeLearningArcadeRuntime`：学习机原型只允许运行代码和已选生成资产。
- `includeTypingDefenseRuntime`：打字防线仅允许 `web/` 与指定运行资产。
- `includeWordMemoryRuntime`：像素探险仅允许词卡、语音、地图、角色及主题资源白名单。

因此，不能依据 `prj/`、`assets/` 或 `docs/` 的整体大小判断是否可删除；先确认文件是否被入口、运行时清单或制品过滤器引用。

## 提交边界

1. 功能代码、生成数据、生成脚本和验证脚本必须作为一个可复现单元提交。
2. 核心词库、独立游戏、资源地图和网页架构不得混入同一提交。
3. 体积大的二进制资源必须说明运行引用和 Pages 产物路径。
4. 新增 localStorage 键要更新 `docs_project/data-contracts/localstorage-keys.md`；新增发布资源要更新对应验证。

## 当前清理优先级

| 优先级 | 范围 | 动作 |
| --- | --- | --- |
| P0 | `_site*`、`_pages_test_root/`、`tmp/` 中的测试制品 | 确认无进程占用后清理；重新运行构建可再生 |
| P1 | 浏览器自动化 profile、截图、原始生图输出 | 保留必要提示词/生成脚本后清理本机缓存；不进入 Pages |
| P2 | `docs/参考/` 与原始素材 | 先建立目录说明和外部备份，再按主题归档；默认不删除 |
| P3 | 正式 `assets/` 和 `prj/` 运行资源 | 只由未引用检查和制品测试驱动清理，不做批量删除 |
