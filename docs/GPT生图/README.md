# 生图与补图索引

> 本目录存放项目里和“宠物图片补全 / 动作图生成 / 提示词沉淀”相关的素材文档。
> 它不属于产品规范文档，但对资源补图、资产维护和后续视觉迭代很重要。

---

## 1. 当前文档

| 文件 | 作用 | 适用场景 |
|---|---|---|
| [banchong宠物生图提示词-补全48张](./banchong宠物生图提示词-补全48张.md) | banchong 系列缺图补全提示词与接入说明 | 9 只缺图宠物补图 |
| [MC宠物动作图提示词-happy-attack](./MC宠物动作图提示词-happy-attack.md) | Minecraft 宠物动作图提示词 | MC 动作姿态扩展 |
| [PVZ + Minecraft 宠物生图提示词](./PVZ%20+%20Minecraft%20宠物生图提示词.md) | PVZ / MC 系列统一提示词规范 | 批量生成基础素材 |
| [宠物小屋背景提示词](./宠物小屋背景提示词.md) | 宠物小屋 6 套主题房间背景提示词 + 接入 | 小屋装饰经济（P2）生图 |
| [探索 galgame 提示词](../plans/2026-06-29-探索故事galgame重设计.md) | 12 场景背景 + 12 角色立绘 + 怪物立绘（galgame VN 风） | 探索 galgame 视觉素材 |

---

## 2. 已生成资产记录（Agnes API）

| 资产 | 数量 | 位置 | 生成方式 | 模型 |
|---|---|---|---|---|
| galgame 场景背景 | 12 | `assets/scenes-vn/` | Agnes API 批量 | agnes-image-2.1-flash |
| galgame 角色立绘 | 12 | `assets/characters/` | Agnes API 批量 | agnes-image-2.1-flash |

> v0.5.3 用 Agnes 新 key（`sk-Dt1UZ...`）批量生成 24 张 galgame 素材。提示词见 [探索 galgame 提示词](../plans/2026-06-29-探索故事galgame重设计.md) §4。

---

## 3. 使用建议

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
