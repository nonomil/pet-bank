# Warm Home Dashboard Demo Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a small demo project under `prj` that showcases a warm companion-style pet points home dashboard together with the exact input-pack artifacts that would be handed to Codex.

**Architecture:** Create a self-contained static frontend demo with local mock data and companion markdown assets. Keep the implementation framework-free so the UI can open directly, while still separating data, rendering logic, styles, and prompt/spec documentation clearly.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Markdown, lightweight Python smoke verification.

---

### Task 1: Scaffold the demo folder and write the failing smoke test

**Files:**
- Create: `G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/`
- Create: `G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/smoke.test.py`

**Step 1: Write the failing test**

- Assert `index.html` contains container hooks for:
  - `app-shell`
  - `pet-hero`
  - `points-progress`
  - `task-grid`
  - `reward-feed`
- Assert `styles.css` contains:
  - `hero-card`
  - `task-card`
  - `progress-card`
- Assert companion docs exist:
  - `spec.md`
  - `design-guidelines.md`
  - `codex-prompt.md`

**Step 2: Run test to verify it fails**

Run: `python G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/smoke.test.py`

Expected: FAIL because the demo files do not exist yet.

### Task 2: Create the HTML shell and mock data

**Files:**
- Create: `G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/index.html`
- Create: `G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/data.js`

**Step 1: Build the static page shell**

- Add a semantic app wrapper
- Add sections for greeting, hero, progress, tasks, rewards, and family support
- Include hooks for JS rendering and CSS targeting

**Step 2: Add mock product data**

- Model the child/family greeting
- Model pet status and streak
- Model daily points summary
- Model 3 sample tasks
- Model reward / growth feed items

### Task 3: Implement styles and rendering logic

**Files:**
- Create: `G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/styles.css`
- Create: `G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/app.js`

**Step 1: Style the warm dashboard**

- Add a layered morning-sky background
- Add large rounded cards, soft shadows, and warm type hierarchy
- Make the hero card the visual anchor
- Keep layout responsive for narrow screens

**Step 2: Render the dashboard from data**

- Render greeting copy
- Render pet hero state
- Render progress card and progress bar
- Render task cards with one highlighted priority item
- Render reward/growth cards and family note

### Task 4: Add the Codex input-pack artifacts

**Files:**
- Create: `G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/spec.md`
- Create: `G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/design-guidelines.md`
- Create: `G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/codex-prompt.md`
- Create: `G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/README.md`

**Step 1: Write the product spec**

- Describe user goal, structure, actions, states, and sample content

**Step 2: Write the design guidelines**

- Capture palette, hierarchy, spacing, card patterns, state guidance, and “must preserve” notes

**Step 3: Write the Codex prompt artifact**

- Combine spec + design rules + implementation expectations into a ready-to-reuse prompt

**Step 4: Write README**

- Explain what the demo demonstrates
- Explain how to open and verify it locally

### Task 5: Verify green and close out

**Files:**
- Test: `G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/smoke.test.py`
- Test: `G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/index.html`
- Test: `G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/app.js`

**Step 1: Run smoke verification**

Run:
- `python G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/smoke.test.py`
- `node --check G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/app.js`

Expected: PASS

**Step 2: Manual visual verification**

- Open `G:/StudyCode/宠物积分系统/prj/home-dashboard-warm-demo/index.html`
- Confirm the hero card, progress card, task grid, reward feed, and family note render correctly
- Confirm the page feels companion-first rather than admin-dashboard-like

**Step 3: Close out**

- Summarize what was built
- Call out any remaining gaps honestly
