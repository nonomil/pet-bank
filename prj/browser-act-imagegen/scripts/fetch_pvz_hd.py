import urllib.request, os, time
from PIL import Image
from io import BytesIO

small = ['Melon-pult','Cherry_Bomb','Conehead_Zombie','Pole_Vaulting_Zombie',
         'Dr._Zomboss','Magnet-shroom','Hypno-shroom','Chomper',
         'Repeater','Zombie','Flag_Zombie','Football_Zombie','Sun-shroom']
variants = ['_HD','_PvZ2','2','_in-game','_Card','_HD2','_PvZ2_HD','3','_GW2','_PvZ3','_PvZ1','_new']
base = {'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':'image/avif,image/webp,image/png,image/*;q=0.8',
        'Sec-Fetch-Dest':'image','Sec-Fetch-Mode':'no-cors','Sec-Fetch-Site':'same-site'}
proj = r'g:\StudyCode\宠物积分系统\assets\pets\poses'
TARGET = 1024
upgraded, kept = [], []
for role in small:
    pet = 'pvz_' + role.lower().replace('-','').replace('_','').replace('.','').replace(' ','')
    best = None; best_dim = 0
    for suf in variants:
        for cand in [role+suf, role.replace('_',' ')+suf]:
            h = dict(base); h['Referer'] = f'https://plantsvszombies.fandom.com/wiki/{role}'
            try:
                req = urllib.request.Request(f'https://plantsvszombies.fandom.com/wiki/Special:FilePath/{cand}.png?format=original', headers=h)
                data = urllib.request.urlopen(req, timeout=15).read()
                im = Image.open(BytesIO(data))
                dim = max(im.size)
                if dim > best_dim:
                    best = data; best_dim = dim
                if dim > 500:
                    break
            except Exception:
                pass
        if best_dim > 500:
            break
    if best is not None and best_dim > 300:
        im = Image.open(BytesIO(best)).convert('RGBA')
        w, hh = im.size
        ratio = TARGET / max(w, hh)
        if abs(ratio-1) > 1e-3:
            im = im.resize((max(1,int(w*ratio)), max(1,int(hh*ratio))), Image.LANCZOS)
        c = Image.new('RGBA', (TARGET, TARGET), (0,0,0,0))
        c.paste(im, ((TARGET-im.width)//2, (TARGET-im.height)//2), im)
        out = os.path.join(proj, f'{pet}_idle.webp')
        c.save(out, 'WEBP', quality=92)
        upgraded.append(f'{role}: {best_dim}px')
    else:
        kept.append(f'{role}(best={best_dim}px)')
    time.sleep(1.5)
print('UPGRADED', len(upgraded))
for u in upgraded: print(' ', u)
print('KEPT_SMALL', len(kept), kept)
