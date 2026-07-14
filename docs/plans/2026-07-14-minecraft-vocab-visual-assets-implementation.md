# Minecraft 单词学习视觉素材实施计划

> **给 Claude:** 必需子技能：使用 superpowers:executing-plans 来逐任务实施此计划。

**目标：** 为主站 Minecraft 单词远征和独立 Anki 词卡工作台生成并接入一套可复用的 Minecraft 学习视觉素材。

**架构：** 词卡实际图片继续复用本地 Anki/主站媒体；新增 AI 图片只负责学习场景、阶段氛围、奖励反馈和低干扰工作台背景。运行时通过 manifest 和语义路径读取本地资源，所有单词、中文、音标、短语、句子和按钮文字继续由 HTML/CSS 渲染。

**技术栈：** TokenX24 OpenAI-compatible `gpt-image-2`、Python/Pillow 资源检查、Vanilla JS IIFE、CSS、Playwright、现有 Pages 制品脚本。

---

### 任务 1：建立视觉资源清单和失败门禁

**文件：**
- 创建：`assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/manifest.json`
- 创建：`scripts/test-minecraft-vocab-visual-assets.mjs`
- 修改：`scripts/assemble-pages-artifact.mjs`
- 测试：`scripts/test-minecraft-vocab-visual-assets.mjs`

**步骤 1：编写失败测试**

测试 manifest 必须声明主站 7 个素材、工作台 2 个素材、每个文件存在、PNG/WebP 文件可解码、尺寸属于允许集合，且运行时路径没有 `docs/`、`tmp/`、密钥或外站 URL。

**步骤 2：运行测试确认缺口**

运行：`node scripts/test-minecraft-vocab-visual-assets.mjs`

预期：失败并列出尚未生成的素材文件。

**步骤 3：实现最小资源门禁**

实现 manifest 读取、路径安全检查、Pillow/Node 可读图片的基础断言，并在 Pages 组装脚本中只放行 `assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/` 下的正式图片和 manifest，不放行 prompt、原始响应或临时文件。

**步骤 4：提交门禁骨架**

```bash
git add scripts/test-minecraft-vocab-visual-assets.mjs scripts/assemble-pages-artifact.mjs
git commit -m "test: add Minecraft vocabulary visual asset gate"
```

### 任务 2：准备 TokenX24 生图提示词和生成清单

**文件：**
- 创建：`assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/prompts/`
- 创建：`prj/anki-minecraft-vocab/assets/ui/generated/prompts/`
- 创建：`scripts/generate-minecraft-vocab-visuals.ps1`
- 参考：`scripts/token24-image-generate.py`
- 参考：`docs/plans/2026-07-14-minecraft-vocab-visual-assets-design.md`

**步骤 1：写无文字提示词**

为 `study-camp-hero`、`warmup-grove`、`new-word-mine`、`recall-bridge`、`scene-village`、`reward-word-stars`、`card-frame-sheet`、`workbench-bg`、`detail-bg` 分别写明 viewport、主体、留白区、色彩和 `no text/no letters/no numbers/no logos/no watermark` 约束。卡片边框素材必须单独说明不生成伪文字。

**步骤 2：编写生成编排**

PowerShell 编排脚本只传 prompt 文件、输出路径、尺寸和质量给 `scripts/token24-image-generate.py`；密钥仅由 `TOKEN24.md` 在本机读取。脚本遇到非 PNG、空响应、HTTP 错误或超时立即失败，不把错误 JSON 写进正式资源目录。

**步骤 3：做本地模型探测**

运行 `GET /v1/models` 的只读探测，确认 `gpt-image-2` 存在；不要在终端输出 token 或完整响应。

**步骤 4：提交提示词和编排**

```bash
git add scripts/generate-minecraft-vocab-visuals.ps1 assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/prompts prj/anki-minecraft-vocab/assets/ui/generated/prompts
git commit -m "chore: add Minecraft vocabulary visual prompts"
```

### 任务 3：生成并验收主站素材

**文件：**
- 创建：`assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/*.png`
- 修改：`assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/manifest.json`
- 测试：`scripts/test-minecraft-vocab-visual-assets.mjs`

**步骤 1：生成 6 张场景图**

按顺序生成 hero、warmup、new-word、recall、scene、reward；优先使用宽图 `1536x864`，若供应商只返回 `1536x1024`，记录实际尺寸并在 CSS 中用 `object-fit: cover`，不拉伸。

**步骤 2：检查图像**

使用 Pillow 检查文件头、尺寸、模式和最小文件大小；使用 `view_image` 检查是否出现文字、伪 UI、Logo、水印、恐怖主体或无法承载 HTML 的构图。失败图保留在临时目录，不覆盖正式文件。

**步骤 3：更新 manifest**

为每个文件写入用途、尺寸、生成模型、prompt 相对路径和 `runtime: true`；prompt、响应、截图字段不能包含密钥。

**步骤 4：运行门禁并提交**

运行：`node scripts/test-minecraft-vocab-visual-assets.mjs`

预期：主站场景素材全部通过。

```bash
git add assets/learn/english-vocab/generated/minecraft-vocab-visual-pack
git commit -m "assets: add Minecraft vocabulary expedition scenes"
```

### 任务 4：接入主站学习远征

**文件：**
- 修改：`js/minecraft-vocab-page.js`
- 修改：`css/minecraft-vocab.css`
- 修改：`scripts/test-minecraft-vocab-browser.mjs`

**步骤 1：扩展浏览器失败断言**

进入首页、热身、新词、回忆、场景句和完成页，断言对应 `data-mv-visual` 图片/背景的 `complete`、`naturalWidth`，并断言既有词卡图片、短语、短句、选择按钮和输入框仍存在。

**步骤 2：运行浏览器测试确认缺口**

运行：`node scripts/test-minecraft-vocab-browser.mjs`

预期：新增视觉资源断言失败，原有学习流程断言继续通过。

**步骤 3：实现视觉接入**

给首页、会话阶段和完成页增加语义素材引用；用现有 `asset()` 解析 Pages 深层路径；使用 CSS 背景或独立 `<img>` 时保持固定容器尺寸、`object-fit: cover/contain` 和低透明度叠加。不得将图片文字作为功能入口，不得修改 11 步队列、积分、Profile 或奖励顺序。

**步骤 4：补响应式和无障碍状态**

桌面端保留学习信息区和图片留白，移动端将图片降为背景层，正文、选项和底部操作区保持可见；所有独立 `<img>` 添加准确 `alt`，背景图使用空 alt；`prefers-reduced-motion` 下不增加新的强制动画。

**步骤 5：测试并提交**

运行：`node scripts/test-minecraft-vocab-browser.mjs`

预期：桌面和移动端页面错误为空，图片全部加载，body 无横向溢出。

```bash
git add js/minecraft-vocab-page.js css/minecraft-vocab.css scripts/test-minecraft-vocab-browser.mjs
git commit -m "feat: add visuals to Minecraft vocabulary expedition"
```

### 任务 5：生成并接入独立 Anki 工作台素材

**文件：**
- 创建：`prj/anki-minecraft-vocab/assets/ui/generated/workbench-bg.png`
- 创建：`prj/anki-minecraft-vocab/assets/ui/generated/detail-bg.png`
- 修改：`prj/anki-minecraft-vocab/styles.css`
- 修改：`prj/anki-minecraft-vocab/index.html`（仅在需要补充装饰性背景语义时）
- 修改：`prj/anki-minecraft-vocab/scripts/test_web_contract.py`

**步骤 1：生成两张低干扰背景**

生成浅色方块工作台远景和卡片详情地图纹理；禁止高饱和纹理、人物、文字和边缘高对比装饰，保证目录、搜索、卡片正文和媒体图清晰。

**步骤 2：接入 CSS**

只把素材用于页面背景伪元素或非交互装饰层；维持现有面板不透明度、边框和对比度，不在图片上放置文本。

**步骤 3：扩展独立站合同测试**

断言本地资源存在、HTML/CSS 引用相对路径、没有外站运行时媒体依赖，且移动目录抽屉和卡片详情结构未改变。

**步骤 4：测试并提交**

运行：

```bash
python -m unittest discover -s prj/anki-minecraft-vocab/scripts -p "test_*.py" -v
python -m py_compile prj/anki-minecraft-vocab/scripts/*.py
```

```bash
git add prj/anki-minecraft-vocab/assets/ui prj/anki-minecraft-vocab/styles.css prj/anki-minecraft-vocab/index.html prj/anki-minecraft-vocab/scripts/test_web_contract.py
git commit -m "feat: add visual treatment to Anki vocabulary workbench"
```

### 任务 6：主站和独立工作台视觉回归

**文件：**
- 创建或修改：`scripts/test-minecraft-vocab-visual-browser.mjs`
- 生成：`tmp/minecraft-vocab-visual-*.png`

**步骤 1：运行主站浏览器回归**

验证 `/app/learn/minecraft-vocab` 的 1280px、768px、390px 视口：入口、首页、每个阶段、选项反馈、完成页、图片加载、无横向溢出和无新增控制台错误。

**步骤 2：运行独立工作台回归**

启动静态服务，验证目录折叠、搜索、卡片选择、媒体画廊、音频和移动端目录抽屉；截图只写入 `tmp/`。

**步骤 3：人工检查截图**

使用 `view_image` 检查图片不遮挡文字，长单词和中文翻译换行正常，背景不抢过词卡内容，按钮和选项尺寸稳定。

### 任务 7：发布制品、文档和完整验证

**文件：**
- 修改：`CHANGELOG.md`
- 修改：`docs_project/runbooks/self-hosted/MINECRAFT-VOCAB-LEARNING-HERMES.md`
- 修改：`prj/anki-minecraft-vocab/README.md`
- 修改：`prj/anki-minecraft-vocab/DEPLOY-HERMES.md`

**步骤 1：运行专项验证**

```bash
node scripts/test-minecraft-vocab-content.mjs
node scripts/test-minecraft-vocab-visual-assets.mjs
node scripts/test-minecraft-vocab-browser.mjs
python -m unittest discover -s prj/anki-minecraft-vocab/scripts -p "test_*.py" -v
```

**步骤 2：运行 Pages 门禁和制品组装**

```bash
node scripts/test-pages-fast-gate-contract.mjs
node scripts/test-static-route-entries.mjs
node scripts/assemble-pages-artifact.mjs _site_verify
```

确认正式视觉素材进入制品，prompt、临时响应、完整 Anki 项目和 `tmp/` 没有进入制品。

**步骤 3：运行全量回归**

```bash
node scripts/run-full-regression.mjs
```

**步骤 4：提交文档并推送**

只暂存本任务文件，保留工作树中其他并行修改；全部验证通过后提交并推送 `origin/main`，记录提交号和测试结果。

