# pets.json 数据契约

> 文件: [data/pets.json](../../data/pets.json) (version 2.0, 261 物种)

---

## 顶层结构

```json
{
  "version": "2.0",
  "total": 261,
  "sources": {
    "original": "pet-bank 原生 8 种",
    "banchong": "仓鼠大冒险 91 种",
    "classpet": "classpet-pro1.0 40 种",
    "minecraft": "我的世界原版生物",
    "banchong2": "班宠乐园2 动物 40 种",
    "banchong2_plant": "班宠乐园2 植物 23 种"
  },
  "rarity_config": { /* 4 档稀有度 */ },
  "species": [ /* 261 个物种对象 */ ],
  "series": [ /* 系列元数据 */ ]
}
```

## rarity_config

```json
{
  "common":    { "name": "普通", "color": "#9D9D9D", "icon": "⚪" },
  "rare":      { "name": "稀有", "color": "#0070DD", "icon": "🔵" },
  "epic":      { "name": "史诗", "color": "#A335EE", "icon": "🟣" },
  "legendary": { "name": "传说", "color": "#FF8000", "icon": "🟡" }
}
```

## species 条目

```json
{
  "id": "string (unique, e.g. 'firefox')",
  "name": "string (中文名)",
  "emoji": "string (1-2 emoji)",
  "desc": "string (简短描述)",
  "rarity": "common | rare | epic | legendary",
  "source": "original | banchong | classpet | minecraft | banchong2 | banchong2_plant",
  "base_hp": "number",
  "base_atk": "number",
  "base_def": "number (可选, 默认0)",
  "base_spd": "number (可选, 默认0)",
  "imageStages": {
    "0": "string (URL, 蛋阶段)",
    "1": "string (URL, 幼崽)",
    "...": "...",
    "5": "string (URL, 终极体)"
  },
  "imageUrl": "string (兜底图片URL)",
  "series": "string (所属系列ID)"
}
```

## series 条目

```json
{
  "id": "string (系列唯一ID)",
  "name": "string (系列中文名)",
  "source": "string (来源标识)",
  "species": ["id1", "id2", ...]
}
```

## 读取者

| 模块 | 使用方式 |
|------|---------|
| pet.js (PetSystem.loadPetDB) | fetch → JSON.parse → SPECIES 数组 |
| card-collection.js | 作为卡牌来源（按系列/分馆组织） |
| card-arena.js | combatantFromSpecies 构建战斗单位 |
| home.js | 宠物选择器展示可选宠物 |
| app.js | maybeSeedStarterCards 新手卡牌 |

## 注意事项

- imageStages 索引对应 PetSystem.STAGES 的阶段编号
- PVZ 物种有 5 阶段（0-4），banchong 物种有 6 阶段（0-5）
- base_def/base_spd 是可选字段，缺失时默认 0
- 修改 pets.json 需同步更新 total 字段
- 备份文件 pets.json.bak 是修改前的快照
