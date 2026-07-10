# 账号系统 / Supabase / Hermes 部署手册

> 适用仓库：`pet-bank`
>
> 目标：让部署后的站点具备“多家长账号、多孩子资料隔离、云端恢复、家庭协作”的最小可用能力，并能由你自己在服务器上通过 Hermes 拉取仓库完成部署。

## 1. 当前实现边界

这套系统不是从零开始。仓库里已经具备以下基础设施：

- 前端家长账号 UI：`js/auth.js`
- 云端配置注入：`js/cloud-client.js`
- 家庭与孩子同步：`js/household.js`、`js/cloud-sync.js`、`js/cloud-restore.js`
- 本地多孩子切换：`js/profiles.js`、`js/profile-sync.js`
- Supabase 数据表与 RLS：`supabase/migrations/*.sql`
- 注册邀请码、家庭邀请码、好友码、异步 PK 等 Edge Functions：`supabase/functions/*`
- Hermes 部署约定：`ops/hermes.yaml`

当前账号模型是：

```text
Supabase auth.users
  -> public.accounts
  -> public.households
  -> public.household_members
  -> public.child_profiles
  -> public.pet_state_snapshots
```

这意味着：

- 每个家长账号有自己的 Supabase 用户身份
- 每个家庭可有多位家长
- 每个家庭下可有多个孩子
- 每个孩子在云端有独立 `child_profiles.id`
- 本地多孩子和云端孩子通过 `local_profile_id` 对接

## 2. 这次补上的关键点

之前的真实缺口不是“完全没有账号体系”，而是两件事：

1. 全新环境首账号冷启动
2. 缺少一份能照着装好的部署手册

本次已经补上首账号冷启动：

- `validate-registration-invite` 现在支持“首个家长账号免邀请码初始化”
- 之后恢复“必须邀请码注册”的正常流程

## 3. 家长注册 / 家庭协作流程

### 第一位家长

1. 打开站点
2. 进入 `设置 -> 账号与孩子`
3. 注册家长账号
4. **首个家长可不填注册邀请码**
5. 登录后创建家庭
6. 同步当前孩子到云端

### 第二位及之后的家长

1. 第一位家长先签发“注册邀请码”
2. 新家长用注册邀请码注册账号
3. 登录后再使用“家庭邀请码”加入同一个家庭
4. 如本地没有孩子档案，再执行“从云端导入孩子档案”

两个邀请码分工不同：

- `注册邀请码`：允许创建新家长账号
- `家庭邀请码`：让已注册家长加入某个家庭

## 4. Supabase 安装步骤

### 4.1 创建 Supabase 项目

在 Supabase 控制台创建项目，记下：

- `Project URL`
- `anon key`
- `service_role key`
- `project ref`
- `database password`

### 4.2 安装 Supabase CLI

```bash
supabase login
```

### 4.3 配置环境变量

参考：

- `.env.example`
- `.env.production.example`

生产环境至少需要：

```bash
APP_SUPABASE_URL=https://your-project.supabase.co
APP_SUPABASE_ANON_KEY=your-anon-key
APP_SUPABASE_SITE_URL=https://your-domain.example.com

SUPABASE_PROJECT_ID=your-project-ref
SUPABASE_ACCESS_TOKEN=your-supabase-access-token
SUPABASE_DB_PASSWORD=your-db-password
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

PETBANK_ENABLE_INITIAL_OWNER_SIGNUP=true
```

说明：

- `APP_SUPABASE_*` 给前端页面注入
- `SUPABASE_*` 给迁移和 Edge Functions 使用
- `PETBANK_ENABLE_INITIAL_OWNER_SIGNUP=true` 允许首个家长免邀请码初始化

### 4.4 关联远程项目

```bash
supabase link --project-ref <your-project-ref>
```

### 4.5 推送数据库结构

```bash
supabase db push
supabase config push
```

### 4.6 部署 Edge Functions

```bash
supabase functions deploy validate-registration-invite
supabase functions deploy claim-registration-invite
supabase functions deploy issue-registration-invite
supabase functions deploy list-registration-invites
supabase functions deploy revoke-registration-invite
supabase functions deploy issue-household-invite
supabase functions deploy revoke-household-invite
supabase functions deploy accept-household-invite
supabase functions deploy redeem-friend-code
supabase functions deploy issue-pk-match
supabase functions deploy submit-pk-attempt
```

### 4.7 Functions 需要的环境变量

至少保证这些变量进入 Supabase Functions 环境：

```bash
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
PETBANK_ENABLE_INITIAL_OWNER_SIGNUP
```

## 5. 前端如何注入第三方数据库配置

推荐两种生产方式：

### 方式 A：`cloud-config.local.js`

```js
window.__PETBANK_CLOUD_CONFIG__ = {
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseAnonKey: 'your-anon-key',
  siteUrl: 'https://your-domain.example.com'
};
```

### 方式 B：宿主页面运行时注入

```js
window.__PETBANK_CLOUD_CONFIG__ = { ... };
window.__PETBANK_CLOUD_CONFIG_SOURCE__ = 'runtime-object';
window.__PETBANK_CLOUD_CONFIG_SOURCE_LABEL__ = '服务器运行时注入';
```

浏览器内手工保存配置只适合调试，不建议作为正式上线方案。

## 6. Hermes 服务器部署建议

仓库里已有契约文件：

- `ops/hermes.yaml`

推荐顺序：

1. Hermes 拉取仓库
2. 安装 Supabase CLI
3. 注入生产环境变量
4. 执行 `supabase db push`
5. 执行 `supabase config push`
6. 部署所有 Edge Functions
7. 发布静态站点
8. 注入前端 `APP_SUPABASE_*`

### 6.1 不要用“整目录全量覆盖”更新

后续网站更新时，**不建议**直接把服务器站点目录整包删除后再重新覆盖。原因有三个：

1. 运行时配置文件可能在服务器本地
2. 数据库迁移和前端发布不是一个原子动作
3. 如果新版本前端已上线、数据库还没迁移完，会出现短暂不兼容

更稳的做法是：

- 仓库代码拉到新的 release 目录
- 共享目录单独保存运行时配置
- 验证通过后再切换 `current` 指向

推荐目录结构：

```text
/srv/pet-bank/
  releases/
    2026-07-11-01/
    2026-07-15-01/
  shared/
    cloud-config.local.js
    logs/
  current -> /srv/pet-bank/releases/2026-07-15-01
```

这样做的好处：

- 代码更新不会覆盖服务器本地配置
- 回滚时只要把 `current` 切回旧版本
- Hermes / Git 拉取失败不会直接破坏线上目录

### 6.2 推荐更新顺序

以后每次更新建议按这个顺序：

1. Hermes 拉取仓库到新的 release 目录
2. 挂载或复制共享配置文件到该 release
3. 如有数据库变更，先执行 `supabase db push`
4. 如有函数变更，再部署 Edge Functions
5. 本地或预发布验证页面和账号流程
6. 切换 `current` 到新 release
7. 保留上一个 release，便于快速回滚

### 6.3 哪些内容应该放 shared，而不是跟仓库一起覆盖

建议放到服务器共享目录：

- `cloud-config.local.js`
- 任何真实密钥文件
- 运行日志
- 未来如果有上传资源或后台导出文件，也应放 shared

不要把这些内容放回 git 仓库再靠每次部署覆盖。

### 6.4 数据库更新策略

数据库也不要做“全量重建式更新”，而要坚持：

- 只做增量 migration
- 生产库变更前先备份
- 前端兼容旧字段一小段时间
- 删除字段、重命名字段、破坏性变更单独发版

这和仓库里已有约定一致：

- `ops/hermes.yaml` 里已经写了 `migrationStrategy: additive-first`
- `destructiveMigrationsRequireSeparateRelease: true`

### 6.5 一个更稳的发布思路

可以把发布拆成两个相对独立的通道：

- **前端静态站点发布**
- **Supabase 数据库 / Functions 发布**

也就是说，后续更新不是“整个系统一把梭覆盖”，而是：

1. 先部署数据库和函数
2. 再切前端到新版本

这样更适合你现在这个“静态站点 + 第三方数据库”的结构。

## 7. 首次上线后的操作顺序

1. 打开首页
2. 进入 `设置 -> 账号与孩子`
3. 确认 Supabase 配置已生效
4. 注册首个家长账号
5. 创建家庭
6. 同步当前孩子到云端
7. 签发一个注册邀请码
8. 用第二个家长测试注册
9. 再签发家庭邀请码并测试加入家庭
10. 测试“从云端导入孩子档案”

## 8. 每个账号的数据隔离规则

### 家长账号隔离

- `auth.users.id` 是家长唯一身份
- `public.accounts.id = auth.users.id`
- RLS 只允许账号直接读取自己的账户信息

### 家庭隔离

- `household_members` 决定谁属于哪个家庭
- 非家庭成员不能访问该家庭孩子数据

### 孩子隔离

- 每个孩子有独立 `child_profiles.id`
- 本地通过 `local_profile_id` 对应
- 快照写入 `pet_state_snapshots`

## 9. 生产建议

新环境初始化完成后，建议把：

```bash
PETBANK_ENABLE_INITIAL_OWNER_SIGNUP=false
```

这样后续新增家长必须走注册邀请码。

## 10. 常见故障

### 注册时报 `inviteCode is required`

说明：

- 当前不是首个家长
- 或已关闭 `PETBANK_ENABLE_INITIAL_OWNER_SIGNUP`

处理：

- 让现有家长签发注册邀请码
- 或仅在初始化阶段临时重新开启 `PETBANK_ENABLE_INITIAL_OWNER_SIGNUP=true`

### 登录后看不到家庭

检查：

- 是否已创建家庭
- 是否已接受家庭邀请码
- 是否已把孩子同步到云端

### 登录后没有孩子数据

处理顺序：

1. 检查 `child_profiles` 是否已有孩子
2. 检查 `pet_state_snapshots` 是否有最新快照
3. 在前端执行“从云端导入孩子档案”

## 11. 推荐验收清单

上线前至少验证：

1. 首个家长可免邀请码注册
2. 首个家长能创建家庭
3. 首个家长能同步孩子到云端
4. 首个家长能签发注册邀请码
5. 第二位家长能用注册邀请码成功注册
6. 第二位家长能用家庭邀请码加入家庭
7. 第二位家长能导入孩子档案
8. 退出再登录后，孩子档案仍能恢复
