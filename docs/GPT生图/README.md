# 生图与补图索引

> 本目录存放项目里和“宠物图片补全 / 动作图生成 / 提示词沉淀”相关的素材文档。
> 它不属于产品规范文档，但对资源补图、资产维护和后续视觉迭代很重要。

---

## 1. 当前文档

| 文件 | 作用 | 适用场景 |
|---|---|---|
| [banchong宠物生图提示词-补全48张](./banchong宠物生图提示词-补全48张.md) | banchong 系列缺图补全提示词与接入说明 | ⛔ **临时中止 2026-07-01**（暂不生图；原计划 9 只约 54 张） |
| [MC宠物动作图提示词-happy-attack](./MC宠物动作图提示词-happy-attack.md) | Minecraft 宠物动作图提示词 | MC 动作姿态扩展 |
| [PVZ + Minecraft 宠物生图提示词](./PVZ%20+%20Minecraft%20宠物生图提示词.md) | PVZ / MC 系列统一提示词规范 | 批量生成基础素材 |
| [宠物小屋背景提示词](./宠物小屋背景提示词.md) | 宠物小屋 6 套主题房间背景提示词 + 接入 | 小屋装饰经济（P2）生图 |
| [儿童游戏 UI 资产流水线](./儿童游戏UI资产流水线.md) | GPT/Agnes/ChatGPT/Cowart 生图到透明 PNG 资产包的项目 SOP | 学习机玩法、儿童游戏 UI、爆炸图裁切与网页接入 |
| [卡牌系统专题资源](../卡牌系统/资源/) | 卡牌边框生图提示词、合成脚本、卡牌参考样式 | 卡牌系统专题资源已独立归档 |
| [探索 galgame 提示词](../plans/2026-06-29-探索故事galgame重设计.md) | 12 场景背景 + 12 角色立绘 + 怪物立绘（galgame VN 风） | 探索 galgame 视觉素材 |

---

## 2. 已生成资产记录（Agnes API）

| 资产 | 数量 | 位置 | 生成方式 | 模型 |
|---|---|---|---|---|
| galgame 场景背景 | 12 | `assets/scenes-vn/` | Agnes API 批量 | agnes-image-2.1-flash |
| galgame 角色立绘 | 12 | `assets/characters/` | Agnes API 批量 | agnes-image-2.1-flash |
| 宠物图鉴分馆封面底图 | 4 | `assets/pokedex-halls/` | Agnes API 批量 | agnes-image-2.1-flash |
| 宠物图鉴分馆封面合成图 | 4 | `assets/pokedex-halls/` | Agnes 背景 + 本地代表卡叠加 | 本地合成 |
| 宠物卡牌 V2 底图 | 4 | `assets/cards/v2/` | Agnes API 批量 | agnes-image-2.1-flash |
| 宠物卡牌 V2 合成图 | 198 | `assets/cards/composed-v2/` | Agnes 底图 + 本地脚本叠中文属性 | 本地合成 |
| 学习中心中文资料包入口封面 | 1 | `assets/learn/` | Agnes API 单张生成 | agnes-image-2.1-flash |

> v0.5.3 用 Agnes API 批量生成 24 张 galgame 素材。提示词见 [探索 galgame 提示词](../plans/2026-06-29-探索故事galgame重设计.md) §4。
>
> v0.5.4 新增图鉴分馆封面流程：
> 先用 `scripts/generators/gen_gallery_covers.py` 生成 4 张分馆底图，再用 `scripts/generators/compose_gallery_cover_collages.py` 把代表宠物卡直接烘进背景图，最终供图鉴首页 4 张分馆卡复用。
>
> v0.5.5 新增宠物卡牌 V2 流程：
> 先用 `scripts/generators/gen_card_frames_v2.py` 生成 4 张卡牌底图，再用 `scripts/generators/compose_cards_v2.py` 批量叠加宠物立绘、中文名称和 `生命 / 攻击 / 防御 / 速度` 属性，输出到 `assets/cards/composed-v2/`。
>
> v0.7.5 新增学习中心中文资料包入口封面流程：
> 使用 `scripts/generators/gen_learning_portal_covers.py` 生成 `assets/learn/portal-chinese-summer-classroom-20260705.png`，风格为 `暖黄绘本课堂`，用于学习入口大厅的中文资料包封面。

---

## 3. 使用建议

- 想做学习机/儿童游戏 UI 资产包：
  先看 `儿童游戏UI资产流水线.md`，再调用项目技能 `.codex/skills/gpt-image-ui-assets/`
- 想补仓鼠系 / banchong 缺图：
  先看 `banchong宠物生图提示词-补全48张.md`
- 想扩展 MC 动作图：
  看 `MC宠物动作图提示词-happy-attack.md`
- 想统一 PVZ / MC 宠物视觉风格：
  看 `PVZ + Minecraft 宠物生图提示词.md`
- 想生宠物小屋背景 / galgame 素材：
  看 `宠物小屋背景提示词.md` 或 [galgame 重设计 §4](../plans/2026-06-29-探索故事galgame重设计.md)

---

## 3. 和主文档体系的关系

- 产品需求、架构、路线不在本目录维护，统一看 [../README.md](../README.md)。
- 本目录更偏**资源生产说明**，服务于宠物图资产补齐与风格统一。
