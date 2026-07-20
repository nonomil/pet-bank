# 研究与方法

## 已核实事实

1. NGSL 1.2 官方下载文件提供 lemma、SFI rank、SFI 和每百万调整频率，可作为通用英语频率排序。
2. Cambridge YLE 官方页面存在 Pre A1 Starters、A1 Movers、A2 Flyers 三个儿童阶段，顺序分别为第一、第二、第三阶段。
3. 当前 Cambridge 页面没有直接挂出可供本项目逐词导入的 YLE 词表文件，因此不能把阶段页当成每个单词的年龄证明。
4. Oxford Learner’s Dictionaries 的公开 Oxford 3000/5000 页面直接输出 `data-hw`、Oxford 3000/5000 等级和 CEFR 标记；本项目已固化 2979 个去重词条快照，可对卡片做 exact CEFR 交叉验证。
5. 当前 Minecraft 运行池为 2168 张卡，其中 2039 张属于 Minecraft 专有主题长尾；这些词不能仅因 NGSL 或 Oxford 词表缺失就删除。

## 本项目采用

分类分两层：

```text
项目年龄词表命中 + Cambridge 阶段锚点
                  -> curriculum-proxy

NGSL exact lemma -> common / familiar / extended
NGSL components -> *-components（解释复合词）
Minecraft 机制短语或完全不命中 -> specialized

Oxford exact word -> cefrEvidence (A1-C1)
```

每张卡同时写入 `classificationConfidence`。幼儿园/低年级的 exact NGSL 命中为 high，年龄代理或组成词证据通常为 medium，Minecraft 专有词为 low。

## 仍待补证据

- 若 Cambridge 重新公开可下载的逐词 YLE list，应将其保存到 `raw/`，把 `curriculum-proxy` 升级为 `official-wordlist-match`，并重新运行证据脚本。
- Oxford CEFR 命中不能替代 Cambridge 年龄清单；产品仍按 `ageEvidence` 的代理状态显示年龄阶段。
- NGSL 是通用英语频率表，不是儿童口语频率表；后续可增加经许可的儿童语料频率来源，但不能覆盖 NGSL 原始 rank。
- Minecraft 专有词的主题重要度应继续由游戏分类、远征章节和人工审核决定，不能由通用英语频率单独决定。

## 设计决策

默认远征仍从幼儿园阶段开始；`minecraft-core` 优先选择幼儿园/幼小衔接词和 exact/common 词。长尾词保留在 Minecraft 初级和进阶 band，供地图解锁后学习。此证据包只负责分级解释，不改变 FSRS 复习进度或积分结算。
