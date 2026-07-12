# 编码规范

> 以下规范基于当前代码库实际模式提炼，非外部标准。新代码应遵循。

---

## 模块编写模板

### IIFE 模式（云端/工具类模块推荐）

```javascript
(function () {
    'use strict';

    // 1. 私有状态
    const state = { loading: false, error: '' };

    // 2. 工具函数（私有）
    function escapeHtml(value) { /* ... */ }
    function getClient() { /* ... */ }

    // 3. 公共 API（挂 window）
    window.ModuleName = {
        init: init,
        render: render,
        getState: function () { return state; }
    };
})();
```

### 命名空间模式（核心业务模块推荐）

```javascript
const ModuleName = (function () {
    // 私有变量
    let _privateVar = null;
    const PRIVATE_CONST = 42;

    // 公共方法
    function publicMethod() { /* ... */ }

    // 返回公共 API
    return {
        publicMethod: publicMethod,
        getState: function () { /* ... */ }
    };
})();
```

---

## 命名规范

| 类别 | 规范 | 示例 |
|------|------|------|
| localStorage key | `petbank_` 前缀 + 下划线分隔 | `petbank_home_state` |
| Profile 快照 key | `petbank_profile_data_{id}` | `petbank_profile_data_p1` |
| JS 全局模块 | PascalCase | `PetSystem`, `HomeSystem`, `CardArena` |
| JS 私有变量 | camelCase 或 _leading 下划线 | `completedTasks`, `_privateVar` |
| JS 常量 | UPPER_SNAKE_CASE | `TEAM_SIZE`, `MAX_LEVEL`, `DEFAULT_SCOPE` |
| CSS 类 | kebab-case | `top-nav`, `card-header`, `battle-fx-ring` |
| DOM id | kebab-case + 语义前缀 | `page-home`, `taskGrid`, `profileSwitcher` |
| 数据文件字段 | snake_case | `base_hp`, `min_level`, `imageStages` |
| HTML data 属性 | data-* kebab | `data-petbank-src`, `data-page` |

---

## 错误处理规范（建议统一为）

```javascript
// 原则：按影响范围选择处理级别

// Level 1: 用户可见错误 → showToast
if (typeof window.showToast === 'function') {
    window.showToast('操作失败：' + reason);
}

// Level 2: 开发者可见警告 → console.warn（带模块前缀）
console.warn('[ModuleName] non-critical failure:', error);

// Level 3: 可恢复错误 → try-catch + fallback
try {
    return JSON.parse(raw);
} catch (error) {
    return fallbackValue;
}

// Level 4: 致命错误 → 不吞，让它冒泡
// （不写空的 catch {}）
```

### 当前代码库中的错误处理模式

| 模式 | 何时用 | 何时不用 |
|------|--------|---------|
| `try {} catch (e) {}` 空块 | 数据加载失败不影响主流程 | 业务逻辑错误（会掩盖 bug） |
| `console.warn(...)` | 异步预加载/后台刷新失败 | 用户主动操作失败 |
| `showToast(...)` | 用户触发的操作需要反馈 | 后台静默操作 |
| return fallback | JSON 解析/数据读取 | 状态变更操作 |
| 不处理 | ❌ 永远不应该 | ❌ |

---

## localStorage 访问规范

```javascript
// ✅ 推荐：统一通过模块提供的 API
const pet = PetSystem.getState();
PetSystem.save();

// ❌ 避免：直接读写 localStorage
localStorage.setItem('petbank_pet', JSON.stringify(data)); // 应走 PetSystem.save()

// ✅ 新增 key 前：在 docs_project/data-contracts/localstorage-keys.md 注册
// ✅ 修改 key 结构：检查所有读写者（见 localstorage-keys.md）
```

---

## 中英文边界

| 区域 | 语言 |
|------|------|
| 面向儿童的 UI 文案 | 中文 |
| 代码注释 | 中文为主 |
| 变量名/函数名 | 英文（camelCase/PascalCase） |
| localStorage key | 英文（petbank_ 前缀） |
| JSON 数据字段 | 英文（snake_case） |
| console.log/warn | 英文（便于搜索） |
| Git commit message | 英文（conventional commits 风格） |

---

## 文件行数目标

| 类型 | 建议上限 | 当前最大 |
|------|---------|---------|
| JS 业务模块 | 500 行 | app.js 4411 行、learn-center.js 3656 行 ⚠️ |
| CSS 文件 | 1000 行 | style.css 6635 行、learn-center.css 3633 行 ⚠️ |
| HTML 文件 | 300 行 | index.html 1458 行 ⚠️ |
