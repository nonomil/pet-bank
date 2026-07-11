# 全量短旅行章节发布记录

## 本阶段交付

- 12 个探索场景全部使用 `chapter_flow.mode=short`：看见 → 选择 → 带回家。
- 数学题和遭遇战保留为可选挑战，挑战路径继续复用原有经验、战斗和掉落规则。
- 12 个场景均有旅行记忆元数据和小屋装饰 ID；3 个场景使用 verified Agnes 图片，9 个场景使用明确标记的 placeholder + emoji/CSS 回退。
- 首页旅行纪念区可显示全部 12 件纪念物，并为每件物品提供收入小屋操作。

## 验证

```text
node scripts/test-pet-adventure-retention.mjs
node scripts/test-narrative-closure.mjs
node scripts/test-travel-memory-assets.mjs
node scripts/test-short-travel-chapter-browser.mjs
node scripts/test-travel-memory-browser.mjs
node scripts/test-travel-memory-real-journey.mjs
node scripts/test-pet-growth-feedback.mjs
node scripts/test-pet-growth-history.mjs
node scripts/test-pet-care-daily-state.mjs
node scripts/test-core-reward-policy.mjs
```

结果：全部通过；`1280x720` 和 `390x844` 无横向溢出，浏览器测试无非预期 console error。

## 资产边界

本阶段没有伪造图片生成结果。Agnes 已验证资产仅保留在现有三场景目录；其余九场景的图片字段为空，后续可按同一 prompt/manifest/截图流程逐批生成。
