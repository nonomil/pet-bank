# Supabase 部署与环境准备

> 目标：把当前仓库里的家庭账号社交能力部署到一个真实 Supabase 项目，并让前端能用最小配置接入。

---

## 1. 部署前检查

需要先准备：

- 1 个 Supabase 项目
- 项目 `URL`
- 项目 `anon key`
- 项目 `service role key`
- 可运行 `supabase` CLI 的本地环境
- 1 个用于联调的前端访问地址
  - 本地调试可用 `http://127.0.0.1:5500`
  - 静态托管时换成实际站点地址

当前前端支持 3 种注入方式：

1. 在页面运行后，通过“设置 -> 家长账号与多孩子数据”保存云端配置
2. 在 `index.html` 同目录放一个 `cloud-config.local.js`，页面会自动加载它
3. 在运行时注入 `window.__PETBANK_CLOUD_CONFIG__`
4. 在宿主页面注入 `window.APP_SUPABASE_URL` / `window.APP_SUPABASE_ANON_KEY` / `window.APP_SUPABASE_SITE_URL`

`.env.example` 只是示例，不会被浏览器直接读取。

但联调 / 运维脚本会读取项目根目录 `.env`。本仓库新增了：

- `scripts/family-social-ops.mjs`

它主要用于：

- 批量签发 / 查看 / 撤销注册邀请码
- 离线生成注册邀请码种子 SQL
- 生成包含 `supabase secrets set` 的 Supabase 部署脚本、前端云端配置片段、注册邀请码种子 SQL 和部署日志模板
- 额外生成可直接放到站点根目录的 `cloud-config.local.js`
- 支持直接运行 `config:install-local`，一键把 `cloud-config.local.js` 安装到当前站点根目录
- 从导出的函数日志 JSON 生成错误汇总报告
- 查看 / 撤销家庭邀请码
- 按 `household_id` 查看家庭成员、孩子、最近邀请码、最近活动流
- 按 `child_id` 查看孩子权限、好友关系、最近宠物快照、最近活动流
- 做联调前体检（`.env` / CLI / migrations / functions / `cloud-config.local.js` / 模板 / 当天交接件）
- 汇总试运行全局状态（账号 / 家庭 / 孩子 / 邀请码 / 动态流 / PK）
- 生成当天的部署日志模板与联调记录模板

如果准备开始真实环境部署，建议先生成当天日志骨架：

```bash
node scripts/family-social-ops.mjs registration:seed-sql --date 2026-07-05 --force
node scripts/family-social-ops.mjs deploy:bundle --date 2026-07-05 --project-ref <project-ref> --force
node scripts/family-social-ops.mjs pilot:doctor --date 2026-07-05 --json
node scripts/family-social-ops.mjs logs:report --json-input ./supabase-function-logs.json --date 2026-07-05 --force
node scripts/family-social-ops.mjs template:deploy-log --date 2026-07-05
```

如果已经完成基础部署，建议再跑一遍全局概览，先确认试运行状态：

```bash
node scripts/family-social-ops.mjs pilot:doctor --date 2026-07-05 --json
node scripts/family-social-ops.mjs pilot:overview --recent-days 7
```

这条命令现在除了汇总数字，还会额外提示：

- 空家庭
- 未入家庭账号
- 从未同步或长期未同步的孩子
- 缺少宠物快照的孩子
- 快过期的邀请码
- 挂起太久的 PK

如果要把这轮试运行状态直接导出成文档，可继续运行：

```bash
node scripts/family-social-ops.mjs pilot:report --recent-days 7 --date 2026-07-05 --force
node scripts/family-social-ops.mjs pilot:bundle --recent-days 7 --date 2026-07-05 --force
node scripts/family-social-ops.mjs template:go-no-go --date 2026-07-05 --force
```

---

## 2. 本次要部署的数据库迁移

按仓库现状，需要部署以下 migration：

1. `supabase/migrations/20260705_001_base_extensions.sql`
2. `supabase/migrations/20260705_002_households.sql`
3. `supabase/migrations/20260705_003_children_and_pet_state.sql`
4. `supabase/migrations/20260705_004_friend_graph.sql`
5. `supabase/migrations/20260705_005_house_visits.sql`
6. `supabase/migrations/20260705_006_async_pk.sql`
7. `supabase/migrations/20260705_007_child_live_state.sql`
8. `supabase/migrations/20260705_008_registration_invites.sql`
9. `supabase/migrations/20260705_009_child_social_profiles.sql`
10. `supabase/migrations/20260705_010_activity_feed.sql`
11. `supabase/migrations/20260705_011_child_access_controls.sql`

重点能力对应关系：

- `002`：`accounts` / `households` / `household_members` / `household_invites`
- `003`：`child_profiles` / `pet_state_snapshots`
- `004`：好友码与 `child_friendships`
- `005`：串门与互动记录 `house_visits`
- `006`：`pk_question_sets` / `pk_matches` / `pk_match_attempts`
- `007` / `009` / `011`：社交资料读取、家庭可见性、串门权限、PK 权限
- `010`：`activity_feed` 与触发器

---

## 3. 本次要部署的 Edge Functions

需要部署 11 个函数：

1. `validate-registration-invite`
2. `claim-registration-invite`
3. `issue-registration-invite`
4. `list-registration-invites`
5. `revoke-registration-invite`
6. `issue-household-invite`
7. `revoke-household-invite`
8. `accept-household-invite`
9. `redeem-friend-code`
10. `issue-pk-match`
11. `submit-pk-attempt`

从代码看，函数运行依赖以下环境变量：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

其中：

- `validate-registration-invite` 读取邀请码，只需要管理员能力
- 其他 10 个函数同时依赖管理员客户端和带 `Authorization` 的用户客户端

因此联调前要先确认函数运行环境里这些值都能取到。

---

## 4. 推荐部署步骤

### 4.1 绑定 Supabase 项目

```bash
supabase login
supabase link --project-ref <your-project-ref>
```

### 4.2 推送数据库迁移

```bash
supabase db push
```

### 4.3 写入函数 secrets 并部署 Edge Functions

在部署 11 个 Edge Functions 之前，先确认函数运行环境里至少有：

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

如果使用 `node scripts/family-social-ops.mjs deploy:bundle ...` 生成的 PowerShell 脚本，它现在会先执行：

```bash
supabase secrets set SUPABASE_URL=<url> SUPABASE_ANON_KEY=<anon-key> SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

其中 `SUPABASE_SERVICE_ROLE_KEY` 默认优先读取当前 PowerShell 会话里的 `$env:SUPABASE_SERVICE_ROLE_KEY`；如果没有环境变量，会保留占位值，需手动替换后再执行。

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

### 4.4 为前端准备配置

至少要把以下 3 个值放到测试环境中：

```js
window.__PETBANK_CLOUD_CONFIG__ = {
  supabaseUrl: 'https://<project>.supabase.co',
  supabaseAnonKey: '<anon-key>',
  siteUrl: 'http://127.0.0.1:5500'
};
```

如果走页面内设置保存，则录入同样的值即可。
如果希望静态站点打开就自动连到测试 Supabase，最省事的方式是把 `deploy:bundle` 生成的 `cloud-config.local.js` 放到和 `index.html` 同一目录。

如果不想连部署包一起生成、只想把本地页面快速接到一套测试 Supabase，建议直接运行：

```bash
node scripts/family-social-ops.mjs config:install-local --force
```

它会默认在项目根目录写入：

- `./cloud-config.local.js`

前提是当前 `.env` 或命令行里已经提供了真实的 Supabase `URL + anon key`。如果还没配值，命令会直接拒绝写入占位文件，避免把假的本地云端配置误当成已接好。

如果需要覆盖成另一套测试环境，也可以临时带上 `--url` / `--anon-key` / `--site-url`。

如果页面表现看起来还是连着旧环境，或不确定究竟是 `.env`、`cloud-config.local.js` 还是浏览器里手动保存的配置在生效，建议立刻运行：

```bash
node scripts/family-social-ops.mjs config:inspect --env-file ./.env --cloud-config-file ./cloud-config.local.js
```

它会把 `.env`、本地 `cloud-config.local.js`、以及“静态站点默认会吃到哪一套配置”并排列出来，并额外提醒：浏览器里已保存的配置会优先覆盖默认注入。

例如直接在项目根目录生成：

```bash
node scripts/family-social-ops.mjs deploy:bundle --date 2026-07-05 --project-ref <project-ref> --output-dir . --force
```

无论是 `config:install-local` 还是 `deploy:bundle --output-dir .`，页面都会自动加载：

- `./cloud-config.local.js`

而且该文件已经被 `.gitignore` 忽略，适合本地 / 测试环境临时挂载。

---

## 5. 注册邀请码种子数据

当前注册不是完全开放的，需要先写入 `registration_invites`。

建议先准备 3 类码：

- 同家庭双家长联调用码
- 跨家庭好友联调用码
- 备用回归码

### 5.1 推荐优先用本地 ops 脚本

先确保 `.env` 至少具备一组可复用的 Supabase 基础值：

```env
APP_SUPABASE_URL=https://<project>.supabase.co
APP_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

推荐做法是让 `APP_SUPABASE_URL` 与 `SUPABASE_URL` 保持一致、`APP_SUPABASE_ANON_KEY` 与 `SUPABASE_ANON_KEY` 保持一致。
前者给前端设置 / 本地保存使用，后者对应 Edge Functions / `supabase secrets set`。

然后可以直接运行：

```bash
node scripts/family-social-ops.mjs registration:issue --count 3 --prefix PARENT-BETA --label pilot-1 --days 30 --metadata "{\"batch\":\"pilot-1\"}"
```

查看当前邀请码：

```bash
node scripts/family-social-ops.mjs registration:list --status pending
```

如果某个邀请码发错了，可直接撤销：

```bash
node scripts/family-social-ops.mjs registration:revoke --code PARENT-BETA-001
```

如果当前还没拿到 service role，或者就是想先准备一份可交给别人执行的 SQL，也可以离线生成：

```bash
node scripts/family-social-ops.mjs registration:seed-sql --date 2026-07-05 --force
```

### 5.2 必要时再直接写 SQL

示例 SQL：

```sql
insert into public.registration_invites (
  invite_code,
  status,
  label,
  expires_at,
  metadata_json
)
values
  ('PARENT-BETA-001', 'pending', '双家长联调-A', now() + interval '30 days', '{"batch":"pilot-1"}'::jsonb),
  ('PARENT-BETA-002', 'pending', '双家长联调-B', now() + interval '30 days', '{"batch":"pilot-1"}'::jsonb),
  ('PARENT-BETA-003', 'pending', '跨家庭好友联调', now() + interval '30 days', '{"batch":"pilot-1"}'::jsonb);
```

建议再准备一条查询语句，便于确认邀请码状态：

```sql
select invite_code, status, label, expires_at, claimed_at
from public.registration_invites
order by created_at desc;
```

### 5.3 家庭 / 孩子排查命令

当进入双设备联调后，推荐直接留存以下两条排查命令：

```bash
node scripts/family-social-ops.mjs household:inspect --household <household-id>
node scripts/family-social-ops.mjs child:inspect --child <child-id>
```

前者更适合排查“为什么另一位家长没看到孩子”；后者更适合排查“为什么这个孩子不能串门 / 不能 PK / 没有好友码 / 没同步到最新快照”。

---

## 6. 部署后的最小冒烟清单

部署后先不要直接跑完整联调矩阵，先做 6 个最小检查：

1. 页面能看到“家长账号与多孩子数据”卡片
2. 保存 Supabase 配置后，卡片状态从“本地模式”切到“云端已配置”
3. 用注册邀请码完成 1 个家长账号注册
4. 登录后能创建家庭
5. 同步当前孩子后能拿到 `friend_code`
6. `review` 或家庭摘要页能看到孩子的云端状态卡

只要这 6 条有一条不通，就先不要进入双设备联调。

---

## 7. 建议留存的部署证据

建议把以下证据保存到联调记录里：

- `supabase db push` 成功截图或日志
- 11 个 functions 部署成功截图或日志
- `registration_invites` 查询结果
- `scripts/family-social-ops.mjs household:inspect` / `child:inspect` 的输出结果
- 前端保存配置后的状态截图
- 第一个家庭 / 第一个孩子同步成功截图

这些证据后面会用于上线 go/no-go 判断。
