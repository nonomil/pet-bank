# 家庭账号社交 Supabase 部署日志（2026-07-05）

> 生成时间：`2026-07-04T20:39:59.703Z`
> 建议文件名：`deploy-log-2026-07-05.md`
> 用途：记录真实 Supabase 项目部署、冒烟、邀请码种子数据与回滚观察点。

---

## 1. 目标环境

| 字段 | 记录 |
|---|---|
| Supabase 项目名 | |
| project ref | |
| 站点地址 | |
| 执行人 | |
| 部署日期 | `2026-07-05` |
| 是否已区分测试 / 生产项目 | 是 / 否 |

---

## 2. 部署前检查

- [ ] 已准备 `SUPABASE_URL`
- [ ] 已准备 `SUPABASE_ANON_KEY`
- [ ] 已准备 `SUPABASE_SERVICE_ROLE_KEY`
- [ ] 本地 `supabase` CLI 可用
- [ ] 前端测试地址可访问
- [ ] 已阅读 `01-Supabase部署与环境准备.md`

---

## 3. Migration 推送记录

### 执行命令

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
```

### 结果

| Migration | 状态 | 备注 |
|---|---|---|
| `20260705_001_base_extensions.sql` | | |
| `20260705_002_households.sql` | | |
| `20260705_003_children_and_pet_state.sql` | | |
| `20260705_004_friend_graph.sql` | | |
| `20260705_005_house_visits.sql` | | |
| `20260705_006_async_pk.sql` | | |
| `20260705_007_child_live_state.sql` | | |
| `20260705_008_registration_invites.sql` | | |
| `20260705_009_child_social_profiles.sql` | | |
| `20260705_010_activity_feed.sql` | | |
| `20260705_011_child_access_controls.sql` | | |

---

## 4. Edge Functions secrets 与部署记录

### 建议命令

```bash
supabase secrets set SUPABASE_URL=<url> SUPABASE_ANON_KEY=<anon-key> SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
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

如果使用 `deploy:bundle` 生成的 PowerShell 脚本，默认会优先读取当前会话里的 `SUPABASE_SERVICE_ROLE_KEY`，没有时再回退到脚本里的占位值。

### 结果

| Function | 状态 | 备注 |
|---|---|---|
| `validate-registration-invite` | | |
| `claim-registration-invite` | | |
| `issue-registration-invite` | | |
| `list-registration-invites` | | |
| `revoke-registration-invite` | | |
| `issue-household-invite` | | |
| `revoke-household-invite` | | |
| `accept-household-invite` | | |
| `redeem-friend-code` | | |
| `issue-pk-match` | | |
| `submit-pk-attempt` | | |

### Secrets 结果

| Secret | 状态 | 备注 |
|---|---|---|
| `SUPABASE_URL` | | |
| `SUPABASE_ANON_KEY` | | |
| `SUPABASE_SERVICE_ROLE_KEY` | | |

---

## 5. 注册邀请码与种子数据

### 推荐命令

```bash
node scripts/family-social-ops.mjs registration:issue --count 3 --prefix PARENT-BETA --label pilot-1 --days 30 --metadata "{\"batch\":\"pilot-1\"}"
node scripts/family-social-ops.mjs registration:list --status pending
```

### 结果摘要

- 生成的邀请码：
- 当前待处理邀请码数：
- 是否已撤销错误邀请码：

---

## 6. 最小冒烟清单

| 检查项 | 结果 | 证据 | 备注 |
|---|---|---|---|
| 页面看到“家长账号与多孩子数据”卡片 | | | |
| 保存 Supabase 配置后切到“云端已配置” | | | |
| 用注册邀请码完成 1 个家长账号注册 | | | |
| 登录后能创建家庭 | | | |
| 同步当前孩子后拿到 `friend_code` | | | |
| `review` 或家庭摘要页出现云端状态卡 | | | |

---

## 7. 关键日志与证据

- [ ] `supabase db push` 成功日志
- [ ] 11 个 functions 部署日志
- [ ] 注册邀请码查询结果
- [ ] `household:inspect` 输出
- [ ] `child:inspect` 输出
- [ ] 第一位家长创建家庭截图
- [ ] 第一位孩子同步成功截图

---

## 8. 风险与回滚观察点

### 当前发现的风险

- 

### 建议的软回滚动作

1. 
2. 
3. 

---

## 9. 下一步

1. 继续生成并填写 `manual-run-2026-07-05.md`
2. 执行双家长 / 双设备 / 双家庭联调矩阵
3. 回填 go / no-go 结论
