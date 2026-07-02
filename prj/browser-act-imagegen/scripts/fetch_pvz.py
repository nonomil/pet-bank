import urllib.request, os, time
from PIL import Image
from io import BytesIO

plants = ['Peashooter','Repeater','Threepeater','Snow_Pea','Torchwood','Kernel-pult','Melon-pult','Cabbage-pult',
          'Wall-nut','Tall-nut','Pumpkin','Spikeweed','Spikerock',
          'Sunflower','Twin_Sunflower','Squash','Cherry_Bomb','Potato_Mine','Magnet-shroom','Hypno-shroom','Ice-shroom',
          'Jalapeno','Chomper','Sun-shroom']
zombies = ['Zombie','Conehead_Zombie','Buckethead_Zombie','Flag_Zombie',
           'Pole_Vaulting_Zombie','Dancing_Zombie','Backup_Dancer','Football_Zombie','Gargantuar','Imp',
           'Balloon_Zombie','Dolphin_Rider_Zombie','Screen_Door_Zombie','Digger_Zombie']
bosses = ['Dr._Zomboss','Giga_Gargantuar']
roles = plants + zombies + bosses

base = {'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept':'image/avif,image/webp,image/png,image/*;q=0.8',
        'Sec-Fetch-Dest':'image','Sec-Fetch-Mode':'no-cors','Sec-Fetch-Site':'same-site'}
proj = r'g:\StudyCode\宠物积分系统\assets\pets\poses'
TARGET = 1024
ok, fail = [], []
for role in roles:
    pet = 'pvz_' + role.lower().replace('-','').replace('_','').replace('.','').replace(' ','')
    data = None
    for cand in [f'{role}_HD', role, role.replace('-','').replace('_','')]:
        h = dict(base); h['Referer'] = f'https://plantsvszombies.fandom.com/wiki/{role}'
        try:
            req = urllib.request.Request(f'https://plantsvszombies.fandom.com/wiki/Special:FilePath/{cand}.png?format=original', headers=h)
            data = urllib.request.urlopen(req, timeout=20).read()
            break
        except Exception:
            pass
    if data is None:
        fail.append(role); time.sleep(1); continue
    try:
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
    except Exception as e:
        fail.append(f'{role}(process:{e})')
    time.sleep(1.5)

print('OK', len(ok))
for o in ok: print(' ', o)
print('FAIL', len(fail), fail)
