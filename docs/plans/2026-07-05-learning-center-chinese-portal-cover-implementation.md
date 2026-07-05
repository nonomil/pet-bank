# 学习中心中文资料包封面图 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `幼小衔接暑假中文资料包` 生成一张新的 Agnes 封面图，并替换学习入口大厅中的旧书堆图。

**Architecture:** 复用仓库现有 Agnes 生成脚本模式，新建一个面向学习入口封面的轻量生成脚本，把最终资源输出到 `assets/learn/`。运行时只改 `LearnCenter` 中文入口卡的图片路径和少量展示参数，不重写布局。

**Tech Stack:** Python 3、Agnes image API、Vanilla JS、现有学习中心 smoke 脚本

---

### Task 1: 写入设计文档并沉淀实现入口

**Files:**
- Create: `docs/plans/2026-07-05-learning-center-chinese-portal-cover-design.md`
- Create: `docs/plans/2026-07-05-learning-center-chinese-portal-cover-implementation.md`
- Modify: `docs/plans/README.md`

**Step 1: 补最小设计稿**

写清楚风格方向、构图锚点、禁止项、接入策略和验收标准。

**Step 2: 补最小实施计划**

把生成、接图、校验三步写清楚，便于后续继续扩更多学习入口封面图。

**Step 3: 在计划索引中登记**

把这次中文资料包封面图设计稿和实施计划加进 `docs/plans/README.md`。

---

### Task 2: 新增 Agnes 中文封面图生成脚本

**Files:**
- Create: `scripts/generators/gen_learning_portal_covers.py`
- Test: 手工执行脚本

**Step 1: 复用现有 Agnes 调用模式**

参考：

- `scripts/generators/gen_gallery_covers.py`
- `scripts/generators/gen_hanzi_images.py`

**Step 2: 定义中文资料包封面 prompt**

目标 prompt 需要明确：

- 暖黄绘本课堂
- 课桌学习角
- 晨光窗边
- 拼音卡、田字格、古诗卷轴、小书包、铅笔、绘本
- 无人物、无文字、无 UI

**Step 3: 输出到固定路径**

脚本输出：

- `assets/learn/portal-chinese-summer-classroom-20260705.png`

并同时写 `_result.json` 记录 prompt、模型和结果。

---

### Task 3: 接入学习中心中文入口卡

**Files:**
- Modify: `js/learn-center.js`

**Step 1: 替换中文入口卡图片路径**

把中文资料包入口卡的：

- `imageSrc: 'assets/decor/book_stack.webp'`

改为：

- `imageSrc: 'assets/learn/portal-chinese-summer-classroom-20260705.png'`

**Step 2: 微调图片显示参数**

根据生成图效果补一个更合适的：

- `imageStyle`

优先保证主体在卡片中间偏下、底部徽章不压主物件。

---

### Task 4: 补中文封面图回归校验

**Files:**
- Modify: `scripts/learning-center-smoke.mjs`

**Step 1: 读取中文入口卡图片路径**

在学习首页运行态里补充：

- 中文卡 `img src`

**Step 2: 新增断言**

新增中文封面图路径断言，确保后续不会回退到旧书堆图。

---

### Task 5: 更新资源文档并验证

**Files:**
- Modify: `docs/GPT生图/README.md`
- Modify: `docs/plans/README.md`

**Step 1: 记录新资产**

把中文资料包入口封面图加到 Agnes 资产记录里。

**Step 2: 运行校验**

Run:

```bash
node --check js/learn-center.js
node --check scripts/learning-center-smoke.mjs
node scripts/learning-center-smoke.mjs
```

Expected:

- JS 语法通过
- smoke 中出现中文封面图新路径
- 学习中心主链路继续通过
