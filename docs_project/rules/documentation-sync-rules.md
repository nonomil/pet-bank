# 文档同步维护规则

> 哪些代码改动必须同步哪些文档。不遵守的后果：AI 被错误行号带偏。

---

## 规则总表

| 改动类型 | 必须同步的文档 | 理由 |
|---------|--------------|------|
| 新增/删除/重命名 JS 模块文件 | `ARCHITECTURE.md` 目录结构, `README.md` 模块清单 | 模块索引失效 |
| 修改公开 API 函数签名 | 对应 `modules/*.md` 的函数表 + 行号 | AI 调用错误函数 |
| 新增/重命名/移动函数 | 对应 `modules/*.md` 的函数表 | 行号失效 |
| 新增 `petbank_*` localStorage key | `data-contracts/localstorage-keys.md` | key 矩阵缺漏 |
| 删除/重命名 localStorage key | `data-contracts/localstorage-keys.md` | 断链误导 |
| 修改 `data/*.json` 字段结构 | `data-contracts/*.md` 对应 schema | 数据契约过时 |
| 新增/修改教育内容（题目/文案/任务） | 如果是 JS 硬编码 → 标记到 `review/content-code-separation.md` | 内容分离追踪 |
| 新增测试/脚本 | `runbooks/testing-and-release.md` | 验证入口遗漏 |
| 修改页面路由（switchPage） | `ARCHITECTURE.md` 路由段 | 路由文档过时 |
| 修改 runtime-loader bundle | `modules/runtime-loader.md` | bundle 映射失效 |

---

## 不需要同步的情况

- 修改函数内部实现逻辑（只要签名不变、行号偏移 ≤5 行）
- 修改 CSS 样式（除非改变了 class 命名体系）
- 修改注释
- 修改 HTML 结构（除非改变了页面 id 或 data-* 属性）

---

## 行号偏移阈值

- 偏移 ≤ 3 行 → 可以不更新
- 偏移 4-10 行 → 下一轮修改时顺手更新
- 偏移 > 10 行 → 必须立即更新

---

## 版本全量扫描

每个版本发布前执行：

```bash
# 1. 断链检查（docs_project 内部所有链接是否可达）
find docs_project -name "*.md" -exec grep -oP '\[.*?\]\(.*?\)' {} \; | grep -v 'http'

# 2. 关键函数行号抽查
grep -n "function loadPetDB" js/pet.js
grep -n "function load\b" js/pet.js
grep -n "function addExp" js/pet.js
grep -n "const DIMENSIONS" js/app.js
grep -n "function switchPage" js/app.js
```

完整扫描脚本待 P2 实现。

---

## 新增模块文档模板

```markdown
# 模块名 (SystemName)

> 核心文件: `js/xxx.js` (行数)
> 数据文件: `data/xxx.json`

## 原理
### 设计目标
### 核心模型

## 实现
### 公共 API
| 函数 | 文件:行号 | 说明 |

### 持久化
key: petbank_xxx

## 注意事项
```
