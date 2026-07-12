# 时间与生命周期规则

> 当前基线：2026-07-12。修改日切、计时、衰减、Profile 切换或定时器前必须阅读本文件。核心维护规则也见 `AGENTS.md`。

## 1. 时间语义

| 语义 | 约定 | 用途 |
| --- | --- | --- |
| 本地业务日 | `YYYY-MM-DD`，由 `window.PetBankTime.localDate()` 提供 | 今日任务、每日宝箱、学习单等日状态 |
| 即时时间 | `Date.now()`，毫秒 | 局内计时、排序、timer 截止时间 |
| 审计时间 | `new Date().toISOString()` | receipt、成长历史、词汇更新时间 |
| 宠物衰减时间 | Unix 秒 | `PetSystem.last_home_ts` 与 `decay()` 内部计算 |
| 展示时间 | 页面本地化格式 | 只用于 UI，不可作为业务 key 或跨模块比较值 |

不要把展示字符串当业务日期；不要把 Unix 秒和毫秒直接相减。

## 2. 每日状态

`js/time-utils.js` 的 `PetBankTime` 提供跨模块的日期和时间单位转换；`js/app.js` 的 `PetBankDailyState` 是当前每日任务和日常宝箱的共享状态合同：

```text
{ date, profileId, completedTasks, dailyChestClaimed, dailyChestCount }
```

读取时按 `date + profileId` 判断是否为当前状态；跨本地日重建任务集合和日宝箱数量，积分本身不清零。业务模块不要复制日期算法，直接调用 `PetBankTime.localDate()`。旧键仍被同步用于兼容：

- `petbank_completed`
- `petbank_tasks_completed_today`
- `petbank_daily_claim_date`
- `petbank_chests`

旧日常领取键仍可能写入 `toLocaleDateString()`，这是迁移兼容，不是新代码格式。新模块只调用 `PetBankDailyState`，不要再读取这些旧键判断今日状态。

目前仍存在历史日切实现：

- 宝箱兼容路径：本地化日期字符串。
- 遛弯：旧 `toDateString()` 日志比较。
- 卡牌竞技场：独立的 ISO/本地日期逻辑。

收敛顺序：先保持旧值可读，再双读/单写到共享日键，验证一版后才可删除兼容路径。

## 3. Profile 生命周期

`ProfileManager` 当前使用兼容型 swap：

```text
switchTo(target)
  -> 枚举所有 petbank_* 业务键
  -> 保存当前到 petbank_profile_data_{currentId}
  -> 清空当前业务键
  -> 恢复目标快照
  -> location.replace(应用壳 URL)
```

影响：页面 reload 会清掉内存变量、timer、事件监听和未持久化的局内状态。任何切换后动作都必须在重新初始化后发生；不要假设模块对象会跨 profile 存活。

注意：动态枚举不是强白名单。非 `petbank_` 键、未登记 key、模块内存和第三方存储都不在快照内。未来用 storage registry + learner/parent/device 白名单替换此方案前，不能宣称“所有数据已隔离”。

其他 reload 入口包括：删除 profile、数据导入完成后的恢复流程。修改这些入口要验证当前路由、深层 URL 和恢复后的 active profile。

## 4. 宠物状态衰减

`PetSystem.markHomeExit()` 写入 Unix 秒时间戳；`PetSystem.decay()` 在下一次加载/进入相关流程时按经过秒数折算小时衰减。首次没有 `last_home_ts` 时不衰减。

规则：

- 只在 `PetSystem` 内部处理秒单位，外部传入毫秒时先显式转换。
- 衰减结果要 clamp 到合法范围并持久化。
- 页面离开小屋的钩子在 `app.js`，不要在 UI timer 中模拟衰减。
- profile 切换和导入恢复后要重新加载状态再结算，不能复用旧内存对象。

## 5. Timer、异步和页面激活

- `setTimeout` 适合 toast、特效、延迟预加载等 UI 生命周期，不是奖励或日切依据。
- `setInterval` 必须有明确 owner、停止条件和 reload/离页清理路径；重点关注番茄钟、展示轮播、遛弯动画。
- `app.js` 使用 `pageActivationToken` 防止异步加载完成后把旧页面渲染到新页面。新增跨页异步任务要复用 token 或 AbortController。
- `PetBankTime` 只负责纯时间值计算，不持有 timer，也不改变业务状态；页面和玩法模块仍必须由 owner 保存并清理自己的 timer/AbortController。
- `runtime-loader` 的 feature Promise 和资源 Promise 用于去重；不要在业务模块里绕过 loader 重复插入脚本。
- 语音播放需要停止旧音频/取消旧请求；探索离页时必须停止语音。
- Profile reload、导入 reload 和独立小游戏 iframe 都应视为生命周期边界，消息和回调必须带 source/session/seq 校验。

## 6. 游戏计时与奖励

- 数学 PK、汉字等局内时长使用毫秒时间戳，结算前统一计算 `durationMs`。
- iframe 桥消息必须校验来源、sessionId、seq，并通过 receipt 防止重复奖励。
- 结算依赖稳定 `eventId + profileId + source`，不能依赖按钮是否再次点击或页面是否刷新。
- 新增“每日限制”必须复用本地业务日合同，不能用局内开始时间推导日切。

## 7. 服务端同步生命周期

当前浏览器已在启动恢复、孩子切换前、页面隐藏/退出时执行基础快照同步；SQLite 后端提供认证、revision 快照和冲突拒绝。网络失败会进入 `petbank_self_hosted_snapshot_outbox_v1`，按孩子合并最新快照并退避重试；revision 冲突会保留为 `conflict`，不自动覆盖或合并。当前仍无多端合并和完整 canary 演练。后续新增同步能力必须保持显式动作、幂等键、冲突处理、快照保留和退出登录清理，不能把“后台定时上传 localStorage”当成默认实现。

## 8. 修改前最小验证

时间/生命周期改动至少覆盖：

1. 同一 profile 同日刷新保持状态。
2. 下一本地日任务和日宝箱正确重置。
3. 旧日期格式和损坏存储可迁移/安全 fallback。
4. 两个 profile 不互读每日状态和词汇奖励。
5. 快速切页后旧异步结果不覆盖新页面。
6. 重复 iframe 消息、刷新和重复结算不重复加分。

对应入口：`scripts/test-daily-state.mjs`、`scripts/test-game-reward-receipts.mjs`、`scripts/test-english-vocab-profile-scope.mjs`、`prj/profile_isolation_journey_simulation.mjs`。
