# 轻后台、数据库升级与 Hermes 自动部署设计稿

## 目标

为当前 `pet-bank` 项目补一套可持续演进的后台与部署约定，解决 3 个现实问题：

1. 需要一个轻量后台管理入口，方便查看账号、家庭、孩子与邀请码状态
2. 需要一套“升级网站但不覆盖账号数据”的数据库机制
3. 需要补齐机器可读配置，让云端 Hermes 能读仓库并自动部署

---

## 当前前提

仓库里已经有：

- 静态前端主站：`index.html`
- GitHub Pages 自动发布：`.github/workflows/deploy.yml`
- Supabase `migrations` 与 `functions`
- 家长账号、家庭、多孩子、好友串门的前台基础能力
- 运维脚本：`scripts/family-social-ops.mjs`

但当前还缺：

- 面向运营 / 管理者的后台入口
- `admin` 角色与审计模型
- `supabase/config.toml`
- 面向 Hermes 的机器可读部署描述文件

---

## 核心决策

### 1. 后台账号模型

采用：

`复用现有家长账号 -> 手动授予 admin -> 进入同站后台`

不单独维护第二套后台用户体系。

这样做的原因：

- 避免前台账号和后台账号两套数据打架
- 避免再次引入新的密码找回、权限同步和审计复杂度
- 更适合当前“轻后台”阶段

### 2. 后台入口模型

采用：

`同站隐藏入口 admin.html`

不单独拆子域名，不新增第二个仓库。

这样做的原因：

- 部署链路最短
- 与 GitHub Pages 现有结构兼容
- 后续 Hermes 只需要读同一仓库

### 3. 后台范围

一期只做轻后台，不做重运营平台。

后台只覆盖：

- 管理员登录态与角色校验
- 家长账号 / 家庭 / 孩子检索
- 注册邀请码管理
- 家庭邀请码与好友关系排查
- 同步 / 恢复状态查看
- 管理员操作审计

不做：

- 大规模运营报表
- 内容 CMS
- 广告 / 活动平台
- 批量修库工具

---

## 推荐架构

### 1. 页面结构

- 前台主站：`index.html`
- 后台入口：`admin.html`
- 后台脚本：`js/admin-*.js`

后台使用同一套 `Supabase Auth` 登录，但必须额外检查是否具备 `admin` 角色。

### 2. 权限结构

推荐新增：

- `public.user_roles`
- `public.admin_audit_logs`
- `public.system_settings`

其中：

- `user_roles` 负责账号与角色映射
- `admin_audit_logs` 记录谁在什么时候做了什么管理动作
- `system_settings` 存少量平台级开关或配置，不再把这类配置散落在前端里

### 3. 后台访问方式

后台不要把 `service_role_key` 暴露给浏览器。

推荐模式：

- 浏览器只持有普通登录态
- 需要管理读写时，调用新的 admin Edge Functions
- Edge Functions 在服务端用 `service_role` 执行管理查询或操作

这样做的好处是：

- 减少前端直接拥有大范围表访问能力
- 更容易做审计日志
- 更适合未来做“谁能看、谁能改”的细分权限

---

## 数据安全与升级机制

这是这一轮最重要的部分。

### 1. 前端升级和数据升级彻底分离

必须固定规则：

- 发布静态页面 ≠ 发布数据库
- HTML / CSS / JS 更新不会直接覆盖账号数据
- 账号、家庭、孩子、邀请码、互动记录都只在 Supabase 中演进

### 2. 数据库变更只能走 migration

所有结构变更必须通过：

- `supabase/migrations/*.sql`

不再把“在线手工改表”当正式发布手段。

### 3. 迁移策略采用“只增不删”

推荐采用 4 步法：

1. 先新增字段 / 表 / 兼容逻辑
2. 再上线兼容代码
3. 再迁移旧数据
4. 最后单独一轮再清理废弃结构

这能最大限度避免：

- 新前端读不到旧数据
- 旧前端写坏新结构
- 一次发布里同时删字段又切逻辑导致回滚困难

### 4. 关键 JSON 快照加版本号

像 `pet_state_snapshots.payload_json` 这类结构化 JSON，建议补：

- `payload_version`
- 或在 `payload_json.version` 里显式标注

这样后面 Hermes 或恢复逻辑才能知道该按哪套结构解释数据。

### 5. 生产环境必须先备份

正式环境建议至少满足：

- 每次上线前有数据库备份
- 生产项目开启 PITR
- 回滚文档里写清楚“页面回滚”和“数据库恢复”是两回事

需要特别提醒：

- Supabase 的数据库备份 / PITR 不覆盖 Storage 对象本身
- 所以如果后面把用户上传媒体接进来，还要单独补对象存储备份策略

---

## Hermes 自动部署约定

为了让云服务器上的 Hermes 能读仓库并自动部署，建议新增这几类入口：

### 1. Supabase 正式配置入口

- `supabase/config.toml`

作用：

- 记录 auth / redirect / function verify_jwt 等项目约定
- 支持未来接 `supabase config push`
- 与官方 GitHub / branching 流程兼容

### 2. 生产环境变量模板

- `.env.production.example`

作用：

- 统一 AI、人和 CI 看到的生产变量命名
- 区分前端可见变量与服务端专用变量

### 3. Hermes 机器可读部署描述

- `ops/hermes.yaml`

作用：

- 告诉 Hermes：这是一个什么类型的项目
- 前台入口在哪
- Supabase migrations / functions 在哪
- 需要哪些 secrets
- 应该先验证什么再部署

### 4. 部署文档

建议继续把人类可读说明留在 `docs/`，把机器可读入口放在 `ops/` 和 `supabase/`。

---

## 后台一期页面建议

### 页面 1：管理员登录与身份确认

展示：

- 当前登录邮箱
- 是否具备 `admin` 角色
- 当前连接的 Supabase 项目 / 环境标签

### 页面 2：账号 / 家庭 / 孩子搜索

支持按以下关键字查：

- 家长邮箱
- 家庭名
- 孩子名
- `household_id`
- `child_id`

### 页面 3：邀请码管理

支持：

- 查看注册邀请码
- 查看家庭邀请码
- 撤销待使用的邀请码

### 页面 4：同步与恢复排查

支持：

- 看某个孩子最近同步时间
- 看最近快照数量
- 看恢复状态摘要
- 看配置来源和环境状态

### 页面 5：操作审计

至少记录：

- 管理员账号
- 操作类型
- 目标对象
- 时间
- 成功 / 失败

---

## 一期不建议提前做的事

当前先不要把后台扩成：

- 全站 CMS
- 实时监控大盘
- 消息中心
- 大批量账号操作台
- 任意 SQL 执行器

因为现在最重要的不是“后台多强”，而是：

`让后台足够稳地支持家庭账号试运行。`

---

## 推荐下一步

下一步建议分两条线并行：

1. 先落文档与配置骨架
2. 再按实施计划补 admin schema、admin shell、admin edge functions

---

## 参考资料

以下官方文档支撑了这一版设计：

- [Supabase CLI config](https://supabase.com/docs/guides/local-development/cli/config)
- [Supabase managing config](https://supabase.com/docs/guides/local-development/managing-config)
- [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations)
- [Supabase branching / GitHub integration](https://supabase.com/docs/guides/deployment/branching/github-integration)
- [Supabase RBAC / custom claims](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac)
- [Supabase Auth hooks](https://supabase.com/docs/guides/auth/auth-hooks)
- [Supabase managing user data](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase backups](https://supabase.com/docs/guides/platform/backups)
- [GitHub Actions secrets](https://docs.github.com/actions/security-guides/using-secrets-in-github-actions)
