import urllib.request, os, time
from PIL import Image
from io import BytesIO

# 9 个 FAIL 角色针对性文件名变体
fails = {
    'Melon-pult': ['Melon-pult_HD','Melon-pult2','Melon-pult3','Melon-pult'],
    'Wall-nut': ['Wallnut_HD','Wall-nut_HD','Wallnut','Wall-nut2','Wall-nut3','Wall-nut'],
    'Cherry_Bomb': ['Cherry_Bomb_HD','Cherry_Bomb2','Cherry_Bomb','Cherry bomb'],
    'Conehead_Zombie': ['Conehead_Zombie_HD','Conehead-head_Zombie','Conehead Zombie','Conehead_Zombie2','Conehead_Zombie'],
    'Pole_Vaulting_Zombie': ['Pole_Vaulting_Zombie_HD','Pole_Vaulting_Zombie2','Pole Vaulting Zombie','Pole_Vaulting_Zombie'],
    'Dancing_Zombie': ['Dancing_Zombie_HD','Disco_Zombie','Dancing Zombie','Dancing_Zombie'],
    'Dolphin_Rider_Zombie': ['Dolphin_Rider_Zombie_HD','Dolphin Rider Zombie','Dolphin_Rider','Dolphin_Rider_Zombie'],
    'Digger_Zombie': ['Digger_Zombie_HD','Digger Zombie','Digger_Zombie'],
    'Dr._Zomboss': ['Dr._Zomboss_HD','Dr._Zomboss','Zomboss','Doctor_Zomboss','Dr Zomboss'],
}
base = {'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':'image/avif,image/webp,image/png,image/*;q=0.8',
        'Sec-Fetch-Dest':'image','Sec-Fetch-Mode':'no-cors','Sec-Fetch-Site':'same-site'}
proj = r'g:\StudyCode\宠物积分系统\assets\pets\poses'
TARGET = 1024
ok, fail2 = [], []
for role, names in fails.items():
    pet = 'pvz_' + role.lower().replace('-','').replace('_','').replace('.','').replace(' ','')
    data = None
    for cand in names:
        h = dict(base); h['Referer'] = f'https://plantsvszombies.fandom.com/wiki/{role}'
        try:
            req = urllib.request.Request(f'https://plantsvszombies.fandom.com/wiki/Special:FilePath/{cand}.png?format=original', headers=h)
            data = urllib.request.urlopen(req, timeout=20).read()
            break
        except Exception:
            pass
    if data is None:
        fail2.append(role); time.sleep(1); continue
    im = Image.open(BytesIO(data)).convert('RGBA')
    w, hh = im.size
    ratio = TARGET / max(w, hh)
    if abs(ratio-1) > 1e-3:
        im = im.resize((max(1,int(w*ratio)), max(1,int(hh*ratio))), Image.LANCZOS)
    c = Image.new('RGBA', (TARGET, TARGET), (0,0,0,0))
    c.paste(im, ((TARGET-im.width)//2, (TARGET-im.height)//2), im)
    out = os.path.join(proj, f'{pet}_idle.webp')
    c.save(out, 'WEBP', quality=92)
    ok.append(f'{role}->{pet}({w}x{hh})')
    time.sleep(1.5)
print('OK', ok)
print('STILL_FAIL', fail2)
