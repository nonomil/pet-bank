# Minecraft 词库外部证据包

更新时间：2026-07-20

本目录记录 Minecraft 单词远征运行词库的年龄阶段锚点、通用英语频率证据和可复核生成脚本。它不是发布制品；`raw/` 下的原始快照只供审计和重新生成使用。

## 当前结果

- 运行词库：2168 张去重词卡。
- 频率来源：NGSL 1.2，官方 CSV 共 2809 个 lemma；124 张卡是精确 lemma 命中，复合卡保留组成词 rank，无法命中的 Minecraft 机制词标记为 `specialized`。
- CEFR 交叉证据：Oxford 3000/5000 公开逐词页面快照共 2979 个去重词条；125 张卡是精确词条命中，保存 A1-C1 等级。它是 CEFR/通用学习词表证据，不是儿童年龄认证。
- 年龄来源：Cambridge English Young Learners 的 Pre A1 Starters、A1 Movers、A2 Flyers 官方阶段页。
- 年龄分类：87 张幼儿园、39 张幼小衔接、3 张小学低年级沿用项目词表匹配，并标记为 `curriculum-proxy`；2039 张 Minecraft 专有词标记为 `minecraft-specialized`，不声称有逐词年龄命中。
- 置信度：75 张 high、54 张 medium、2039 张 low。Minecraft 专有长尾保持 low，不能因为组成词或 CEFR 近似而变成常用词。

## 重新生成

先确认 `raw/NGSL_12_stats.csv` 和 `raw/OXFORD_3000_5000_CEFR.csv` 存在，再运行：

```powershell
node scripts/annotate_minecraft_vocab_evidence.mjs
node scripts/test-minecraft-vocab-evidence.mjs
```

若重新从 Oxford 官方 HTML 生成 CEFR 快照，先下载公开页面，再运行：

```powershell
curl.exe -L --compressed 'https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000' -o tmp/oxford-wordlists.html
node scripts/extract_oxford_wordlist_snapshot.mjs tmp/oxford-wordlists.html
node scripts/annotate_minecraft_vocab_evidence.mjs
```

生成脚本会校验 NGSL 的 `Lemma` / `SFI Rank`、Oxford 快照的 `word` / `cefr` 列，计算 SHA-256，并回写 `data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json` 的 `ageEvidence`、`frequencyEvidence`、`cefrEvidence`、`classificationConfidence` 和 `curriculumEvidence`。

## 字段边界

- `frequencyEvidence.matched=true` 只表示卡片词本身是 NGSL lemma，不表示 Minecraft 语境频率。
- `matchType=components` 只供解释复合词组成部分；带有机制短语标记的整卡仍为 `specialized`。
- `ageEvidence.matchType=curriculum-proxy` 表示项目年龄词表与 Cambridge YLE 阶段锚点的代理关系，不是 Cambridge 官方逐词清单命中。
- `cefrEvidence.matchType=exact-wordlist` 表示卡片词面在 Oxford 公开词表快照中逐词命中；只用于补充 CEFR/通用词表证据，不改写 Cambridge 年龄阶段代理。
- `minecraft-specialized` 词仍保留在高级/主题 band 中，不能因为通用频率低而删除。

来源与关键摘录见 [sources.md](sources.md)，方法与待补证据见 [research.md](research.md)。
