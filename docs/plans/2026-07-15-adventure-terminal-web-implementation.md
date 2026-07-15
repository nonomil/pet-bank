# 探险终端新网页实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 创建一个可直接访问的 `/app/explore-terminal/` 探险终端参考网页，使用 GPT 生图的多元素爆炸图拆分素材，展示森林、科幻、方块三种世界并支持响应式切换。

**Architecture:** 新网页作为独立静态原型，放在 `app/explore-terminal/`，不修改现有 SPA 首页和故事地图。页面使用语义化 PNG 资产、四张生成的世界参考图和少量 Vanilla JS 状态切换；真实标题、按钮和状态全部由 HTML/CSS 渲染。

**Tech Stack:** 静态 HTML、CSS、Vanilla JS、PNG/RGBA、Playwright、Node.js 静态服务。

---

### Task 1: Publish semantic UI assets

**Files:**
- Create: `assets/story/pixel-dialogue/ui/adventure-terminal/published/*.png`
- Create: `assets/story/pixel-dialogue/ui/adventure-terminal/manifest.json`
- Source: `assets/story/pixel-dialogue/ui/adventure-terminal/split/part-*.png`

**Step 1: Copy selected split parts to semantic names**

Publish the fox, three world cards, three world markers, progress ring, four progress bars, reward badge, detective badge, and continue button. Do not publish numbered filenames as page dependencies.

**Step 2: Write the manifest**

Record each semantic file, source split part, role, dimensions, and alpha requirement. Keep the generated sheet and split output as provenance, but page code only references `published/` names.

**Step 3: Verify assets**

Run a Pillow check that every published PNG is RGBA, has nonzero dimensions, and has a transparent corner.

### Task 2: Add a failing browser contract

**Files:**
- Create: `scripts/test-explore-terminal-page.mjs`

**Step 1: Write the failing test**

Open `/app/explore-terminal/` and assert the page contains three world buttons, a preview image, semantic asset shelf images, a continue button, and a live status region. Click all three worlds and the continue action; assert preview source/theme changes and no mobile horizontal overflow.

**Step 2: Run the test**

Run: `node scripts/test-explore-terminal-page.mjs`

Expected: FAIL because the new page does not exist yet.

### Task 3: Build the new webpage

**Files:**
- Create: `app/explore-terminal/index.html`
- Create: `app/explore-terminal/explore-terminal.css`
- Create: `app/explore-terminal/explore-terminal.js`

**Step 1: Add semantic HTML**

Create a focused page shell with a compact top bar, world switcher, large preview stage, pet/progress side panels, primary continue action, detective secondary action, and a collapsible/scrollable asset shelf.

**Step 2: Add the theme state**

Define one data object per world with title, subtitle, preview image, world card asset, marker asset, accent colors, and progress values. Render the active world without putting generated text into images.

**Step 3: Add responsive CSS**

Use a 16:9 desktop stage, stable dimensions, bright cyan/cobalt/green/coral/yellow palette, no nested cards, no page-level overflow, and a compact stacked mobile layout at 390px.

**Step 4: Add interactions**

World buttons update active styling, preview image, live status, marker, and progress bars. Continue and detective buttons provide visible status feedback without changing the existing application state.

### Task 4: Verify and capture

**Files:**
- Modify only if needed: `scripts/test-explore-terminal-page.mjs`
- Output: `tmp/explore-terminal-desktop.png`, `tmp/explore-terminal-mobile.png`

**Step 1: Run the contract**

Run: `node scripts/test-explore-terminal-page.mjs`

Expected: PASS with all assets loading and no console/page errors.

**Step 2: Run syntax checks**

Run: `node --check app/explore-terminal/explore-terminal.js`.

**Step 3: Capture browser screenshots**

Verify desktop and 390px layouts visually, including all three world states and the asset shelf.

**Step 4: Commit**

```powershell
git add -- app/explore-terminal assets/story/pixel-dialogue/ui/adventure-terminal/published assets/story/pixel-dialogue/ui/adventure-terminal/manifest.json scripts/test-explore-terminal-page.mjs
git commit -m "feat: add adventure terminal reference page"
```
