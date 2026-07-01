# P0 验收清单：卡牌系统重构（图鉴修复 + 卡牌式）

> 阶段3产物 | 对应方案 §5 P0 | 模式：solution-loop
> gate 已确认方向（2026-07-01）

## P0 范围（图鉴立即修复 + 卡牌式骨架）

### 验收点
| # | 验收项 | 验证方法 |
|---|--------|---------|
| A1 | **配色统一**：pets.json rarity_config + CSS card-rarity-* 4档统一 WoW（N `#9D9D9D`/R `#0070DD`/SR `#A335EE`/SSR `#FF8000`） | grep 三处色值一致 |
| A2 | **卡牌四层**：每张卡 = 稀有度CSS边框(Layer1) + 立绘/emoji(Layer2) + 暗角(Layer3) + HTML数值角标(Layer4) | playwright 截图 |
| A3 | **未收集可见**：grayscale+brightness(.5)，非 opacity 0.4，轮廓可见 | playwright 截图对比 |
| A4 | **classpet emoji 兜底**：无图宠物显示大 emoji，角标数值正常 | playwright classpet 卡片 |
| A5 | **数值角标**：四角 HP左上/ATK右下（P0已有），DEF左下/SPD右上预留(P0显示'-'，P1填) | DOM 检查 |
| A6 | **不回归**：两级图鉴(大类→瀑布流→详情) + 详情模态 + 认养/小屋/战斗正常 | playwright 全流程 |

### P0 不做（后续阶段）
- def/spd 数据生成（P1）
- Agnes 边框图（P2，P0 纯 CSS 边框）
- 战斗接入（P4）
- 规格文档（P3）

## 关键文件
- `css/card-collection.css`（card-item 卡牌式重构 + 角标 CSS + 配色统一）
- `js/card-collection.js`（_renderGrid 四层渲染 + emoji 兜底）
- `data/pets.json`（rarity_config 配色统一）

## 验证脚本
- playwright：进图鉴 → 大类 → 瀑布流 → 截图卡牌（已收集/未收集/classpet）→ 详情模态
