# 班宠乐园2 动物导入 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 `班宠乐园2` 的动物宠物以独立来源 `banchong2` 导入当前项目，归入 `奇趣冒险馆 -> 萌爪伙伴册`，并补齐本地 `.webp` 素材、图鉴故事与前端入口。

**Architecture:** 先把远端动物目录和等级信息固化为本地快照，再用 Python + Pillow 导入脚本把源站 10 级图片按 `[1, 2, 4, 6, 8, 10]` 映射成项目现有的 6 阶 `.webp` 资产。随后更新 `data/pets.json`、`data/pokedex-lore-draft.json`、`js/card-collection.js`、`js/app.js` 与 `js/pet.js`，最后用格式回归和图鉴回归确保新宠物可见、可读、可快载入。

**Tech Stack:** Static JSON, Vanilla JS, Python (Pillow 12.x), local asset pipeline, browser-act/manual validation, existing Python/MJS regression tests

---

### Task 1: 固化班宠乐园2动物目录快照

**Files:**
- Create: `data/source-snapshots/banchong2-animals.json`
- Create: `data/source-snapshots/banchong2-levels.json`

**Step 1: 导出动物目录**

- 从已确认可访问的 `班宠乐园2` 接口中导出 `/api/pets`
- 只保留 `category === "ANIMAL"` 的记录
- 同时保存 `/api/pets/levels` 的等级范围结果

**Step 2: 运行快照自检**

Run:

```bash
@'
const fs = require("fs");
const pets = JSON.parse(fs.readFileSync("data/source-snapshots/banchong2-animals.json", "utf8"));
const levels = JSON.parse(fs.readFileSync("data/source-snapshots/banchong2-levels.json", "utf8"));
console.log({ animalCount: pets.length, levels });
'@ | node
```

Expected:

- 能输出动物数量
- 等级信息确认覆盖 `1..10`

### Task 2: 先写导入契约和图片格式失败回归

**Files:**
- Create: `prj/pet_banchong2_import_contract.test.py`
- Create: `prj/pet_image_format_contract.test.py`

**Step 1: 编写失败断言**

覆盖以下行为：

- `js/card-collection.js` 中存在 `banchong2`
- `奇趣冒险馆` 的 source 集合包含 `banchong2`
- adventure 主题册出现 `萌爪伙伴册`
- `data/pets.json` 中新导入宠物的阶段图路径全部位于 `assets/banchong2/`
- 新导入宠物的主展示图片路径不允许出现 `.bmp / .jpg / .jpeg`

**Step 2: 运行测试并确认失败**

Run:

```bash
python prj/pet_banchong2_import_contract.test.py
python prj/pet_image_format_contract.test.py
```

Expected:

- 当前仓库应先 FAIL，因为 `banchong2` 还没真正接入

### Task 3: 编写导入脚本并生成 6 阶 `.webp` 资产

**Files:**
- Create: `scripts/import_banchong2_animals.py`
- Create: `data/source-snapshots/banchong2-import-manifest.json`
- Create: `assets/banchong2/...`

**Step 1: 实现最小导入脚本**

脚本职责：

- 读取 `data/source-snapshots/banchong2-animals.json`
- 为每只宠物按 `baseAssetUrl + level` 生成远端下载地址
- 使用 Python Pillow 下载并转换为本地 `.webp`
- 生成 6 阶阶段图，映射规则固定为 `[1, 2, 4, 6, 8, 10]`
- 产出可供后续写入 `data/pets.json` 的 manifest

**Step 2: 运行脚本生成素材**

Run:

```bash
& "C:\Users\No'mi'l\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe" scripts/import_banchong2_animals.py
```

Expected:

- `assets/banchong2/` 下生成本地 `.webp`
- manifest 记录每只宠物的本地路径和阶段映射

**Step 3: 抽样检查图片格式**

Run:

```bash
Get-ChildItem -Recurse assets/banchong2 -Filter *.webp | Select-Object -First 12 -ExpandProperty FullName
```

Expected:

- 抽样结果全部为 `.webp`

### Task 4: 把新宠物写入 `data/pets.json`

**Files:**
- Modify: `data/pets.json`

**Step 1: 生成或追加运行时条目**

为每只导入宠物补齐：

- `id`
- `name`
- `series`
- `rarity`
- `source: "banchong2"`
- `desc`
- `base_hp / base_atk / base_def / base_spd`
- `stages`
- `imageUrl`
- 必要时的 `imageStages / imageStyle`

说明：

- 先保证 6 阶成长图可用
- 合成卡面 `assets/cards/composed-v2` 不是本轮硬阻塞，因为首页已有 fallback

**Step 2: 运行数据契约测试**

Run:

```bash
python prj/pet_banchong2_import_contract.test.py
python prj/pet_card_redesign.test.py
```

Expected:

- 与数据结构相关的断言转绿

### Task 5: 补全 `萌爪伙伴册` 图鉴故事与来源接线

**Files:**
- Modify: `data/pokedex-lore-draft.json`
- Modify: `js/card-collection.js`
- Modify: `js/app.js`
- Modify: `js/pet.js`

**Step 1: 补 lore 数据**

为每只新宠补全：

- `codexTitle`
- `subtitle`
- `intro`
- `origin`
- `childhood`
- `school`
- `work`
- `hobby`
- `specialty`
- `ability`
- `story`
- `traits`
- `skills`

**Step 2: 接入分馆与来源**

- 在 `SOURCE_DETAIL_LABELS` 中新增 `banchong2`
- 让 `奇趣冒险馆` 的 `sourceKeys` 接收 `banchong2`
- 在 `THEME_BOOKLETS.adventure` 中加入 `萌爪伙伴册`
- 在 `js/app.js` 的来源筛选里增加 `banchong2`
- 在 `js/pet.js` 中把 `banchong2` 视为多阶段宠物来源，避免只对旧 `banchong` 生效

**Step 3: 运行图鉴相关测试**

Run:

```bash
python prj/pet_gallery_home_refresh.test.py
python prj/pet_pokedex_detail_layout.test.py
python prj/pet_pokedex_dossier_linkage.test.py
python prj/pokedex_lore_copy_quality.test.py
```

Expected:

- `萌爪伙伴册` 可进入图鉴
- 新宠详情页有故事、有档案、有成长图

### Task 6: 做一轮图片格式与慢图回归

**Files:**
- Modify: `prj/pet_image_format_contract.test.py`
- Optionally modify: `prj/pet_card_image_loading_regression.test.mjs`

**Step 1: 收紧格式检查**

确保：

- `banchong2` 运行时阶段图全部是本地 `.webp`
- 新图鉴主链路不新增 `.bmp / .jpg / .jpeg`
- 如发现旧链路仍有非 webp 资源，先记录并与本轮新增资源分开

**Step 2: 运行格式与加载回归**

Run:

```bash
python prj/pet_image_format_contract.test.py
node prj/pet_card_image_loading_regression.test.mjs
```

Expected:

- 新导入资源全部满足格式约束
- 图鉴加载回归通过

### Task 7: 本地手验与 browser-act 复核

**Files:**
- Verify runtime behavior only

**Step 1: 启动本地页面**

Run:

```bash
python -m http.server 8765 --bind 127.0.0.1
```

**Step 2: 手验图鉴**

重点检查：

- `奇趣冒险馆 -> 萌爪伙伴册`
- 图鉴首页卡片 fallback 是否正常
- 详情页 6 阶成长图是否完整
- 新宠故事和档案字段是否显示

**Step 3: 用 browser-act 复核来源与本地呈现**

- 回看源站动物图是否与本地导入对象一致
- 对照抽查几只宠物的 6 阶映射是否符合 `[1, 2, 4, 6, 8, 10]`
- 确认页面里没有新引入的慢图格式

### Task 8: 最终回归与提交

**Files:**
- Stage only files touched for this import

**Step 1: 运行最终检查**

Run:

```bash
node --check js/app.js
node --check js/card-collection.js
node --check js/pet.js
python prj/pet_banchong2_import_contract.test.py
python prj/pet_image_format_contract.test.py
python prj/pet_gallery_home_refresh.test.py
python prj/pet_pokedex_detail_layout.test.py
```

Expected:

- 语法检查通过
- 关键回归通过

**Step 2: 提交改动**

```bash
git add data/pets.json data/pokedex-lore-draft.json js/card-collection.js js/app.js js/pet.js scripts/import_banchong2_animals.py data/source-snapshots/banchong2-animals.json data/source-snapshots/banchong2-levels.json data/source-snapshots/banchong2-import-manifest.json prj/pet_banchong2_import_contract.test.py prj/pet_image_format_contract.test.py assets/banchong2
git commit -m "feat: import banchong2 animals into adventure gallery"
```
