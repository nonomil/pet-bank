# 时间与生命周期规则

> 本文档记录所有涉及时钟、定时器、每日重置、状态生命周期的规则。
> 修改任何时间相关逻辑前必须阅读此文档。

---

## 一、每日重置

### 日切判断方式（不一致！）

| 模块 | 方式 | 示例 | 位置 |
|------|------|------|------|
| 宝箱 | `new Date().toLocaleDateString()` | `'2026/7/8'`（zh-CN 本地化格式） | treasure.js:38,112 |
| 遛弯 | `new Date().toDateString()` | `'Wed Jul 08 2026'` | walk.js:89,100; app.js:1503 |
| 卡牌竞技场 | `new Date().toLocaleDateString('sv-SE')` | `'2026-07-08'`（ISO 日期） | card-arena-ui.js:290,317 |

**⚠️ 三种日切判断方式不统一，跨模块对比日期会失败。** 建议统一为 `toLocaleDateString('sv-SE')`（ISO 格式，可比较排序）。

### 每日触发点

| 触发 | 条件 | 位置 |
|------|------|------|
| 日常宝箱重置 | `lastClaimDate !== today` | treasure.js:36-38 |
| 遛弯日志日更 | `lastWalkDate !== today` | walk.js:89-100 |
| 卡牌每日限制 | `lastPlayDate !== today` | card-arena-ui.js:290-297 |
| 任务完成数日更 | 新一天首次完成时重置为 0（隐式：completedTasks 跨天不清零，但已完成任务可再次 toggle） | app.js:169 |
| 积分 | **不日更**，持续累积 | app.js:162 |

---

## 二、Profile 生命周期

### 切换流程

```
1. ProfileManager.switchToProfile(targetId)
2.   → 遍历所有 localStorage petbank_* 业务键
3.   → 当前 profile 快照写入 petbank_profile_data_{currentId}
4.   → 清空所有业务键
5.   → 从 petbank_profile_data_{targetId} 恢复
6.   → location.reload()  ← 页面完全重载
```

**影响**：所有运行状态（定时器/事件监听/模块内部变量/游戏进度）在切换时**全部丢失**。

### location.reload() 触发点

| 位置 | 触发条件 |
|------|---------|
| profiles.js:255 | 正常 profile 切换（保存当前快照） |
| profiles.js:268 | 删除 profile 后回退启动页 |
| auth.js:436 | 登录成功（等待 400ms） |
| household.js:528 | 退出家庭组（等待 400ms） |
| tools.js:163 | 数据导入完成（等待 1000ms） |

---

## 三、PetSystem 衰减时间

### Decay 结算

```
markHomeExit() → pet.js:322
  last_home_ts = Math.floor(Date.now() / 1000)  ← unix 秒（不是毫秒！）

decay() → pet.js:295
  now = Math.floor(Date.now() / 1000)            ← unix 秒
  elapsed = now - last_home_ts                    ← 秒数差值
  hunger -= elapsed / 3600 * HUNGER_DECAY_RATE    ← 每小时衰减
  happiness -= elapsed / 3600 * HAPPINESS_DECAY_RATE
  cleanliness -= elapsed / 3600 * CLEANLINESS_DECAY_RATE
```

**首次进入小屋**: `last_home_ts` 为 null → decay 跳过（不衰减）

---

## 四、云端同步节流

### scheduleSync 节流

```
cloud-sync.js:382  scheduleSync(reason, options)
  延迟 2000ms 后执行 sync
  多次调用: 取消前一个 timer，重新计时
  → 最终保证仅最后一次 scheduleSync 生效
```

### 触发点

| reason | 触发位置 | 频率 |
|--------|---------|------|
| `home_exit` | app.js:1003 | 离开小屋 |
| `pet_choose_species` | app.js:2094,2110 | 选择宠物 |
| `pet_feed_page` | app.js:2130 | 喂食 |
| `pet_play_page` | app.js:2138 | 玩耍 |
| `pet_rest_page` | app.js:2146 | 休息 |
| `exploration_start` | exploration.js:416 | 开始探索 |
| `exploration_win` | exploration.js:611 | 探索胜利 |
| `home_runtime` | home.js:409 | 小屋操作 |
| (其他) | 各模块调用 | — |

---

## 五、定时器使用

### setTimeout（UI 清理类）

| 用途 | 位置 | 时长 |
|------|------|------|
| Toast 消失 | app.js:1326 | 1200ms |
| 宠物气泡消失 | app.js:2494 | 2200ms |
| 遛弯气泡轮播 | walk.js:180,306 | 可变 |
| 战斗特效清理 | battle-fx.js:146,149 | 520ms |
| 答题结果卡片 | hanzi-game.js:489 | 1100ms |
| 正确答案闪烁 | math-pk.js:855 | 1100ms |

### setTimeout（延迟执行类）

| 用途 | 位置 | 时长 |
|------|------|------|
| runtime-loader 预取延迟 | runtime-loader.js:238,345,395 | 0/400ms |
| Profile 操作确认后 | profiles.js:441 | 150ms |
| 登录后 reload | auth.js:435 | ~400ms |
| 退出家庭组 reload | household.js:528 | ~400ms |
| 数据导入后 reload | tools.js:163 | 1000ms |

### setInterval

| 用途 | 位置 | 频率 |
|------|------|------|
| 作品展示自动轮播 | showcase.js:129 | INTERVAL ms |
| 番茄钟计时 | tools.js:406 | 1000ms |
| 随机抽取动画 | tools.js:224 | 50ms |
| 遛弯场景动画 | walk.js:301 | setInterval + setTimeout 嵌套 |

---

## 六、游戏内时间追踪

### 数学PK

```
matchStartTs = Date.now()  → math-pk.js:1088,1249 (毫秒)
roundStartTs = Date.now()  → math-pk.js:1349 (毫秒)
robotDeadlineTs            → math-pk.js:1365 (毫秒)
humanMs = now - roundStartTs → math-pk.js:1466 (判定按钮和计时器谁先触发)
durationMs = now - matchStartTs → math-pk.js:1559 (结算用)
```

### 汉字游戏

```
matchStartTs = Date.now()  → hanzi-game.js:419,440 (毫秒)
durationMs = now - matchStartTs → hanzi-game.js:511 (结算用)
```

---

## 七、页面激活令牌

```
pageActivationToken → app.js:146
  每次 switchPage() 时 ++pageActivationToken
  异步操作完成后检查 token !== pageActivationToken → 丢弃结果
  防止快速切页时旧页面的异步回调污染新页面
```

### 令牌检查位置

| 位置 | 条件 |
|------|------|
| app.js:1221 | `preparePage()` 开始 |
| app.js:1230 | 异步加载完成后渲染前 |
| profiles.js:441 | Profile 操作确认 |

---

## 八、Speech 防抖

```
voice.js:36  节流状态 { selector -> lastTimestamp }
  → 同一 selector 在 N ms 内不能重复触发
  → 防止探索地图快速点击时旧旁白继续播放
voice.js:81  播放超时补救: 3s 后 abort
voice.js:211 等待播完或 12s 兜底超时
voice.js:313 只节流同一文本，新对话立即播报
```

---

## 注意事项

- `pet.js` 使用 `unix秒`（`/1000`），其他所有位置使用 `Date.now()`（毫秒）——两者比较前必须统一
- `treasure.js` 和 `walk.js` 的日切判断格式不同，跨模块比较日期会失败
- Profile 切换会 `location.reload()`，不要在切换后依赖内存中的状态
- scheduleSync 是节流而非防抖——最后一个调用会执行，中间的被取消
- CD 系统（`PetSystem.cooldowns`）不持久化，每场战斗 `resetBattleState()` 清零
