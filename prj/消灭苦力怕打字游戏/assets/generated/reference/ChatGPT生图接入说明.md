# ChatGPT 生图接入说明

## 目标

把 ChatGPT 生成的新版 Minecraft 风格苦力怕资产，发布到：

`prj/消灭苦力怕打字游戏/assets/generated/typing-defense-assets/`

并直接替换当前网页里偏丑的 Agnes 版本。

## 需要的 7 个文件

ChatGPT 下载后，请把图片放到：

`prj/消灭苦力怕打字游戏/assets/generated/reference/`

文件名必须是：

- `creeper_generated_far.png`
- `creeper_generated_mid.png`
- `creeper_generated_near.png`
- `creeper_generated_danger.png`
- `creeper_explosion_0.png`
- `creeper_explosion_1.png`
- `creeper_explosion_2.png`

## 提示词

直贴版提示词：

`prj/消灭苦力怕打字游戏/assets/generated/reference/chatgpt-直贴提示词.md`

## 发布命令

```powershell
python .\prj\消灭苦力怕打字游戏\tools\publish_chatgpt_creeper_assets.py
```

这个脚本会：

1. 读取 7 张语义命名 PNG
2. 把接近纯白背景转成透明
3. 自动裁掉外围空白
4. 缩放并居中到 1024x1024 透明画布
5. 覆盖发布到 `typing-defense-assets`
6. 写出 `chatgpt-creeper-manifest.json`

## 发布后验证

```powershell
node .\prj\消灭苦力怕打字游戏\web\verify.mjs
node .\prj\消灭苦力怕打字游戏\web\simulate.mjs
```

## 备注

- 这条链路默认保留网页逻辑不变，只替换美术素材。
- 如果 ChatGPT 给的是一张多资产透明爆炸图，而不是 7 张单图，先走 `prj/gpt-image-workflow` 的 `split`，再重命名成上面的语义文件名。
