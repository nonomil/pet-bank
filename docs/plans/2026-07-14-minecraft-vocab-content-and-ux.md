# Minecraft 词卡内容与学习页补全实施计划

> **For Claude:** 必需子技能：使用 superpowers:executing-plans 逐任务实施此计划。

**目标：** 为主站学习池和参考站本地快照补齐每张词卡的中英短语与中英短句，并把内容可靠地呈现在远征卡片上，完成视觉、数据和部署验收。

**架构：** 新增一个可重复运行的确定性内容补全脚本，保留已有人工内容，只为缺失字段按词性/主题生成 Minecraft 语境短语和短句；主站运行时仍使用静态本地数据，不依赖外网。页面只增加内容展示和来源统计，不改变既有 11 步队列、Profile 快照和统一奖励接口。

**技术栈：** Node.js CommonJS 数据脚本、Vanilla JS IIFE、静态 JSON、现有 Playwright 浏览器测试、Bee GPT 图片工作流。

---

### 任务 1：建立词卡内容质量门禁

**文件：**
- 创建：`scripts/enrich_minecraft_vocab.cjs`
- 创建：`scripts/test-minecraft-vocab-content.mjs`
- 修改：`data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json`
- 修改：`data/learn/external/mayihaoke/word-cards.json`

**步骤 1：编写失败测试**

测试主站词卡和参考站词卡的统一读取、必填字段、双语字段、无 HTML/控制字符、词卡唯一性和禁止装饰素材标记；当前主站应因 57 个空短语、参考站 500 个空短语而失败。

**步骤 2：运行测试确认失败**

运行：`node scripts/test-minecraft-vocab-content.mjs`

预期：失败，并报告缺失短语字段。

**步骤 3：实现最小补全脚本**

脚本提供纯函数 `enrichCard` 和 `enrichDocument`，优先保留现有 `phrase`、`phraseTranslation`、`example`、`exampleTranslation/exampleZh`；缺失时根据 `category`、标签和中英文词条生成可读的短语与短句。输出统一字段：`phrase`、`phraseTranslation`、`sentence`、`sentenceTranslation`；重复运行结果稳定，不修改来源 URL 和音频字段。

**步骤 4：生成数据并验证通过**

运行：`node scripts/enrich_minecraft_vocab.cjs --apply`，再运行 `node scripts/test-minecraft-vocab-content.mjs`。

预期：主站 96/96、参考站 500/500 的短语和短句字段完整，生成统计可审计，禁止的 `哈基米薯仔.png` 等装饰素材不进入主站数据。

**步骤 5：提交**

```bash
git add scripts/enrich_minecraft_vocab.cjs scripts/test-minecraft-vocab-content.mjs data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json data/learn/external/mayihaoke/word-cards.json
git commit -m "data: complete Minecraft vocabulary phrases and sentences"
```

### 任务 2：把短语、短句和本地词库来源接入远征卡片

**文件：**
- 修改：`js/minecraft-vocab-page.js`
- 修改：`css/minecraft-vocab.css`
- 修改：`scripts/test-minecraft-vocab-browser.mjs`

**步骤 1：扩展浏览器失败断言**

在首页和学习卡片断言 `data-mv-phrase`、`data-mv-sentence`、中文翻译和本地词库来源统计存在；进入主动回忆/场景句时仍保持现有按钮和输入行为。

**步骤 2：运行浏览器测试确认缺口**

运行：`MMWG_E2E_BASE_URL=http://127.0.0.1:8765 node scripts/test-minecraft-vocab-browser.mjs`

预期：新增字段断言失败。

**步骤 3：实现页面呈现**

在非问答阶段显示短语、短语中文、例句和例句中文；问答阶段只显示必要提示，答题后显示反馈。对缺失音频使用现有语音回退，对缺失图片保留已有 fallback；首页显示参考站 500 条和独立 Anki 11,241 张的本地素材来源，不在浏览器请求外站。

**步骤 4：补充响应式样式并通过测试**

为短语/短句使用稳定的内容区高度和可换行文本；检查 320/375/390/768/1280 宽度无横向滚动、按钮焦点可见、移动端操作区不遮挡正文。

运行：`node scripts/test-minecraft-vocab-browser.mjs`

预期：桌面和移动断言通过，页面错误为空。

**步骤 5：提交**

```bash
git add js/minecraft-vocab-page.js css/minecraft-vocab.css scripts/test-minecraft-vocab-browser.mjs
git commit -m "feat: show bilingual Minecraft phrases in expedition cards"
```

### 任务 3：完成视觉素材与页面截图验收

**文件：**
- 复用/新增：`assets/learn/` 下 Minecraft 学习视觉素材
- 创建：`scripts/test-minecraft-vocab-visual.mjs`（若现有浏览器测试不足以覆盖截图断言）
- 参考：`.codex/skills/gpt-image-bee-workflow/SKILL.md`

**步骤 1：确认现有素材**

检查现有首页封面和词卡图片是否为可发布的本地 PNG/WebP，确认无文字、logo、水印和无意义装饰图。

**步骤 2：按 Bee 工作流生成缺失素材**

若首页缺少独立背景或宠物陪伴元素，使用项目 Bee API 的 `gpt-image-2` 工作流生成无文字素材，保存 prompt、原图、处理后图和 manifest；不把密钥写入仓库或输出。

**步骤 3：接入并视觉检查**

只接入语义明确的素材，使用 `view_image` 检查图像可打开、尺寸正确、没有文字伪影；浏览器截图检查首屏、学习卡片和移动端布局。

**步骤 4：提交**

```bash
git add assets/learn scripts/test-minecraft-vocab-visual.mjs
git commit -m "feat: polish Minecraft vocabulary visuals"
```

### 任务 4：更新版本、Hermes 和部署边界文档

**文件：**
- 修改：`CHANGELOG.md`
- 修改：`docs_project/CURRENT-STATE.md`
- 修改：`docs_project/runbooks/self-hosted/MINECRAFT-VOCAB-LEARNING-HERMES.md`
- 修改：`docs_project/runbooks/self-hosted/ANKI-MINECRAFT-VOCAB-HERMES.md`
- 修改：`prj/anki-minecraft-vocab/README.md`
- 修改：`prj/anki-minecraft-vocab/DEPLOY-HERMES.md`

**步骤 1：写入实际数据证据**

记录 96 张主站词卡、500 条参考站快照、11,241 张独立 Anki 卡片、短语/短句完整性门禁、装饰素材过滤规则和无数据库迁移事实。

**步骤 2：补 Hermes 可执行流程**

增加数据补全、内容门禁、Anki 独立站验证、Pages 制品验证、深层路由检查、回滚和“不要把 Anki 项目复制进 Pages”规则。命令必须可直接复制执行。

**步骤 3：提交**

```bash
git add CHANGELOG.md docs_project/CURRENT-STATE.md docs_project/runbooks/self-hosted prj/anki-minecraft-vocab/README.md prj/anki-minecraft-vocab/DEPLOY-HERMES.md
git commit -m "docs: update Minecraft vocab release and Hermes runbook"
```

### 任务 5：完整验证、组装制品并推送

**步骤 1：运行内容与独立 Anki 验证**

```bash
node scripts/test-minecraft-vocab-content.mjs
python -m unittest discover -s prj/anki-minecraft-vocab/scripts -p "test_*.py" -v
python -m py_compile prj/anki-minecraft-vocab/scripts/*.py
```

**步骤 2：启动静态服务并运行浏览器/主站测试**

```bash
python -m http.server 8765 --bind 127.0.0.1
MMWG_E2E_BASE_URL=http://127.0.0.1:8765/app/learn/minecraft-vocab node scripts/test-minecraft-vocab-browser.mjs
node scripts/learning-center-smoke.mjs
node scripts/run-full-regression.mjs
```

**步骤 3：组装 Pages 制品**

```bash
node scripts/test-pages-fast-gate-contract.mjs
node scripts/test-static-route-entries.mjs
node scripts/assemble-pages-artifact.mjs _site_verify
```

确认主站深层入口和资源存在，`_site_verify/prj/anki-minecraft-vocab` 不存在，临时目录不进入制品。

**步骤 4：检查工作树并推送**

只提交本次相关文件；保留用户已有的像素故事素材、截图和发布脚本改动。全部验证通过后运行 `git push origin main`，记录远程分支、提交和测试结果。

