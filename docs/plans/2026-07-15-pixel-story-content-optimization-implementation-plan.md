# Pixel Story Content Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重写像素世界故事包中模板化和断裂的剧情文本，使三条主线各自形成 20 节点完整故事，并让 20 个侦探小游戏组成可收束的隐藏支线。

**Architecture:** 保持现有 `pixel-dialogue-story` 数据契约和运行时不变，只修改 level JSON 的文案、活动提示、反馈和角色对白。先增加内容契约测试作为红灯，再按路线分批更新数据，最后运行内容、资源、分页和浏览器全章节验证。

**Tech Stack:** Vanilla JSON data, Node.js ESM contract scripts, existing Playwright browser scripts, PowerShell static server.

---

### Task 1: 建立内容审计测试

**Files:**
- Create: `scripts/test-pixel-story-content-contract.mjs`
- Reference: `data/story-packs/05-pixel-worlds-story/manifest.json`
- Reference: `data/story-packs/05-pixel-worlds-story/levels/*.json`

**Step 1: Write the failing test**

实现以下断言：四路线各 20 个节点；所有节点至少 11 段 lines 且有一个 activity；禁止 `。，`、`新的线索正在等着被发现`；每条路线的固定对白次数不超过 4；科幻、森林、方块第 20 节和侦探第 20 节必须包含预设结局关键词。

**Step 2: Run it to verify it fails**

Run: `node scripts/test-pixel-story-content-contract.mjs`

Expected: FAIL，报告当前模板句、重复对白和主线结局冲突。

### Task 2: 重写科幻路线后半段

**Files:**
- Modify: `data/story-packs/05-pixel-worlds-story/levels/sf-09.json` through `sf-20.json`

**Step 1: Write the content batch**

围绕“光核碎片 → 星桥修复 → 收到森林信号 → 交付绿色航线”重写 12 个节点。每个节点保留原有 `activityType` 和 2 个 action 结构，更新场景、角色对白、反馈和识字锚点。

**Step 2: Run the content test**

Run: `node scripts/test-pixel-story-content-contract.mjs`

Expected: 科幻路线不再出现模板句，重复对白检查通过；其他路线仍可能失败。

### Task 3: 重写森林路线后半段

**Files:**
- Modify: `data/story-packs/05-pixel-worlds-story/levels/forest-07.json` through `forest-20.json`

**Step 1: Write the content batch**

围绕“回应蓝色信号 → 找回绿色光种 → 修复森林网络 → 打开方块入口”重写 14 个节点，并让森林向导在节点 10、15、20 出现明确的关系和任务变化。

**Step 2: Run the content test**

Run: `node scripts/test-pixel-story-content-contract.mjs`

Expected: 科幻和森林路线通过内容重复检查。

### Task 4: 重写方块路线后半段和结局

**Files:**
- Modify: `data/story-packs/05-pixel-worlds-story/levels/block-07.json` through `block-20.json`

**Step 1: Write the content batch**

围绕“三界钥匙 → 地下城机关 → 回家门”重写 14 个节点。把 `block-20` 改成主线结局，明确三界朋友共同打开回家门，删除“下一季”语义。

**Step 2: Run the content test**

Run: `node scripts/test-pixel-story-content-contract.mjs`

Expected: 三条主路线通过内容契约。

### Task 5: 重写侦探隐藏支线

**Files:**
- Modify: `data/story-packs/05-pixel-worlds-story/levels/detective-01.json` through `detective-20.json`

**Step 1: Write the content batch**

按四组案件重写：蓝光失散、森林回应、方块钥匙、回家信。每组末尾必须产生一条可在下一组使用的新证据；`detective-20` 解释三界线索与回家光核的关系。

**Step 2: Run the content test**

Run: `node scripts/test-pixel-story-content-contract.mjs`

Expected: 四路线内容契约全部通过。

### Task 6: 更新文档和内容门禁说明

**Files:**
- Modify: `docs_project/runbooks/self-hosted/PIXEL-WORLDS-HERMES.md`
- Modify: `CHANGELOG.md`

**Step 1: Document the content contract**

记录四路线剧情结构、侦探支线结局、recognition-only 策略和新增内容测试命令。

**Step 2: Run documentation checks**

Run: `git diff --check`

Expected: no whitespace errors.

### Task 7: Run focused and browser verification

**Files:**
- Test: `scripts/test-pixel-story-content-contract.mjs`
- Test: `scripts/test-pixel-story-visual-assets-contract.mjs`
- Test: `scripts/test-pixel-worlds-assets-contract.mjs`
- Test: `scripts/test-pixel-story-published-artifact.mjs`
- Test: `scripts/test-exploration-entry-browser.mjs`
- Test: `scripts/test-pixel-story-pagination-browser.mjs`
- Test: `scripts/test-pixel-story-all-chapters-browser.mjs`

**Step 1: Run JSON/content tests**

Run: `node scripts/test-pixel-story-content-contract.mjs`

Expected: PASS.

**Step 2: Run asset and browser tests**

Run with `PETBANK_BASE_URL=http://127.0.0.1:8765/`:

```powershell
node scripts/test-pixel-story-visual-assets-contract.mjs
node scripts/test-pixel-worlds-assets-contract.mjs
node scripts/test-pixel-story-published-artifact.mjs
node scripts/test-exploration-entry-browser.mjs
node scripts/test-pixel-story-pagination-browser.mjs
node scripts/test-pixel-story-all-chapters-browser.mjs
```

Expected: all PASS; four routes open their first chapter and dialogue remains below the scene image.

**Step 3: Run final syntax and diff checks**

Run: `git diff --check`

Expected: no diff errors.
