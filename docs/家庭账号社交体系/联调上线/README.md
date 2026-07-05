# 家庭账号社交体系联调与上线包

> 适用阶段：2026-07-05 家庭账号社交主干已经完成前端接线、Supabase schema / function 落点和合同测试，当前重点从“能写出来”转到“能在真实项目里稳定跑起来”。

---

## 1. 当前验收基线

- 已完成家长账号登录、注册邀请码校验、家庭创建、家庭邀请码、孩子同步、跨设备恢复、好友码、串门互动、数学异步 PK、汉字异步 PK、动态流、访问权限控制。
- 已恢复 `清晨阳光房` 和 `花园阳台` 两套小屋背景到 `js/home.js`。
- 已在设置页加入“云端联调诊断”面板，联调时可直接抄录当前 `user_id / household_id / child_id / local_profile_id / 可见性 / 权限 / 动态流` 摘要。
- 云端联调诊断面板现已补上“配置来源”字段，可区分当前 Supabase 配置来自 `cloud-config.local.js`、部署包片段、页面手动保存，还是宿主页面注入。
- 云端联调诊断面板现已支持“设置设备标签 + 导出诊断 JSON”，可先把当前设备标成“设备1-家长A1 / 设备2-家长A2”等，再导出联调快照，方便回填 `manual-run` 和做双设备对比。
- 已新增 `diagnostics:compare`，可直接比较两台设备导出的诊断 JSON，快速看出是否落在同一个家庭、是否少了云端孩子或本地档案，以及共享孩子的 `localProfileId / friendCode / 可见性 / 权限` 是否真的对齐。
- 设置页云端配置卡现已明确提示：页面手动保存会覆盖默认注入，清空后会回退到 `cloud-config.local.js` 或宿主页面配置。
- 当浏览器里仍保留旧的手动配置、正在覆盖 `cloud-config.local.js` 时，设置页也会直接给出显式提醒。
- 已在设置页补上“最近一次云端同步”状态卡，可直接看到排队 / 尝试 / 成功 / 失败 / 跳过的最近结果。
- 已在设置页家庭区加入手动恢复入口，可分别触发“只导入缺失云端孩子壳”和“用云端快照覆盖本地”两种恢复方式。
- 已在家长账号区加入“注册邀请码管理”，已登录家长可签发、回看并撤销自己发出的注册邀请码。
- 已在家庭区加入“家庭邀请码历史与撤销”，家庭创建者可查看最近邀请码并撤销待处理的邀请码。
- 已新增本地联调 / 运维脚本 `scripts/family-social-ops.mjs`，可直接签发 / 查看 / 撤销邀请码，并按 `household_id`、`child_id` 做快速排查。
- 已新增 `pilot:doctor` 联调前体检命令，可检查 `.env`、CLI、migrations、functions、`cloud-config.local.js`、模板和当天交接件是否齐备。
- 已新增 `registration:seed-sql`，可离线生成注册邀请码种子 SQL，便于在 Supabase SQL Editor 直接执行。
- 已新增 `deploy:bundle`，可生成带 `supabase secrets set` 的 Supabase 部署脚本、前端云端配置片段、注册邀请码种子 SQL 和部署日志模板。
- 静态前端现已支持自动加载同目录下的 `cloud-config.local.js`，可直接承接 `deploy:bundle` 产物。
- 已新增 `config:install-local`，可把 `cloud-config.local.js` 直接安装到当前站点根目录，减少本地真机联调手工步骤。
- `config:install-local` 现在要求必须具备真实 URL + anon key，避免误生成占位版本地云端配置。
- 已新增 `config:inspect`，可对照 `.env`、`cloud-config.local.js` 与“静态默认配置实际来源”，快速判断页面为什么连到了当前这套 Supabase。
- 已新增 `pk:inspect`，可把单场异步 PK 的题组、双方作答、胜负判定依据和相关动态流单独拎出来检查，方便验证“是不是同一组题”和“为什么这样结算”。
- 已新增 `pair:inspect`，可把两个孩子之间的好友关系、可见性、串门权限、PK 权限和最近互动放到同一张诊断表里，方便验证访问边界。
- 已新增 `logs:report`，可从导出的函数日志 JSON 生成错误汇总报告。
- 已把数学 / 汉字异步 PK 的挑战卡片与详情摘要补齐为“难度 / 关卡 / 题型”可读标签。
- 已新增 `pilot:overview` 全局概览命令，可用 CLI 汇总账号、家庭、孩子、邀请码、动态流和 PK 状态。
- `pilot:overview` 现已补上“异常雷达”，会直接提示空家庭、从未同步孩子、缺少快照孩子、快过期邀请码和挂太久的 PK。
- 已新增 `pilot:report`，可把试运行巡检结果导出成 Markdown 报告，方便转交和复盘。
- 已新增 `pilot:bundle`，可一次打出体检 JSON/Markdown、巡检 JSON/Markdown、当天 `manual-run`、`deploy-log` 和 `go-no-go` 交接包。
- 已补上 `go-no-go-template.md`，并接入 `template:all` / `pilot:bundle`，用于沉淀上线决策。
- 已补上 `manual-run-template.md` / `deploy-log-template.md`，并可通过 `family-social-ops.mjs template:*` 直接生成当天记录骨架。
- 当前最强的自动化证据是合同与回归测试：
  - `node --check js/pk-service.js`
  - `python -m pytest prj/test_async_pk_results_contract.py -q`
  - `python -m pytest (Get-ChildItem 'prj' -Filter 'test_*.py' | Sort-Object Name | ForEach-Object { $_.FullName }) -q`
  - 2026-07-05 最新本地基线：`84 passed`
  - 本轮已额外确认：异步 PK 结果摘要补丁通过语法检查、定向合同测试和整套家庭社交回归
- 当前仍缺少的关键实证：
  - 真实 Supabase 项目部署成功
  - 双家长 / 双设备 / 双家庭联调闭环
  - `home_visibility` / `visit_access` / `pk_access` 真实边界验证
  - `activity_feed` 在真实写入链路上的可见性与时序确认
- 当前 `pilot:doctor --date 2026-07-05 --json` 结果：`5 pass / 2 warn / 3 fail / ready=false`
  - 当前失败项集中在 `APP_SUPABASE_URL / SUPABASE_URL`、`APP_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 缺失
  - 当前告警项是 `APP_SUPABASE_SITE_URL` 未配置，以及本机尚未检测到 Supabase CLI

---

## 2. 文档清单

| 文件 | 定位 | 何时看 |
|---|---|---|
| [01-Supabase部署与环境准备](./01-Supabase部署与环境准备.md) | 把 schema、functions、注册邀请码和前端配置真正部署到测试项目 | 准备接真实云端 |
| [02-双账号双设备联调验收矩阵](./02-双账号双设备联调验收矩阵.md) | 把家庭协作、好友串门、访问边界、异步 PK 按案例逐条验收 | 准备真机联调 |
| [03-上线检查与回滚手册](./03-上线检查与回滚手册.md) | 进入小范围试运行前的 go/no-go、灰度和回滚策略 | 准备内测 / 发布 |
| [04-剩余风险与二期计划](./04-剩余风险与二期计划.md) | 记录当前还未被真实环境证明的部分，以及下一阶段优先级 | 规划后续迭代 |
| [manual-run-template](./manual-run-template.md) | 双家长 / 双设备 / 双家庭联调记录模板 | 准备开始真机联调 |
| [deploy-log-template](./deploy-log-template.md) | Supabase 部署日志模板 | 准备开始真实环境部署 |
| [go-no-go-template](./go-no-go-template.md) | 上线决策模板 | 准备沉淀 go / no-go 结论 |
| [family-account-social-live-validation-plan](../../plans/2026-07-05-family-account-social-live-validation-plan.md) | 面向执行者的细粒度 rollout / validation plan | 准备按 `/goal` 继续推进 |

---

## 3. 推荐阅读顺序

1. 先做 [部署与环境准备](./01-Supabase部署与环境准备.md)
2. 再跑 [双账号双设备联调验收矩阵](./02-双账号双设备联调验收矩阵.md)
3. 通过后执行 [上线检查与回滚手册](./03-上线检查与回滚手册.md)
4. 最后把结果回填到 [剩余风险与二期计划](./04-剩余风险与二期计划.md)

如果联调过程中遇到“邀请码状态不清楚”“某个家庭或孩子看起来没同步对”的情况，先运行 `scripts/family-social-ops.mjs` 再决定要不要改代码，能省掉很多盲查。

如果想先从全局看试运行状态，再决定要不要钻进具体家庭，可先运行：

```bash
node scripts/family-social-ops.mjs registration:seed-sql --date 2026-07-05 --force
node scripts/family-social-ops.mjs deploy:bundle --date 2026-07-05 --project-ref <project-ref> --force
node scripts/family-social-ops.mjs pilot:doctor --date 2026-07-05 --json
node scripts/family-social-ops.mjs config:inspect --env-file ./.env --cloud-config-file ./cloud-config.local.js
node scripts/family-social-ops.mjs pair:inspect --child-a <child-a-id> --child-b <child-b-id>
node scripts/family-social-ops.mjs pk:inspect --match <pk-match-id>
node scripts/family-social-ops.mjs diagnostics:compare --left-json ./device-1-diagnostics.json --right-json ./device-2-diagnostics.json
node scripts/family-social-ops.mjs logs:report --json-input ./supabase-function-logs.json --date 2026-07-05 --force
node scripts/family-social-ops.mjs pilot:overview --recent-days 7
node scripts/family-social-ops.mjs pilot:report --recent-days 7 --date 2026-07-05 --force
node scripts/family-social-ops.mjs pilot:bundle --recent-days 7 --date 2026-07-05 --force
node scripts/family-social-ops.mjs template:go-no-go --date 2026-07-05 --force
```

推荐在开始联调前先生成两份当天文档：

```bash
node scripts/family-social-ops.mjs template:all --date 2026-07-05
node scripts/family-social-ops.mjs template:manual-run --date 2026-07-05
```

它会默认产出：

- `docs/家庭账号社交体系/联调上线/manual-run-2026-07-05.md`
- `docs/家庭账号社交体系/联调上线/deploy-log-2026-07-05.md`
- `docs/家庭账号社交体系/联调上线/go-no-go-2026-07-05.md`

---

## 4. 与前面专题文档的关系

- [01-方案总览](../01-方案总览.md) 负责回答“为什么这么做、边界是什么”
- [02-数据模型与权限](../02-数据模型与权限.md) 负责回答“数据怎么存、谁能看什么”
- [03-分阶段落地计划](../03-分阶段落地计划.md) 负责回答“这件事分几波推进”
- 本目录负责回答“现在怎么把它真正跑起来，并证明它可用”
