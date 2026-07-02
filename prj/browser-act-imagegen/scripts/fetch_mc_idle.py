import urllib.request, os, time
from PIL import Image
from io import BytesIO

mobs = {
    'creeper':'Creeper', 'wither':'Wither', 'ender_dragon':'Ender_Dragon',
    'warden':'Warden', 'zombie':'Zombie', 'skeleton':'Skeleton',
    'spider':'Spider', 'blaze':'Blaze', 'ghast':'Ghast',
    'phantom':'Phantom', 'iron_golem':'Iron_Golem',
}
base_headers = {
    'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept':'image/avif,image/webp,image/png,image/*;q=0.8',
    'Accept-Language':'en-US,en;q=0.9',
    'Sec-Fetch-Dest':'image',
    'Sec-Fetch-Mode':'no-cors',
    'Sec-Fetch-Site':'same-site',
}
proj = r'g:\StudyCode\宠物积分系统\assets\pets\poses'
os.makedirs(proj, exist_ok=True)
TARGET = 1024
ok, fail = [], []
for pet, wiki in mobs.items():
    url = f'https://minecraft.fandom.com/wiki/Special:FilePath/{wiki}.png?format=original'
    h = dict(base_headers)
    h['Referer'] = f'https://minecraft.fandom.com/wiki/{wiki}'   # 关键：具体页面 Referer
    try:
        req = urllib.request.Request(url, headers=h)
        data = urllib.request.urlopen(req, timeout=30).read()
        im = Image.open(BytesIO(data)).convert('RGBA')
        w, h2 = im.size
        ratio = TARGET / max(w, h2)
        if abs(ratio - 1.0) > 1e-3:
            im = im.resize((max(1, int(w*ratio)), max(1, int(h2*ratio))), Image.LANCZOS)
        canvas = Image.new('RGBA', (TARGET, TARGET), (0, 0, 0, 0))
        canvas.paste(im, ((TARGET-im.width)//2, (TARGET-im.height)//2), im)
        out = os.path.join(proj, f'mc_{pet}_idle.webp')
        canvas.save(out, 'WEBP', quality=92)
        ok.append(f'{pet}({w}x{h2},{os.path.getsize(out)}B)')
    except Exception as e:
        fail.append(f'{pet}:{e}')
    time.sleep(1.5)   # 防限流

print('OK:', ' | '.join(ok))
if fail:
    print('FAIL:', ' | '.join(fail))
print(f'== {len(ok)}/11 ==')
