# Minecraft 词库视图分层实施记录

> **ID**: `PLAN-2026-07-08-MCVIEWS-01`
>
> **状态**: 已落地
>
> **目标**: 在不打散正式 `minecraft-vocab` 主仓的前提下，补出 `starter / core / typing-view / memory-view` 四个稳定视图，让不同玩法按训练目标取数，而不是各自复制一份题库。

## 1. 本次落地产物

正式主仓保持在：

- `data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json`

新增四个侧边视图文件：

- `data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab-starter.json`
- `data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab-core.json`
- `data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab-typing-view.json`
- `data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab-memory-view.json`

新增构建脚本与共享视图逻辑：

- `scripts/minecraft_vocab_views.cjs`
- `scripts/build_minecraft_vocab_views.cjs`

## 2. 四个视图的职责

### 2.1 starter

- 只保留 `mayihaoke` 的 24 张 seed 词卡
- 用于英语起步层、第一次接触词卡、低门槛热身

### 2.2 core

- 只保留 `minecraft_words_apk-main` 导入的 72 张 core 词卡
- 用于主题复盘、词义扩展、后续再细分难度

### 2.3 typing-view

- 从主仓里筛出 `3-7` 字母短词
- 当前共 `92` 张
- 混合保留 starter + core 两种来源
- 给打字玩法直接使用

### 2.4 memory-view

- 做成 `24` 张的紧凑精选集
- 只保留有翻译、有图片、可低龄认义的具体词
- 过滤 `hello / look / run / friend / bag / play / world / craft` 这类不适合作为看图找义主目标的词
- 补充 `viewCategory` 字段，方便后续地图记忆或场景分发玩法做轻量分组

## 3. 原型接线结果

`prj/学习机玩法原型` 的英语打字线已改成直接读取：

- `data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab-typing-view.json`

兼容导出仍保留：

- `prj/学习机玩法原型/assets/generated/minecraft-typing-expanded.json`

但它现在只是从 `typing-view` 再导出一份旧格式兼容包，不再自己独立筛词。

## 4. 暂不改动的点

`prj/单词记忆射击场原型` 当前仍保留农场动物卡数据，没有直接切到 `memory-view`。

原因不是数据层做不到，而是它现在还绑定了：

- 农场敌人贴图
- 本地语音映射
- 现有命中和奖励素材

这一层后续更适合单开一轮“记忆玩法数据适配”再接，不和本次英语主仓分视图混在一起。

## 5. 验证结果

已通过：

```bash
node "prj/minecraft_vocab_views_contract.test.mjs"
node "prj/学习机玩法原型/verify.mjs"
node "prj/learning_center_english_quiz_vocab_contract.test.mjs"
node "prj/minecraft_vocab_selector_contract.test.mjs"
node "prj/minecraft_core_vocab_expansion_contract.test.mjs"
node "prj/学习机玩法原型/scripts/test-full-prototype-smoke.mjs"
node "scripts/learning-center-smoke.mjs"
```

当前确认值：

- 主仓总数: `96`
- starter: `24`
- core: `72`
- typing-view: `92`
- memory-view: `24`

## 6. 后续建议

1. 下一步把 `memory-view` 再拆成“地图记忆版”和“图卡配对版”两个更窄的子视图。
2. 如果要把 `单词记忆射击场原型` 并入统一英语主仓，优先先做素材与语音适配层，不要直接替换运行时数据。
