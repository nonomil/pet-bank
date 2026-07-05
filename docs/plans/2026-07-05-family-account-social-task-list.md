# 家庭账号社交体系任务清单

## 当前执行口径（2026-07-05 起）

- `/goal` 先按 `minimal-v1` 推进，不再默认把 PK、复杂联调和运维脚本当作一期主流程
- 一期只聚焦：家长账号、家庭、多孩子同步、好友码、串门与轻互动、小屋背景可用
- 一期默认不主推：数学 / 汉字异步 PK、诊断 JSON、双设备排障工具
- 收口说明见：`docs/家庭账号社交体系/一期最小版/`

## 当前实现进度（2026-07-05）

- 已完成云端 bootstrap、家长登录、注册邀请码真实校验链路
- 已支持在设置页保存 / 清空 Supabase 云端配置
- 已完成家庭创建、家庭邀请码签发 / 接收、家庭与多孩子同步基础层
- 已支持逐个孩子同步，以及一键同步全部本地孩子到同一个云端家庭
- 已完成孩子好友码、好友关系、串门记录与好友小屋摘要
- 已完成数学 / 汉字同题异步 PK 的发起、应战、提交与结果读取
- 已把异步 PK 卡片与详情摘要补齐为“难度 / 关卡 / 题型”可读标签
- 已完成 `review` 页家庭复盘卡，以及 `leaderboard` 页云端好友 / PK 战绩摘要
- 已支持同一家庭下多个已同步孩子直接互相串门、互动，并作为异步 PK 对手
- 已补齐受控社交资料读取层，避免好友 / PK 对手资料直接依赖 `child_profiles` 原表权限
- 已支持登录后导入云端孩子壳，并在本地缺少档案时恢复最近云端快照
- 已新增云端 `activity_feed` 动态流，并把好友、串门、PK 事件接入家庭复盘
- 已支持为每个孩子独立配置“好友串门权限 / 好友 PK 权限”，并在前后端同时生效
- 已把“🚶 一起遛弯”接入宠物社交动作、来访记录与动态流
- 下一步重点从“前端能力补齐”转到“多设备联调、双家长协作验收、上线配置”
- 已补充 `docs/家庭账号社交体系/联调上线/` 文档包，开始把 `/goal` 推进到真实环境验证阶段
- 已在设置页新增“云端联调诊断”面板，可直接查看账号 / 家庭 / 云端孩子映射 / 权限 / 恢复状态 / 动态流摘要
- 已在设置页补上“导出诊断 JSON”，可把当前设备的联调快照直接保存成文件，方便双设备恢复与权限边界取证
- 已新增 `diagnostics:compare`，可比较两台设备导出的联调快照，快速识别缺失的云端孩子 / 本地档案，以及共享孩子字段不一致导致的恢复差异
- 已在设置页补上“最近一次云端同步”状态卡，可查看排队 / 尝试 / 成功 / 失败 / 跳过的最近结果
- 已在设置页家庭区补上手动“云端档案恢复”入口，支持“从云端导入孩子档案”与“用云端覆盖本地数据”
- 已在家长账号设置区补上“注册邀请码管理”，可由已登录家长签发、查看并撤销自己发出的注册邀请码
- 已在家庭区补上“家庭邀请码历史与撤销”，可查看最近邀请码并撤销待处理的邀请码
- 已新增 `scripts/family-social-ops.mjs`，用于真实 Supabase 联调时批量签发 / 查看 / 撤销邀请码，以及按 `household_id` / `child_id` 做快速排查
- 已新增 `pilot:doctor`，可先检查 `.env` / CLI / migrations / functions / `cloud-config.local.js` / 模板 / 当天交接件
- 已新增 `registration:seed-sql`，可离线生成注册邀请码种子 SQL
- 已新增 `deploy:bundle`，可生成带 `supabase secrets set` 的 Supabase 部署脚本和前端配置片段
- 已新增 `config:install-local`，可一键写入站点根目录 `cloud-config.local.js`
- 已新增 `config:inspect`，可检查 `.env`、`cloud-config.local.js` 和静态默认配置的实际来源，减少云端接线排查成本
- 已新增 `pk:inspect`，可按单场 PK 检查冻结题组、双方作答、动态流与胜负判定依据，便于验证数学 / 汉字异步 PK 公平性
- 已新增 `pair:inspect`，可按两个孩子的组合检查好友关系、小屋可见性、串门权限与 PK 权限，便于验证跨家庭访问边界
- 已新增 `logs:report`，可从导出的函数日志 JSON 生成错误汇总报告
- 已新增 `pilot:overview`，可从 CLI 汇总账号 / 家庭 / 孩子 / 邀请码 / 动态流 / PK 状态
- 已新增 `pilot:report`，可把试运行巡检结果导出成 Markdown 报告
- 已新增 `pilot:bundle`，可一次生成体检 JSON / 体检报告 / 巡检 JSON / 巡检报告 / 联调记录模板 / 部署日志模板 / 决策模板
- 已补上 `go-no-go-template.md`，并接入 `template:all` / `pilot:bundle`
- 已补上 `manual-run-template.md` / `deploy-log-template.md`，并可通过 `family-social-ops.mjs template:*` 生成当天记录骨架
- 已重新验证家庭社交联调工具链，当前 PowerShell 口径回归已更新为 `87 passed`
- 当前冻结的本地验证命令为 `node --check js/pk-service.js`、`python -m pytest prj/test_async_pk_results_contract.py -q` 与 `python -m pytest (Get-ChildItem 'prj' -Filter 'test_*.py' | Sort-Object Name | ForEach-Object { $_.FullName }) -q`
- 当前剩余硬门槛已收敛到真实 Supabase 部署、双家长 / 双设备联调证据，以及访问权限边界真机验证
- 当前 `pilot:doctor --date 2026-07-05 --json` 结果为 `ready=false`，主要阻塞项是 Supabase URL / anon key / service role key 缺失，以及本机未检测到 Supabase CLI
- 已补上真实部署链路里的函数 secrets 引导：生成的 PowerShell 部署脚本会先写入 `SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY`，再部署 11 个 Edge Functions
- 已统一 `.env` 模板与体检口径，明确 `APP_SUPABASE_*` 用于前端配置，`SUPABASE_*` 用于函数部署与 secrets，减少真机联调时变量名混淆
- 静态前端现已自动尝试加载同目录下的 `cloud-config.local.js`，`deploy:bundle` 也会直接产出这个文件名，便于测试环境零手工挂载
- 本地页面如果只需要快速挂到一套测试 Supabase，现可直接运行 `node scripts/family-social-ops.mjs config:install-local --force`
- `config:install-local` 现已拒绝写入占位配置，必须拿到真实 URL + anon key 后才会生成本地云端配置文件
- `pilot:doctor` 现已在 URL 与 anon key 就绪时额外检查根目录 `cloud-config.local.js` 是否存在、是否仍是占位值、以及是否与当前配置一致
- 设置页云端诊断现已展示 `configSource / 配置来源`，便于区分当前连接到底来自本地文件、部署包片段、页面手动保存，还是宿主页面注入
- 设置页云端配置卡现已提示优先级：页面手动保存会覆盖默认注入，清空后再回退到 `cloud-config.local.js` 或宿主页面配置
- 如果当前浏览器里保存的旧配置正在覆盖 `cloud-config.local.js`，设置页现会直接提示“正在覆盖默认注入的云端配置”

## P0：冻结方向

- 确认账号主体是“家长账号”，数据归属主体是“家庭”
- 确认社交主体是“孩子/宠物”，不是成人账号
- 确认邀请码拆成注册邀请码、家庭邀请码、宠物好友码三类
- 确认第一版先做异步，不做实时在线
- 确认轻后端选型与本地缓存边界

## P1：账号与家庭

- 新增云端 client bootstrap
- 接入 auth shell
- 新增家庭表与家庭成员表
- 打通“注册 / 登录 / 创建家庭 / 退出”
- 打通“邀请另一位家长加入家庭”
- 为前端增加会话状态与未登录保护

## P2：多孩子与本地导入

- 新增孩子表与宠物状态表
- 读取 `petbank_profiles_meta`
- 读取 `petbank_profile_data_{id}`
- 实现“首次导入本机孩子档案到云端家庭”
- 让 `profiles.js` 从“终态存储”降级为“本地桥接层”
- 验证单孩子老用户升级路径

## P3：好友关系与串门

- 新增孩子好友码
- 新增好友关系表
- 打通“输入好友码 -> 建立关系”
- 新增开放小屋可见范围
- 新增来访足迹记录
- 新增至少 1 个轻互动动作

## P4：数学异步 PK

- 新增题组冻结表
- 新增 PK match 表
- 新增 attempt 表
- 从 `math-pk.js` 抽出共享题组逻辑
- 打通“发起挑战 / 接受挑战 / 提交成绩 / 结算胜负”
- 把战绩结果写回展示层

## P5：汉字异步 PK

- 复用 async PK 基础结构
- 为 `hanzi-game.js` 接入题组冻结
- 支持识字 / 拼音 / HSK 同题挑战
- 写入汉字 PK 战绩
- 接到动态流与结果页

## P6：验证与上线准备

- 合同测试覆盖 schema 和关键挂载点
- 验证家庭内双家长协作
- 验证跨设备恢复
- 验证串门访问边界
- 验证异步 PK 公平性
- 回填专题文档、设计稿、计划索引
- 部署 Supabase migrations 和 11 个 Edge Functions
- 准备注册邀请码种子数据
- 准备灰度 / 回滚手册
- 参考文档入口：`docs/家庭账号社交体系/联调上线/`

补充说明：
- 注册邀请码种子数据现在可优先通过 `scripts/family-social-ops.mjs registration:issue` 生成
- 家庭 / 孩子排查现在可优先通过 `household:inspect` / `child:inspect` 做第一轮定位

## 并行 Quick Wins

- 已把 `清晨阳光房` / `花园阳台` 背景图接回 `js/home.js`
- 已给 `home.js` 接上“最近来访”显示槽位
- 已给 `leaderboard.js` 接上“好友战绩视图”摘要层
