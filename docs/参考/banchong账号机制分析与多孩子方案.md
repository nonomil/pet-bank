# banchong 账号机制分析 + 本项目多孩子/账号方案

> 来源：banchong.cn 账号体系实测（playwright 调研，日期 2026-06-28）
> 用途：为本项目（成长伙伴 · 萌宠冒险岛）评估"多孩子账户 / 云同步 / 账号体系"延后项提供决策依据，输出可落地的方案分级与首选设计。
> 关联文档：
> - 本项目现状：[../项目现状总览.md](../项目现状总览.md)（§6 延后项含"多孩子账户/云同步/登录体系"）
> - 技术架构：[../设计/技术架构.md](../设计/技术架构.md)（§7.2 功能边界：多用户同步/多孩子账户均不支持）
> - 同源互动借鉴：[./banchong宠物互动分析与合入方案.md](./banchong宠物互动分析与合入方案.md)
> - 需求规格：[../规格/需求规格书.md](../规格/需求规格书.md)

---

## 1. banchong 账号机制总结

### 1.1 整体模式

banchong 是 **后端 API 驱动 + JWT 鉴权** 的 SaaS 形态，定位为"班级宠物养成 + 积分管理"的教师工具。所有业务数据在后端，前端 localStorage 只缓存 state，账号是数据归属与多端访问的核心。

### 1.2 登录与鉴权

| 项 | 机制 |
|----|------|
| 登录入口 | `POST /api/v1/auth/login`，body `{phone, password}` |
| 返回主体 | teacher 对象：`id / phone / name / avatarUrl / vipStatus / inviteCode` + tokens |
| 鉴权方式 | JWT **双 token**：`accessToken`（短期，业务请求携带）+ `refreshToken`（长期，续期用） |
| 前端存储 | localStorage key `banchong-auth-storage`（含 teacher state + token） |
| 设备标识 | localStorage key `banchong_device_id`（UUID，用于设备识别） |

特点：手机号 + 密码注册登录，token 续期靠 refreshToken 静默刷新，设备码用于多设备识别与风控。

### 1.3 数据模型（teacher → classroom → student 三层）

banchong 的数据模型是**教育场景的三层结构**，一切围绕"教师管理班级学生"展开：

```
teacher（教师，账号主体）
  └── classroom（班级，归属 ownerId = teacherId）
        ├── student（学生，每生一只宠物）
        ├── groups（小组）
        ├── rules（规则/可配置任务体系）+ rule-categories
        └── student-tags（学生标签）
```

| 实体 | API | 关键字段 | 说明 |
|------|-----|----------|------|
| teacher | `/api/v1/auth/*` | id/phone/name/vipStatus/inviteCode | 账号主体，教师本人 |
| classroom | `GET/POST /api/v1/classrooms` | id/name/joinCode/theme/ownerId | 班级，ownerId 串到教师 |
| student | `GET /api/v1/classrooms/{id}/students` | — | 班级下的学生，每生一只宠物 |
| groups | `/api/v1/classrooms/{id}/groups` | — | 班内分组 |
| rules | `/api/v1/classrooms/{id}/rules` + `/rule-categories` | — | 可配置任务体系（积分来源） |
| student-tags | `/api/v1/classrooms/{id}/student-tags` | — | 学生标签 |

### 1.4 后端 API 驱动 vs 前端 localStorage

| 维度 | banchong | 说明 |
|------|----------|------|
| 数据真源 | 后端数据库 | 前端 localStorage 仅缓存 state（`banchong-auth-storage` / `banchong-classroom-storage`） |
| 访问方式 | REST + JWT | 所有业务请求带 accessToken |
| 多端一致性 | 天然支持 | 数据在后端，任意设备登录即恢复 |
| 离线能力 | 弱 | 依赖网络与后端可用性 |

### 1.5 商业化与社交

| 机制 | 含义 | 作用 |
|------|------|------|
| `vipStatus`（如 LIFETIME） | 会员等级 | 商业化变现，会员特权 |
| `inviteCode` | 教师邀请码 | 社交裂变，拉新教师 |
| `joinCode` | 班级加入码 | 学生/家长加入班级，社交分发 |
| 音效 `sfx_score_up/down` | 积分增减音效 | 反馈强化（非账号机制，顺带记录） |

---

## 2. 本项目对比与差距

本项目（pet-bank）当前是**纯前端 SPA + localStorage**，定位"家庭单孩子积分银行"，无后端、无登录、无账号体系。

### 2.1 对比表

| 维度 | banchong | 本项目现状 | 差距 |
|------|----------|------------|------|
| 产品定位 | 班级教育 SaaS（教师工具） | 家庭单孩子积分银行 | 场景不同，模型不可直接照搬 |
| 后端 | 有（REST + DB） | 无（纯前端 GitHub Pages） | 缺整个服务端 |
| 鉴权 | JWT 双 token + 手机号 | 无登录 | 缺账号体系 |
| 账号主体 | teacher | 无（仅侧栏 `childName` 输入框） | 无账户归属 |
| 数据模型 | teacher-classroom-student 三层 | 单孩子单设备 localStorage | 无多孩子/多实体 |
| 数据存储 | 后端 DB，前端缓存 | localStorage `petbank_*` 系列键 | 单设备，清缓存即丢 |
| 多设备同步 | 天然支持 | 不支持 | 换设备/换浏览器数据不互通 |
| 多孩子 | 班级下多 student | 不支持 | 仅单孩子 |
| 商业化 | VIP / inviteCode / joinCode | 无 | 非家庭场景必需 |
| 社交 | 班级加入码 | 无 | 非家庭场景必需 |

### 2.2 本项目 localStorage 键现状（C 方案设计依据）

经源码核实（`js/app.js` / `pet.js` / `inventory.js` / `exploration.js` / `walk.js` / `treasure.js` / `card-collection.js`），现有持久化键统一以 `petbank_` 前缀：

| 键 | 用途 | 写入位置 |
|----|------|----------|
| `petbank_points` | 总积分 | app.js / exploration.js |
| `petbank_completed` | 已完成任务 | app.js |
| `petbank_tasks_completed_today` | 今日完成计数 | app.js / treasure.js |
| `petbank_pet` | 宠物状态 | pet.js |
| `petbank_inventory` | 背包 | inventory.js |
| `petbank_unlocked_scenes` | 已解锁场景 | exploration.js |
| `petbank_walk_data` / `petbank_walk_logs` | 遛弯数据/日志 | walk.js |
| `petbank_awarded_series` | 图鉴已发放系列 | card-collection.js |

特征：**所有键扁平、无 profile 维度、无用户隔离**，这正是单孩子设计的体现，也是 C 方案要改造的核心点。

---

## 3. 方案选项（4 个）

### 方案 A：保持现状（纯前端单孩子，不动）

| 维度 | 内容 |
|------|------|
| 实现思路 | 不动账号/同步，延后所有相关需求 |
| 技术栈 | 维持现状（HTML + Vanilla JS + localStorage） |
| 工作量 | 0 |
| 适用场景 | 单孩子家庭、单设备使用、现阶段主链路收口期 |
| 优点 | 零成本、零风险、不偏离当前"做产品收口"阶段 |
| 缺点 | 多设备不同步、不支持多孩子、清缓存即丢数据 |
| 备注 | 与 [../项目现状总览.md](../项目现状总览.md) §6 延后项一致，是当前默认状态 |

### 方案 B：轻量云同步（无账号体系）

| 维度 | 内容 |
|------|------|
| 实现思路 | localStorage 数据同步到云端 KV，用设备码 / 同步码识别，不建账号 |
| 技术栈 | 可选：① GitHub Gist（家长提供 token，零后端）；② 简易 KV 后端（Cloudflare Workers + KV / Vercel KV）；③ Firebase Realtime DB（托管） |
| 工作量 | 中（1-2 周）：同步层 + 冲突合并策略 + UI |
| 适用场景 | 单孩子但需多设备（家多台电脑/平板）、家长有基础技术能力 |
| 优点 | 多设备同步、无需登录注册、保留纯前端主体 |
| 缺点 | 无账号归属（靠码识别，换设备靠同步码恢复）、需家长提供 token 或托管凭据、有冲突合并复杂度 |
| 风险 | Gist 方案暴露 token、KV 方案引入轻后端运维 |

### 方案 C：多孩子本地切换（纯前端，无后端）

| 维度 | 内容 |
|------|------|
| 实现思路 | localStorage 多 profile，家庭多娃本地切换，每个 profile 数据键带 profileId 前缀 |
| 技术栈 | 维持纯前端（Vanilla JS + localStorage），新增 profile 管理 UI + storage helper |
| 工作量 | 中低（3-6 天）：storage 封装 + profile 管理 UI + 现有键迁移 + 切换逻辑 |
| 适用场景 | 家庭多娃、单设备、不需要云同步 |
| 优点 | 纯前端可实现、契合家庭场景、不引入后端、向后兼容现有单孩子数据 |
| 缺点 | 仍单设备（无云同步）、profile 管理需新增 UI |
| 备注 | 本项目"家庭非班级"定位下，性价比最高的延后项落地 |

### 方案 D：完整账号体系（学 banchong）

| 维度 | 内容 |
|------|------|
| 实现思路 | 后端 + JWT + 账号-家庭-孩子三层 + 云同步 |
| 技术栈 | 后端（Node/Go/Python + DB）+ JWT + 前端改造 |
| 工作量 | 大（4-8 周）：后端全栈 + 鉴权 + 数据迁移 + 运维 + 部署 |
| 适用场景 | 商业化、班级场景、跨家庭社交、多设备强一致 |
| 优点 | 完整、多设备、强一致、可商业化、可社交 |
| 缺点 | 需后端、工作量大、偏离"纯前端零运维"核心定位、与"家庭单孩子"定位错配 |
| 风险 | 引入运维成本、安全责任（未成年人数据）、合规风险 |

---

## 4. 推荐方案

结合本项目定位 —— **"家庭单孩子积分银行，纯前端 GitHub Pages 静态部署，零后端零运维"**（见 [../项目现状总览.md](../项目现状总览.md) §1、[../设计/技术架构.md](../设计/技术架构.md) §1/§7），推荐分阶段：

### 4.1 优先 C：多孩子本地切换

- **理由**：纯前端可实现，不破坏"零后端"核心定位；家庭多娃是真实场景（本就是"家庭"积分银行）；工作量可控；向后兼容现有单孩子数据。
- **明确不照搬 banchong**：banchong 的 teacher-classroom-student 三层是"教师管班级"模型，本项目是"家长管自己家娃"，不需要 classroom 这一层，profile 直接对齐"孩子"实体即可。

### 4.2 可选 B：轻量云同步（C 之上叠加）

- **理由**：C 落地后若出现"多设备同步"诉求，再叠加 B；优先选 GitHub Gist（家长提供 token，零后端零运维）或 Cloudflare Workers + KV（免费额度内）。
- **同步设计要点**：以 profile 为同步单元；last-write-wins + 时间戳合并；设备码 `petbank_device_id` 识别来源；提供手动"上传/拉取"按钮，避免自动同步的冲突复杂度。

### 4.3 延后 D：完整账号体系

- **理由**：除非转向商业化或班级场景，否则 D 不必要 —— 本项目刻意选择"零后端"换取零运维与即开即用（见 [../设计/技术架构.md](../设计/技术架构.md) §7.3）。引入服务端意味着安全责任（未成年人数据）、合规风险、运维成本，与当前定位严重错配。
- **触发条件**：明确要做班级场景 / 商业化 / 跨家庭社交时再评估。

### 4.4 借鉴边界（明确不照搬）

| banchong 机制 | 是否借鉴 | 原因 |
|---------------|----------|------|
| JWT 双 token | 否（D 才需要） | 纯前端无需鉴权 |
| teacher-classroom-student 三层 | 否 | 班级模型，家庭无 classroom 层 |
| VIP / inviteCode / joinCode | 否 | 商业化/社交裂变，家庭积分银行不需要 |
| 后端 API 驱动 | 否（除非上 B/D） | 与"纯前端"定位冲突 |
| **多实体 + 数据隔离**（思想） | **是** | 借鉴"多个独立数据空间"思想 → 本项目落地为多 profile |
| **设备码识别**（思想） | **是**（B 方案） | 借鉴 `device_id` 用于多设备同步识别 |

---

## 5. C 方案（多孩子本地切换）详细设计

### 5.1 localStorage 结构设计

新增三个元数据键，业务数据键改为按 profileId 分隔：

#### 5.1.1 profile 列表（新增）

key：`petbank_profiles`

```json
[
  { "id": "p_default", "name": "默认孩子", "avatar": "🐱", "createdAt": 1719600000000 },
  { "id": "p_1719601234567", "name": "二宝", "avatar": "🐶", "createdAt": 1719601234567 }
]
```

#### 5.1.2 当前激活 profile（新增）

key：`petbank_active_profile`

```json
"p_1719601234567"
```

#### 5.1.3 业务数据键改造（前缀化）

原 `petbank_<key>` → `petbank_{profileId}_<key>`，例如：

| 原键 | 改造后 |
|------|--------|
| `petbank_points` | `petbank_{profileId}_points` |
| `petbank_completed` | `petbank_{profileId}_completed` |
| `petbank_tasks_completed_today` | `petbank_{profileId}_tasks_completed_today` |
| `petbank_pet` | `petbank_{profileId}_pet` |
| `petbank_inventory` | `petbank_{profileId}_inventory` |
| `petbank_unlocked_scenes` | `petbank_{profileId}_unlocked_scenes` |
| `petbank_walk_data` | `petbank_{profileId}_walk_data` |
| `petbank_walk_logs` | `petbank_{profileId}_walk_logs` |
| `petbank_awarded_series` | `petbank_{profileId}_awarded_series` |

全局共享数据（不随 profile 切换）保持无前缀：`petbank_profiles`、`petbank_active_profile`、`petbank_device_id`（若 B 方案引入）、静态模板（pets/scenes/items 不入库）。

### 5.2 向后兼容（关键）

首次升级时，若无 `petbank_profiles`：

1. 自动创建默认 profile `{id:"p_default", name:"默认孩子", avatar:"🐱", createdAt:now}`；
2. 把现有 `petbank_*` 业务键一次性迁移到 `petbank_p_default_*`（复制而非删除，保留原键作为回滚兜底，下次启动确认无误后再清理）；
3. 设置 `petbank_active_profile = "p_default"`。

这样老用户升级零感知，数据不丢。

### 5.3 storage helper 封装（核心改动点）

新增 `js/storage.js`（或在 app.js 顶部），提供 profile 感知的读写接口，避免散落在各模块的 `localStorage.setItem('petbank_xxx')` 逐个改：

```js
const ProfileStorage = {
  // 获取当前 profileId
  getActiveId() {
    return localStorage.getItem('petbank_active_profile') || this._ensureDefault();
  },
  // 拼 profile 化的 key
  key(name) {
    return `petbank_${this.getActiveId()}_${name}`;
  },
  get(name, fallback) {
    const v = localStorage.getItem(this.key(name));
    return v == null ? fallback : v;
  },
  getJSON(name, fallback) { /* JSON.parse 包装 */ },
  set(name, value) { localStorage.setItem(this.key(name), value); },
  setJSON(name, obj) { localStorage.setItem(this.key(name), JSON.stringify(obj)); },
  // 切换 profile：保存当前 → 切换 active → 由各模块重新 load
  switchTo(profileId) {
    localStorage.setItem('petbank_active_profile', profileId);
  },
  // 新建/删除/重命名 profile（含删除时清理其业务键）
  create(name, avatar) { /* push 到 petbank_profiles */ },
  remove(profileId) { /* 从 petbank_profiles 移除 + 清理 petbank_{profileId}_* */ },
  rename(profileId, name) { /* 更新 petbank_profiles */ },
  _ensureDefault() { /* 首次迁移逻辑（§5.2） */ }
};
```

### 5.4 切换 profile 流程

```
用户点击切换 → ProfileStorage.switchTo(targetId)
  → 触发全局事件 'profileChanged'
  → 各模块监听并重新 load()（PetSystem.load / InventorySystem.load / exploration 等）
  → 统一刷新 UI（renderApp / renderPet / renderInventory ...）
  → 顶部积分胶囊、侧栏孩子名同步更新
```

### 5.5 profile 管理 UI

- 入口：左侧栏孩子名旁加"切换/管理"按钮，或顶部新增"家庭"下拉。
- 功能：新建（输入名+选 emoji 头像）、切换、重命名、删除（删除前二次确认 + 提示"该孩子所有数据将清除"）。

### 5.6 涉及改动清单

| 文件 | 改动 |
|------|------|
| `js/app.js` | 所有 `localStorage.getItem/setItem('petbank_*')` 改走 `ProfileStorage`；积分胶囊/侧栏孩子名读 active profile；新增 profile 管理 UI 渲染 |
| `js/pet.js` | `load()/save()` 的 `'petbank_pet'` 改为 `ProfileStorage.key('pet')` |
| `js/inventory.js` | `'petbank_inventory'` 改为 `ProfileStorage.key('inventory')` |
| `js/exploration.js` | `'petbank_unlocked_scenes'` / `'petbank_points'` 改走 helper |
| `js/walk.js` | `'petbank_walk_data'` / `'petbank_walk_logs'` 改走 helper |
| `js/card-collection.js` | `'petbank_awarded_series'` 改走 helper |
| `js/treasure.js` | `'petbank_tasks_completed_today'` 读取改走 helper |
| 新增 `js/storage.js` | ProfileStorage 封装 + 迁移逻辑 |
| `index.html` | 引入 `storage.js`（在 app.js 之前）；侧栏/顶部加 profile 切换 UI |

### 5.7 风险与注意事项

- **数据迁移**：首次启动迁移必须幂等（检测 `petbank_profiles` 是否存在，存在则跳过）。
- **全局变量同步**：`app.js` 的 `totalPoints` / `completedTasks` 等内存态在切换 profile 时必须重新从 helper load，避免串档。
- **math-pk 回写**：`math-pk.js` 把积分回写主账本，切换 profile 后需确保写到当前 profile 的 points 键。
- **删除 profile 清理**：删除时遍历清理所有 `petbank_{profileId}_*` 键，防止残留占空间。

---

## 6. 不建议照搬（差异总结）

| banchong 机制 | 不照搬原因 |
|---------------|------------|
| teacher-classroom-student 三层 | 班级教育场景，家庭无 classroom 层，profile 直接对齐孩子即可 |
| VIP / inviteCode / joinCode | 商业化变现与社交裂变，家庭积分银行无此诉求 |
| 后端 API 驱动 + JWT | 与本项目"纯前端零运维"核心定位冲突，除非明确上 B/D |
| 教师定价权 / 班级展示 | 教育场景特化，家庭场景无意义 |

**可借鉴的思想（去场景化）**：
- 多实体数据隔离 → 多 profile（C 方案）
- 设备码识别 → 多设备同步识别（B 方案）
- 数据归属与多端一致性 → 云同步方向（B/D）

---

## 7. 结论

本项目当前阶段（M0 收口完成，进入"产品收口与深化"）应继续以 [../项目现状总览.md](../项目现状总览.md) §5 推荐顺序为主线（商店家具联动 → 战斗深化 → 数据一致性），**账号/多孩子相关延后项不急于上 D**。

当"多孩子家庭"成为明确诉求时，**优先落地 C（纯前端多 profile）**，性价比最高且不破坏定位；若后续出现多设备同步诉求，再在 C 之上叠加 B（GitHub Gist 或 Cloudflare KV）；**D（完整账号体系）仅在转向商业化/班级场景时才评估**。

banchong 的教师-班级-学生三层与 VIP/joinCode 体系是教育 SaaS 的产物，本项目作为家庭积分银行，只借鉴其"多实体隔离 + 设备识别"思想，不照搬场景化模型。
