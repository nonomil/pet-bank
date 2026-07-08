# 云端同步系统

> 配置加载: [js/cloud-config-loader.js](../../js/cloud-config-loader.js) (57行)
> 客户端封装: [js/cloud-client.js](../../js/cloud-client.js) (220行)
> 数据同步: [js/cloud-sync.js](../../js/cloud-sync.js) (447行)
> 数据恢复: [js/cloud-restore.js](../../js/cloud-restore.js) (120行)
> 诊断工具: [js/cloud-diagnostics.js](../../js/cloud-diagnostics.js) (601行)
> Profile同步: [js/profile-sync.js](../../js/profile-sync.js)
> 认证: [js/auth.js](../../js/auth.js), [js/admin-auth.js](../../js/admin-auth.js)
> Supabase SDK: [js/vendor/supabase-js.js](../../js/vendor/supabase-js.js) (2.1MB)

---

## 原理

### 设计目标
云端同步是可选的——应用默认以 local-only 模式运行，所有数据存 localStorage。当家长配置了 Supabase 后，才启用云端同步，实现多设备数据一致和家庭成员共享。

### 核心架构

```
配置加载链路:
  cloud-config-loader.js
    ├── 1. 读取 js/cloud-config.public.js（站点内置配置）
    ├── 2. localhost/file 协议时读取 cloud-config.local.js（本地覆盖）
    └── 3. 写入 window.__PETBANK_CLOUD_CONFIG__

客户端初始化:
  cloud-client.js
    ├── 读取 window.__PETBANK_CLOUD_CONFIG__（运行时配置）
    ├── 读取 localStorage petbank_cloud_config（持久化配置）
    ├── 检查 window.APP_SUPABASE_*（旧版兼容）
    └── 创建 Supabase client 实例

认证:
  auth.js (AuthSystem)
    ├── boot(): 检查现有 session
    ├── signIn/signUp: 邮箱密码认证
    └── 家庭邀请码注册

同步:
  cloud-sync.js (CloudSync)
    ├── scheduleSync(reason): 节流触发同步
    ├── push/pull: 双向数据同步
    └── 冲突策略: last-write-wins

恢复:
  cloud-restore.js (CloudRestore)
    └── hydrateFromCloud(): 从云端拉取数据写回 localStorage
```

---

## 实现

### CloudConfigLoader (cloud-config-loader.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `loadOptionalConfig(path, sourceKey, sourceLabel)` | :30-48 | 加载可选配置文件 |
| `shouldTryRootLocalOverride()` | :23-28 | 判断是否尝试本地 override |
| `__PETBANK_OPTIONAL_BOOTSTRAP__` | :50-55 | 启动时自动执行的配置加载 Promise |

### CloudClient (cloud-client.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `readPersistedConfig()` | :13-22 | 读取 localStorage 持久化配置 |
| `readRuntimeConfig()` | :24-50 | 合并运行时+持久化+旧版配置 |
| `getClient()` | :60 | 获取 Supabase client 实例（懒创建） |
| `getStatus()` | :80 | 获取云端状态 `{enabled, hasClient, supabaseUrl}` |

### CloudSync (cloud-sync.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `CloudSync.scheduleSync(reason)` | :100 | 节流触发同步（debounce ~2s） |
| `CloudSync.push()` | :200 | 上传本地数据到云端 |
| `CloudSync.pull()` | :300 | 从云端拉取数据 |
| `CloudSync.getStatus()` | :400 | 获取同步状态 |

### CloudRestore (cloud-restore.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `CloudRestore.hydrateFromCloud()` | :50 | 从云端恢复数据到 localStorage |
| `CloudRestore.getSnapshot(profileId)` | :71 | 获取 profile 云快照 |

### AuthSystem (auth.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `AuthSystem.boot()` | :100 | 启动认证系统 |
| `AuthSystem.signIn(email, password)` | :200 | 登录 |
| `AuthSystem.signUp(email, password)` | :250 | 注册 |
| `AuthSystem.signOut()` | :300 | 登出 |
| `AuthSystem.getState()` | :50 | 获取认证状态 |
| `AuthSystem.render(containerId)` | :400 | 渲染认证 UI |

### 配置来源优先级

```
1. localStorage petbank_cloud_config（最高优先级，持久化）
2. window.__PETBANK_CLOUD_CONFIG__（运行时注入）
3. window.APP_SUPABASE_*（旧版兼容）
4. 无配置 → 纯本地模式
```

---

## 注意事项

- supabase-js.js 直接 vendored（2.1MB），无 package.json 管理
- `cloud-config.public.js` 提交了公开配置（不含密钥）
- `cloud-config.local.js` 在 .gitignore 中，存敏感密钥
- 同步使用节流（scheduleSync）而非实时推送
- 冲突策略是简单的 last-write-wins，无 CRDT/OT
- FamilySocialScope 控制社交功能的开关（minimal-v1 模式隐藏诊断/PK 控制）
