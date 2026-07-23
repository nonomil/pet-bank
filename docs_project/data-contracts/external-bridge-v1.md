# PetBank Bridge v1

这是主站与独立子项目之间的最小运行时协议。协议只传递一次启动会话、匿名 Profile 引用和完成事件，不传递孩子姓名、主站积分余额、账号凭证或 Profile 快照。

## 启动

主站为每次新窗口生成短期 `launchId`，在子项目 URL hash 中附加：

```text
#petbankLaunch=<opaque-launch-id>&petbankProfile=<opaque-profile-ref>
```

`petbankProfile` 只允许作为子项目本地存储分区标识，不应被渲染为姓名。直接打开子项目没有这两个参数时，桥接处于独立访问模式。

## 完成事件

子项目在自己的完成状态成功持久化后，向 `window.opener` 发送：

```json
{
  "type": "petbank.bridge.v1.completed",
  "version": 1,
  "launchId": "opaque-launch-id",
  "profileRef": "opaque-profile-ref",
  "projectId": "learning-center",
  "activityId": "group-a",
  "completionId": "session:child-a:group-a:40000:set",
  "occurredAt": "2026-07-23T10:00:00.000Z"
}
```

`completionId` 必须稳定，重复发送不能代表再次完成。子项目不得在消息里放 `points`、`pet_exp`、余额或内部奖励 receipt；主站依据项目配置决定是否发放成长奖励。

主站必须同时校验：消息来源 origin、`version`、`projectId`、有效 launch、有效期、launch Profile 与消息 Profile、当前活动 Profile，以及 `completionId` 的 receipt 幂等性。校验失败只返回 `rejected`，不得修改主站状态。

## 奖励结果

主站向发起窗口回传：

```json
{
  "type": "petbank.bridge.v1.reward-result",
  "version": 1,
  "projectId": "learning-center",
  "launchId": "opaque-launch-id",
  "profileRef": "opaque-profile-ref",
  "activityId": "group-a",
  "completionId": "session:child-a:group-a:40000:set",
  "status": "accepted|duplicate|rejected"
}
```

子项目收到结果前可以保存自己的学习状态，但只能把 `accepted`/`duplicate` 显示为主站奖励已处理；`rejected` 必须显示为需要重试或联系家长。独立访问模式不监听或发送主站奖励事件。

当前使用通用协议的项目为单词远征、学习中心和小游戏项目。绘本项目仍保留 `petbank.picturebook.*` 兼容消息；绘本桥接继续单独校验 `bookId`，不应把两种消息格式混用。

学习中心和小游戏的本地开发地址分别为 `http://127.0.0.1:7001/` 与 `http://127.0.0.1:7003/`，生产地址分别为 `https://nonomil.github.io/learning-center/` 与 `https://nonomil.github.io/mini-games/`。小游戏由 hub 再打开具体游戏，完成消息先由 hub 转发到主站，奖励结果再转回具体游戏。

独立项目之间的导航不属于奖励协议：各项目通过自己的静态链接配置提供新窗口互链。学习中心和小游戏使用各自的 `data/manifest.json`，单词远征使用 `data/project-links.json`，绘本馆使用 `public/project-links.json`。本地开发时选择 `devUrl`，正式发布时使用对应 `url`；不能把开发端口写成生产地址。当前四个正式地址为：绘本馆 `https://nonomil.github.io/picturebook-library/`、单词远征 `https://nonomil.github.io/word-quest-learning-game/`、学习中心 `https://nonomil.github.io/learning-center/`、小游戏 `https://nonomil.github.io/mini-games/`。
