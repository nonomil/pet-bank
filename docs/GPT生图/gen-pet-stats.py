# -*- coding: utf-8 -*-
"""为所有宠物生成 base_def/base_spd（rarity 基线 + atk 倾向修正 + md5 固定种子 + 分布校验）
用法: python .tmp/gen-pet-stats.py
可复现：同 id 总是同一组 def/spd（md5 种子）。"""
import json, hashlib, random, statistics, shutil, os, sys
sys.stdout.reconfigure(encoding='utf-8')

SRC = 'data/pets.json'
BAK = '.tmp/pets.json.bak'
with open(SRC, encoding='utf-8') as f:
    db = json.load(f)

flat = db.get('flat')
if not flat:
    # 兜底：找第一个 list 值
    for k, v in db.items():
        if isinstance(v, list) and v and isinstance(v[0], dict) and 'id' in v[0]:
            flat = v; print(f'(flat 键未找到，用 {k})'); break
print(f'宠物数: {len(flat)}')

shutil.copy2(SRC, BAK)

# rarity 基线区间 (def, spd)
BASELINE = {
    'common':    {'def': (2, 5),   'spd': (3, 6)},
    'rare':      {'def': (5, 8),   'spd': (6, 9)},
    'epic':      {'def': (8, 11),  'spd': (9, 12)},
    'legendary': {'def': (11, 15), 'spd': (12, 16)},
}

# 每 rarity 的 atk 均值（倾向修正基准）
atk_avg = {}
for r in BASELINE:
    atks = [p.get('base_atk', 5) for p in flat if (p.get('rarity') or 'common') == r]
    atk_avg[r] = statistics.mean(atks) if atks else 5

def rng_for(pet_id):
    h = int(hashlib.md5(pet_id.encode('utf-8')).hexdigest()[:8], 16)
    return random.Random(h)

count = 0
for p in flat:
    r = p.get('rarity') or 'common'
    if r not in BASELINE:
        r = 'common'
    rng = rng_for(p['id'])
    base = BASELINE[r]
    atk = p.get('base_atk', 5)
    avg = atk_avg[r]
    atk_dev = max(-1, min(1, (atk - avg) / avg)) if avg else 0  # 高攻→正
    def_lo, def_hi = base['def']
    spd_lo, spd_hi = base['spd']
    span_d = def_hi - def_lo
    span_s = spd_hi - spd_lo
    # 倾向：高攻→def 低(玻璃大炮) spd 高(刺客)；低攻→def 高 spd 低(坦克)
    def_mid = (def_lo + def_hi) / 2 - atk_dev * span_d * 0.35 + rng.uniform(-0.6, 0.6)
    spd_mid = (spd_lo + spd_hi) / 2 + atk_dev * span_s * 0.35 + rng.uniform(-0.6, 0.6)
    p['base_def'] = int(max(def_lo, min(def_hi, round(def_mid))))
    p['base_spd'] = int(max(spd_lo, min(spd_hi, round(spd_mid))))
    count += 1

# 分布校验：确认 common < rare < epic < legendary 均值单调
print('=== 分布校验(均值，应单调递增) ===')
order = ['common', 'rare', 'epic', 'legendary']
prev_d = prev_s = -1
ok = True
for r in order:
    defs = [p['base_def'] for p in flat if (p.get('rarity') or 'common') == r]
    spds = [p['base_spd'] for p in flat if (p.get('rarity') or 'common') == r]
    da = statistics.mean(defs) if defs else 0
    sa = statistics.mean(spds) if spds else 0
    mono_d = '✓' if da >= prev_d else '✗失衡'
    mono_s = '✓' if sa >= prev_s else '✗失衡'
    if da < prev_d or sa < prev_s:
        ok = False
    print(f'  {r:10s} def_avg={da:5.1f} {mono_d}  spd_avg={sa:5.1f} {mono_s}  n={len(defs)}')
    prev_d, prev_s = da, sa
print('分布校验:', '通过 ✓' if ok else '需调整 ✗')

with open(SRC, 'w', encoding='utf-8') as f:
    json.dump(db, f, ensure_ascii=False, indent=2)
print(f'已为 {count} 只宠物生成 base_def/base_spd，写回 {SRC}（备份 {BAK}）')
