# -*- coding: utf-8 -*-
"""卡牌合成脚本：背景模板(GPT生) + 宠物立绘 + 名称/系列 + 数值(HP/ATK/DEF/SPD)
用法: python .tmp/compose-card.py [数量, 默认5]
- GPT 生图 assets/cards/frame-{rarity}.png 未就绪时，用占位背景降级（可立即测试）
- 产出 assets/cards/composed/{pet_id}.png"""
import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
from PIL import Image, ImageDraw, ImageFont

CARDS_DIR = 'assets/cards'
OUT_DIR = 'assets/cards/composed'
W, H = 480, 640
N = int(sys.argv[1]) if len(sys.argv) > 1 else 5

def font(sz):
    for fp in ['C:/Windows/Fonts/msyhbd.ttc', 'C:/Windows/Fonts/msyh.ttc', 'C:/Windows/Fonts/simhei.ttf']:
        if os.path.exists(fp):
            try: return ImageFont.truetype(fp, sz)
            except: pass
    return ImageFont.load_default()

STATS = {
    'hp':  {'pos': (55, 130),  'color': (192, 57, 43)},
    'spd': {'pos': (425, 130), 'color': (39, 174, 96)},
    'def': {'pos': (55, 470),  'color': (44, 123, 229)},
    'atk': {'pos': (425, 470), 'color': (211, 84, 0)},
}
BORDER = {'common': (157,157,157), 'rare': (0,112,221), 'epic': (163,53,238), 'legendary': (255,128,0)}

def get_frame(rarity):
    """背景模板：GPT 生图优先，无则占位降级"""
    fp = os.path.join(CARDS_DIR, f'frame-{rarity}.png')
    if os.path.exists(fp):
        return Image.open(fp).convert('RGBA').resize((W, H))
    img = Image.new('RGBA', (W, H), (20, 15, 35, 255))
    d = ImageDraw.Draw(img)
    c = BORDER.get(rarity, (157, 157, 157))
    d.rectangle([0, 0, W, H], outline=c, width=8)
    d.rectangle([14, 14, W - 14, H - 14], outline=c, width=3)
    for s in STATS.values():
        x, y = s['pos']
        d.ellipse([x - 38, y - 38, x + 38, y + 38], outline=(255, 255, 255, 90), width=2)
    return img

def get_portrait(pet):
    stages = pet.get('imageStages') or {}
    img = stages.get('2') or pet.get('imageUrl')
    if img and os.path.exists(img):
        return Image.open(img).convert('RGBA')
    return None

def draw_stat(img, pos, color, value):
    d = ImageDraw.Draw(img)
    x, y = pos
    d.ellipse([x - 38, y - 38, x + 38, y + 38], fill=color + (255,), outline=(0, 0, 0, 200), width=3)
    f = font(30)
    text = str(value)
    try:
        d.text((x, y), text, font=f, fill='white', stroke_width=2, stroke_fill='black', anchor='mm')
    except:
        tb = d.textbbox((0, 0), text, font=f)
        d.text((x - (tb[2]-tb[0])/2, y - (tb[3]-tb[1])/2 - 2), text, font=f, fill='white', stroke_width=2, stroke_fill='black')

def compose(pet):
    rarity = pet.get('rarity') or 'common'
    frame = get_frame(rarity)
    portrait = get_portrait(pet)
    if portrait:
        portrait.thumbnail((320, 320), Image.LANCZOS)
        px = 80 + (320 - portrait.width) // 2
        py = 110 + (320 - portrait.height) // 2
        frame.alpha_composite(portrait, (px, py))
    else:
        d = ImageDraw.Draw(frame)
        d.text((240, 270), pet.get('emoji', '🐾'), font=font(110), fill='white', anchor='mm')
    d = ImageDraw.Draw(frame)
    # 名称栏
    d.text((240, 582), pet.get('name', '???'), font=font(32), fill='white', stroke_width=2, stroke_fill='black', anchor='mm')
    # 系列标签
    series = pet.get('series') or ''
    if series:
        sb = d.textbbox((0, 0), series, font=font(18))
        sw = sb[2] - sb[0]
        d.rounded_rectangle([15, 15, 15 + sw + 18, 46], radius=12, fill=(0, 0, 0, 150))
        d.text((24, 19), series, font=font(18), fill=(232, 224, 255, 255))
    # 四角数值
    draw_stat(frame, STATS['hp']['pos'],  STATS['hp']['color'],  pet.get('base_hp', '?'))
    draw_stat(frame, STATS['spd']['pos'], STATS['spd']['color'], pet.get('base_spd', '?'))
    draw_stat(frame, STATS['def']['pos'], STATS['def']['color'], pet.get('base_def', '?'))
    draw_stat(frame, STATS['atk']['pos'], STATS['atk']['color'], pet.get('base_atk', '?'))
    return frame

os.makedirs(OUT_DIR, exist_ok=True)
db = json.load(open('data/pets.json', encoding='utf-8'))
flat = db.get('flat') or []
# 优先测有图 + 不同稀有度 + classpet 兜底
samples = []
for rid in ['dog', 'cat', 'mc_wolf', 'cp_cat_01']:
    s = next((p for p in flat if p['id'] == rid), None)
    if s: samples.append(s)
samples += [p for p in flat if p not in samples][:max(0, N - len(samples))]
for p in samples[:N]:
    try:
        img = compose(p)
        out = os.path.join(OUT_DIR, f"{p['id']}.webp")
        img.save(out, format='WEBP', quality=90)
        print(f'✓ {p["id"]:16s} {p.get("name",""):8s} rarity={p.get("rarity"):10s} hp={p.get("base_hp")} atk={p.get("base_atk")} def={p.get("base_def")} spd={p.get("base_spd")} → {out}')
    except Exception as e:
        print(f'✗ {p["id"]} 失败: {e}')
print(f'合成完成 {min(N, len(samples))} 张（背景: {"GPT图" if os.path.exists(os.path.join(CARDS_DIR, "frame-common.png")) else "占位降级"}）')
