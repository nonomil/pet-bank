# 短旅行章节发布记录

## 本阶段交付

- 12 个探索场景均增加 `chapter_flow.mode=short`。
- 默认路径变为“看见 → 选择 → 带回家”，两张短卡后即可做一次路线选择，选择反馈后可直接领取旅行纪念物。
- 数学题和遭遇战保留为可选挑战；点击“挑战一下”后仍进入原数学题、战斗和旅行卡闭环。
- 短流程进度通过既有场景进度键保存 `flowPhase`、`seeCursor`、`challengeStatus` 和选择反馈；从根入口刷新可恢复。
- 12 个旅行记忆均有元数据和小屋装饰 ID；3 个有 verified Agnes 图片，9 个明确标为 placeholder 并使用 emoji/CSS 回退。

## 测试

通过：

```text
node scripts/test-pet-adventure-retention.mjs
node scripts/test-narrative-closure.mjs
node scripts/test-short-travel-chapter-browser.mjs
node scripts/test-travel-memory-assets.mjs
node scripts/test-travel-memory-real-journey.mjs
node --check js/exploration-chapter.js
node --check js/exploration-progress.js
node --check js/exploration-detail.js
```

## 浏览器验收

- 服务：`python -m http.server 9077 --bind 127.0.0.1`
- 森林默认路径：不打开战斗 modal，显示旅行完成卡并清理进度。
- 海滩挑战路径：刷新根入口后恢复数学题，答对后进入战斗并显示完成卡。
- 移动 `390x844`：无横向溢出；桌面 `1280x720`：无非预期控制台错误。
- 旧三场真实旅程脚本已改为显式点击“挑战一下”，三场挑战均胜利并保留旅行卡/宠物快照验收。

## 已知边界

- Python 静态服务器不提供 history fallback，不能直接刷新 `/app/explore`；应用使用根入口 `/`。
- 9 个 placeholder 场景尚未生成图片，不将占位图伪装为已验证素材。
- 新短句的本地语音映射仍可能出现 VoiceSystem warning，但不影响页面功能验收。
