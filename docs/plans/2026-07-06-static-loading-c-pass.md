# C 轮静态加载治理实施计划

> **给 Claude:** 必需子技能：使用 superpowers:executing-plans 来逐任务实施此计划。

**目标：** 移除首屏外部样式依赖，压缩首屏地图图片路径，并把 GitHub Pages 发布包组装收口到可测试脚本。

**架构：** 保留当前静态 HTML + Vanilla JS + `runtime-loader.js` 架构。新增本地 utility CSS 兼容层和 Pages artifact 组装脚本，用静态合同测试守住外链、图片和发布包边界。

**技术栈：** Static HTML, CSS, Vanilla JS, Node.js artifact script, Python pytest contracts

---

### 任务 1：写 C 轮静态合同测试

**文件：**
- 修改：`prj/test_static_home_performance_contract.py`
- 创建：`prj/test_pages_artifact_contract.py`

**步骤 1：添加失败测试**

在 `prj/test_static_home_performance_contract.py` 增加断言：

- `index.html` 和 `admin.html` 不包含 `cdn.tailwindcss.com`
- `index.html` 和 `admin.html` 不包含 `fonts.googleapis.com`
- 两个 HTML 入口都引用 `css/vendor/tailwind-lite.css`
- `css/style.css` 不引用 `data/GPT生图/背景图片-1.png`
- `css/style.css` 不引用 `assets/home-bg/map-board.png`
- `assets/home-bg/map-hero-texture.webp` 和 `assets/home-bg/map-board.webp` 存在

创建 `prj/test_pages_artifact_contract.py`：

- 在临时目录运行 `node scripts/assemble-pages-artifact.mjs <tmp>`
- 断言 `_site` 包含 `index.html`、`admin.html`、`css/vendor/tailwind-lite.css`、`assets/home-bg/map-board.webp`
- 断言 `_site` 不包含 `assets/voice`
- 断言 `_site` 不包含 `assets/pets/originals`
- 断言 `_site` 不包含 `assets/pets/poses-originals`
- 断言 `_site` 不包含 `data/source-snapshots`
- 断言 `_site/data` 下没有 `.bak`

**步骤 2：运行测试确认失败**

运行：

```powershell
python -m pytest prj/test_static_home_performance_contract.py prj/test_pages_artifact_contract.py -q
```

预期：失败，指出外链、PNG 引用、缺失 WebP 或缺失组装脚本。

### 任务 2：本地化首屏样式外链

**文件：**
- 创建：`css/vendor/tailwind-lite.css`
- 修改：`index.html`
- 修改：`admin.html`

**步骤 1：添加轻量 utility CSS**

创建 `css/vendor/tailwind-lite.css`，覆盖当前项目常用 utility：

- display：`flex`、`grid`、`hidden`、`block`、`inline-flex`
- spacing：`m*`、`p*`、`gap*`
- width / height：`w-full`、`h-full`、常用 `w-*`、`h-*`
- text：字号、字重、对齐、常用颜色
- layout：`items-center`、`justify-center`、`rounded-*`、`shadow-*`

**步骤 2：替换 HTML 外链**

- 移除 `https://cdn.tailwindcss.com`
- 移除 Google Fonts `<link>`
- 在 `css/style.css` 前引用 `css/vendor/tailwind-lite.css`

**步骤 3：运行合同测试**

运行：

```powershell
python -m pytest prj/test_static_home_performance_contract.py -q
```

预期：外链相关断言通过，图片相关断言仍可能失败。

### 任务 3：转码首屏地图图片

**文件：**
- 创建：`assets/home-bg/map-hero-texture.webp`
- 创建：`assets/home-bg/map-board.webp`
- 修改：`css/style.css`

**步骤 1：生成 WebP**

用本机可用图片工具把 PNG 转为 WebP：

- `data/GPT生图/背景图片-1.png` -> `assets/home-bg/map-hero-texture.webp`
- `assets/home-bg/map-board.png` -> `assets/home-bg/map-board.webp`

**步骤 2：更新 CSS 引用**

把 `css/style.css` 的两个 PNG URL 改为新 WebP URL。

**步骤 3：运行合同测试**

运行：

```powershell
python -m pytest prj/test_static_home_performance_contract.py -q
```

预期：全部通过。

### 任务 4：发布包组装脚本与 workflow 收口

**文件：**
- 创建：`scripts/assemble-pages-artifact.mjs`
- 修改：`.github/workflows/deploy.yml`
- 创建：`prj/test_pages_artifact_contract.py`

**步骤 1：实现脚本**

脚本行为：

- 参数 1 为输出目录，默认 `_site`
- 清空并重建输出目录
- 复制入口文件、`css`、`js`、`assets`、`data`
- 创建 `.nojekyll`
- 排除源图目录、`assets/voice`、`data/source-snapshots`、`*.bak`

**步骤 2：更新 workflow**

把 inline `cp` / `rm -rf` 替换为：

```bash
node scripts/assemble-pages-artifact.mjs _site
```

**步骤 3：运行 artifact 合同测试**

运行：

```powershell
python -m pytest prj/test_pages_artifact_contract.py -q
```

预期：通过。

### 任务 5：全量验证与文档回写

**文件：**
- 修改：`docs/网页优化建议/2026-07-06-C轮加载治理与发布瘦身方案.md`

**步骤 1：运行验证**

运行：

```powershell
node --check js/app.js
node --check js/runtime-loader.js
node --check scripts/assemble-pages-artifact.mjs
python -m pytest prj/test_static_home_performance_contract.py prj/test_pages_artifact_contract.py -q
node prj/cloud_config_missing_regression.test.mjs
node scripts/smoke.mjs
node prj/petbank_ui_alignment_regression.test.mjs
```

**步骤 2：回写执行记录**

在方案文档 `执行记录` 中写入：

- 完成状态
- 主要改动
- 验证命令和结果
- 后续建议

**步骤 3：检查工作区**

运行：

```powershell
git status --short
```

预期：只新增或修改本轮相关文件；语音资产变更保持未触碰。
