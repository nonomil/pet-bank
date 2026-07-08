# 儿童游戏 UI 资产流水线

> 状态：已形成项目内技能和工作台；后处理链路可跑通，API 全自动生图待配置 `IMAGE_API_KEY`。

## 1. 当前结论

这条流水线已经从“散乱经验”收口成三层：

| 层 | 位置 | 状态 |
|---|---|---|
| 执行技能 | `.codex/skills/gpt-image-ui-assets/` | 已创建 |
| 通用工作台 | `prj/gpt-image-workflow/` | 可预检、交接、裁切、发布 |
| 项目案例 | `prj/学习机玩法原型/assets/generated/` | 拼音贪吃蛇已跑通 |

它还不是完全无人值守的一键生图系统，因为网页登录态生图、ChatGPT 选择结果、Cowart 视觉纠偏仍需要人工或 agent 参与判断。但从“有图”到“透明 PNG 资产包”的后处理段已经可复用。

## 2. 标准流程

```text
玩法目标
  -> 完整参考图 prompt
  -> 透明爆炸资产图 prompt
  -> GPT/Agnes/ChatGPT 页面生成
  -> 下载原图
  -> 自动/配置裁切
  -> 去白底/去棋盘格/透明化
  -> 语义命名 + manifest
  -> 接入网页
  -> 浏览器截图和资源加载验证
```

## 3. 优先级

1. 优先提取参考网页或已有项目图片。
2. 不够时用 GPT/ChatGPT 页面或 Agnes 生图。
3. 需要视觉纠偏时，用 Cowart 做批注和对照。
4. SVG 只作为临时兜底，不作为儿童游戏最终美术方向。

## 4. 执行入口

项目技能：

```text
.codex/skills/gpt-image-ui-assets/SKILL.md
```

通用工作台：

```powershell
powershell -ExecutionPolicy Bypass -File .\prj\gpt-image-workflow\scripts\run-pipeline.ps1 -Mode preflight
```

网页登录态交接：

```powershell
powershell -ExecutionPolicy Bypass -File .\prj\gpt-image-workflow\scripts\run-pipeline.ps1 `
  -Mode browser-handoff `
  -Prompt "<完整 prompt>"
```

已有爆炸图裁切：

```powershell
powershell -ExecutionPolicy Bypass -File .\prj\gpt-image-workflow\scripts\run-pipeline.ps1 `
  -Mode split `
  -Input .\path\to\assets-sheet.png `
  -SplitMode auto `
  -Pad 8
```

发布透明 PNG/WebP：

```powershell
powershell -ExecutionPolicy Bypass -File .\prj\gpt-image-workflow\scripts\run-pipeline.ps1 `
  -Mode publish-transparent `
  -Input .\path\to\part.png `
  -OutDir .\path\to\published `
  -BaseName semantic-name `
  -RemoveBg none
```

## 5. 已验证证据

本轮检查确认：

- `preflight` 能生成报告。
- Python 可用。
- `browser-act` 可用。
- `.claude/skills/gpt-image-pipeline` 的核心脚本存在。
- `split` 已用拼音贪吃蛇爆炸图切出 17 个 PNG。
- `publish-transparent` 已对一个切片生成 PNG/WebP 和 `publish_manifest.json`。
- `gpt-image-ui-assets` 已用项目首页做过 prompt 测试，生成了完整首页参考图和透明资产爆炸图两类 `browser-handoff` 交接包。

当前限制：

- `IMAGE_API_KEY` 未配置，所以 API 全自动生图未启用。
- `browser-handoff` 只生成交接包，不自动完成登录态网页生成、挑图和下载。
- 自动裁切输出仍是 `part-xx`，正式接入前必须语义命名并写 manifest。

## 6. 现有案例

首页优化设计 prompt 测试：

```text
docs/GPT生图/首页优化设计提示词-2026-07-07.md
prj/gpt-image-workflow/output/20260707-101916-browser-handoff/
prj/gpt-image-workflow/output/20260707-101943-browser-handoff/
prj/首页优化设计验证/
```

测试输入来自当前首页真实渲染：顶部导航、今日任务、今日概览、栏目轮播、6 个常用入口和宝箱仓库。优化方向是减少首屏等权卡片，突出“今日主行动 + 宠物同行 + 三个大入口”。

结构样机验证结果：

- 已创建独立样机 `prj/首页优化设计验证/index.html`，不接入主项目。
- 复用 `assets/home-bg.webp` 和 `assets/pets/poses/dog_happy.webp`，符合“参考网页/已有项目图片优先”的资产策略。
- 桌面 `1280x720` 和手机宽度 `390x844` 均已用 Codex 内置浏览器检查。
- 手机宽度下 3 个主入口都进入第一屏，无横向溢出。
- “开始”按钮能更新进度、星星数量和宠物台词。
- 截图保存于 `prj/首页优化设计验证/screenshots/`。

拼音贪吃蛇：

```text
prj/学习机玩法原型/assets/generated/reference/pinyin-snake-reference.webp
prj/学习机玩法原型/assets/generated/reference/pinyin-snake-assets-sheet.png
prj/学习机玩法原型/assets/generated/pinyin-snake-assets/manifest.json
```

当前成功点：

- 参考图和爆炸图都有留档。
- 透明 PNG 资产已拆出。
- 网页已接入棋盘、蛇头、蛇身、食物 tile 等语义资产。
- 浏览器中验证过图片加载和横屏显示。

汉字跳跃：

```text
prj/学习机玩法原型/assets/generated/reference/hanzi-jumper-prompts.md
```

当前状态：

- prompt 已落盘。
- 参考图数据已有分段缓存迹象。
- 透明资产包目录已建，但尚未完成裁切和接入。

## 7. 下一步建议

优先把“汉字跳跃”作为第二个标准化样板补完：

1. 下载/恢复参考图。
2. 生成透明爆炸图。
3. 用通用 `split` 先切一版。
4. 语义命名成 `background_panel`、`jumper_idle`、`jumper_jump`、`platform_cloud_1` 等。
5. 写 manifest。
6. 接入 `game.js` / `styles.css`。
7. 跑 `verify.mjs`、`node --check` 和浏览器横屏检查。

做到这一步后，这条流水线才算从“一次成功案例”升级成“可复跑方法”。
