# 三样板短旅行章节第二批发布记录

## 本阶段交付

- `candy`、`waterfall`、`desert` 增加 `chapter_flow.mode=short`。
- 复用第一批状态机：两张看见卡、一次路线选择、可直接带回家，数学/战斗按需挑战。
- `underwater` 仍作为未迁移 legacy 场景保留兼容回归样本。

## 验证

```text
node scripts/test-pet-adventure-retention.mjs
node scripts/test-short-travel-chapter-browser.mjs
node scripts/test-travel-memory-real-journey.mjs
```

结果：全部通过；桌面/移动无横向溢出，挑战路径仍可进入现有战斗。
