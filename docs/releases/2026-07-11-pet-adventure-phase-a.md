# 宠物进化与探索留存 Phase A 发布记录

## 本阶段交付

- 新增只读进化预览模型：显示当前形态、下一形态、剩余等级和预览图片。
- 宠物小屋增加单一进化预览 CTA 和轻量预览弹层，不改变经验/积分规则。
- 探索故事增加短句优先适配：默认显示 `shortText`，详细文本按需展开。
- 探索宠物立绘增加 `happy`、`surprised`、`worried`、`proud` 情绪 class。
- 森林、海滩、星光花园三个样板场景完成短句和情绪数据接入。
- 语音观察器改为读取可见文本，折叠详情不会被自动播报。

## 测试

通过：

- `node scripts/test-pet-adventure-retention.mjs`
- `node scripts/test-pet-growth-feedback.mjs`
- `node scripts/test-pet-growth-history.mjs`
- `node scripts/test-pet-care-daily-state.mjs`
- `node --check js/home.js`
- `node --check js/exploration-detail.js`
- `node --check js/voice.js`
- `node --check js/runtime-loader.js`
- 森林、海滩、星光花园 JSON 解析校验

## 真实浏览器验收

服务器：`python -m http.server 9077 --bind 127.0.0.1`

- 桌面：`1280x720`
  - 首页进化卡显示 `Lv.1 · 蛋`、下一阶段和剩余等级。
  - 点击“看看下一阶段会变成什么”打开“蛋 → 幼崽”预览。
  - 探索森林显示短句、可展开详情和 `mood-surprised`。
  - 发现事件显示短句和 `mood-happy`。
  - 无横向溢出、无 JavaScript error。
- 移动：`390x844`
  - 首页进化卡正常布局。
  - 无横向溢出。

截图：

- `docs/releases/pet-adventure-phase-a-desktop.png`
- `docs/releases/pet-adventure-phase-a-mobile.png`

## 后续项

- 三个样板场景的新短句需要补生成并登记本地语音资源，否则 VoiceSystem 会按现有策略记录缺失音频 warning。
- Phase B 再接入旅行纪念物和回家展示。
