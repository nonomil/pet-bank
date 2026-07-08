# 社交+家庭组

> 社交: [js/social.js](../../js/social.js) (1246行)
> 家庭组: [js/household.js](../../js/household.js) (924行)
> 社交开关: [js/family-social-scope.js](../../js/family-social-scope.js) (32行)
> 成长报告: [js/family-review.js](../../js/family-review.js) (382行)
> 动态流: [js/activity-feed.js](../../js/activity-feed.js) (~100行)

---

## 原理

### 设计目标
社交功能分两期：一期（minimal-v1）仅支持家庭组成员间的简单互动（串门/打招呼/送小花/遛弯），二期扩展为完整社交。家庭组通过邀请码机制建立，家长审核加入。成长报告（FamilyReview）给家长展示孩子的学习路径而非分数排名。

### FamilySocialScope（功能开关）

```
DEFAULT_SCOPE = 'minimal-v1'

minimal-v1 模式下:
  - 隐藏云端诊断面板
  - 隐藏 PK 控制面板
  - 家庭组内简单互动

完整社交版:
  - 显示所有诊断和控制
  - 支持更丰富的社交功能
```

### 社交模型

```
互动动作 (ACTION_META):
  visit: 🏠 来串门 → 可以看对方宠物小屋
  wave:  👋 打招呼 → 门口热情打招呼
  gift:  🌼 送小花 → 送来一朵友谊小花
  walk:  🚶 一起遛弯 → 约伙伴去遛弯

数据流:
  家庭组成员 → 可见 + 可互动
  好友（已添加） → 可见 + 按 pk_access 决定是否可挑战
  陌生人 → 不可见
```

---

## 实现

### SocialSystem (social.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `SocialSystem.refresh()` | :80 | 刷新社交状态（家庭成员+好友+串门记录） |
| `SocialSystem.getState()` | :100 | 获取社交状态 |
| `SocialSystem.doAction(peerId, action)` | :200 | 执行互动动作 |
| `SocialSystem.renderFriendHomeVisit(containerId)` | :300 | 渲染串门视图（看对方小屋） |
| `SocialSystem.addFriend(peerId)` | :400 | 添加好友 |
| `SocialSystem.getAvailablePeers()` | :500 | 获取可互动同伴列表 |

### HouseholdSystem (household.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `HouseholdSystem.refresh(containerId)` | :100 | 刷新家庭组状态 |
| `HouseholdSystem.createInvite()` | :200 | 生成邀请码 |
| `HouseholdSystem.acceptInvite(code)` | :250 | 接受邀请加入家庭组 |
| `HouseholdSystem.getMembers()` | :300 | 获取家庭成员列表 |
| `HouseholdSystem.removeMember(id)` | :350 | 移除成员 |

### PKService (pk-service.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `PKService.refresh()` | :80 | 刷新PK匹配状态 |
| `PKService.getAvailablePeers()` | :49 | 获取可挑战的同伴（仅家庭成员） |

### FamilyReview (family-review.js)

| 函数 | 行号 | 说明 |
|------|------|------|
| `FamilyReview.refresh(containerId)` | :30 | 刷新成长报告 |
| `FamilyReview.renderReport()` | :100 | 渲染报告视图 |

### 持久化

```
key: petbank_social_local_visits → 本地串门记录 (social.js:177)
```

---

## 注意事项

- 社交功能在 minimal-v1 模式下大量功能被隐藏
- 家庭组邀请码机制依赖 Supabase 后端
- 本地串门记录存 localStorage，云端同步到 Supabase
- PK 挑战仅限于家庭成员（PKService:12 `ONLY_HOUSEHOLD_PK_NOTICE`）
- escapeHtml 在 social.js、household.js、pk-service.js 中各自重复实现
