# 家庭账号社交联调记录（{{DATE}}）

> 生成时间：`{{GENERATED_AT}}`
> 建议文件名：`{{MANUAL_RUN_FILE}}`
> 用途：记录双家长 / 双设备 / 双家庭联调的真实执行过程、证据与异常。

---

## 1. 本次联调基本信息

| 字段 | 记录 |
|---|---|
| Supabase 项目名 / project ref | |
| 前端访问地址 | |
| 执行人 | |
| 联调日期 | `{{DATE}}` |
| 设备数量 | |
| 浏览器 / 系统版本 | |
| 是否真实双设备 | 是 / 否 |
| 备注 | |

---

## 2. 账号、家庭、孩子基线

### 家长账号

| 角色 | 邮箱 / 手机 | 设备 | 状态 |
|---|---|---|---|
| 家长 A1 | | | |
| 家长 A2 | | | |
| 家长 B1 | | | |

### 家庭与孩子

| 实体 | ID / 编码 | 备注 |
|---|---|---|
| 家庭 A `household_id` | | |
| 家庭 B `household_id` | | |
| 孩子 A-1 `child_id` | | |
| 孩子 A-2 `child_id` | | |
| 孩子 B-1 `child_id` | | |
| 孩子 A-1 `friend_code` | | |
| 孩子 A-2 `friend_code` | | |
| 孩子 B-1 `friend_code` | | |

---

## 3. 部署前 / 联调前命令输出

### 推荐留存命令

```bash
## 先在设置页给当前设备设置“设备1-家长A1 / 设备2-家长A2”之类的诊断标签，再分别导出诊断 JSON
node scripts/family-social-ops.mjs pilot:doctor --date {{DATE}} --json
node scripts/family-social-ops.mjs pilot:overview --recent-days 7
node scripts/family-social-ops.mjs pilot:report --recent-days 7 --date {{DATE}} --force
node scripts/family-social-ops.mjs pilot:bundle --recent-days 7 --date {{DATE}} --force
node scripts/family-social-ops.mjs template:go-no-go --date {{DATE}} --force
{{HOUSEHOLD_INSPECT_COMMAND}}
{{CHILD_INSPECT_COMMAND}}
{{REGISTRATION_LIST_COMMAND}}
node scripts/family-social-ops.mjs diagnostics:compare --left-json ./device-1-diagnostics.json --right-json ./device-2-diagnostics.json
```

### 命令输出摘要

- household:inspect：
- child:inspect：
- registration:list：
- diagnostics:compare：

---

## 4. 联调矩阵执行记录

> 判定建议：`PASS / FAIL / BLOCKED / UNPROVEN`

| ID | 场景 | 结果 | 证据 | 备注 |
|---|---|---|---|---|
| `A01` | 注册邀请码校验 | | | |
| `A02` | 家庭 A 创建 | | | |
| `A03` | 多孩子同步 | | | |
| `A04` | 同家庭双家长协作 | | | |
| `A05` | 跨设备恢复 | | | |
| `B01` | 家庭 B 建立 | | | |
| `B02` | 跨家庭加好友 | | | |
| `B03` | 小屋可见性边界 | | | |
| `B04` | 串门权限边界 | | | |
| `B05` | PK 权限边界 | | | |
| `C01` | 轻互动动作 | | | |
| `C02` | 数学异步 PK | | | |
| `C03` | 汉字异步 PK | | | |
| `C04` | 家庭内对战 | | | |
| `C05` | 动态流完整性 | | | |

---

## 5. 关键证据清单

### 截图 / 录屏

- [ ] 注册邀请码状态变化
- [ ] 家庭邀请码签发与接受成功
- [ ] A-1 / A-2 / B-1 `friend_code`
- [ ] 设备 2 登录前后对比
- [ ] `home_visibility` / `visit_access` / `pk_access` 边界截图
- [ ] 数学 PK 发起 / 应战 / 结果
- [ ] 汉字 PK 发起 / 应战 / 结果
- [ ] 动态流时间顺序

### 文本证据

- [ ] 设备 1 / 设备 2 导出的联调诊断 JSON
- [ ] `household:inspect` 输出
- [ ] `child:inspect` 输出
- [ ] 关键错误提示原文
- [ ] 必要时附 SQL / REST 查询摘要

---

## 6. 失败点与排查记录

| 时间 | 场景 | 现象 | 初步原因 | 处理动作 | 当前状态 |
|---|---|---|---|---|---|
| | | | | | |

---

## 7. 本轮结论

### 通过项

- 

### 未通过项

- 

### 仍未证明项

- 

### 下一步建议

1. 
2. 
3. 

---

## 8. 参考入口

- 联调矩阵：`docs/家庭账号社交体系/联调上线/02-双账号双设备联调验收矩阵.md`
- 部署准备：`docs/家庭账号社交体系/联调上线/01-Supabase部署与环境准备.md`
- 运行帮助：`{{OPS_HELP_COMMAND}}`
