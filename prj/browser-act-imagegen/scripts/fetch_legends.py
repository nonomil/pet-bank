import urllib.request, os, time
from PIL import Image
from io import BytesIO

mobs = {'herobrine':'Herobrine', 'entity_303':'Entity_303'}
base = {
    'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept':'image/avif,image/webp,image/png,image/*;q=0.8',
    'Sec-Fetch-Dest':'image','Sec-Fetch-Mode':'no-cors','Sec-Fetch-Site':'same-site',
}
proj = r'g:\StudyCode\宠物积分系统\assets\pets\poses'
for pet, wiki in mobs.items():
    url = f'https://minecraft.fandom.com/wiki/Special:FilePath/{wiki}.png?format=original'
    h = dict(base)
    h['Referer'] = f'https://minecraft.fandom.com/wiki/{wiki}'
    try:
        req = urllib.request.Request(url, headers=h)
        data = urllib.request.urlopen(req, timeout=30).read()
        im = Image.open(BytesIO(data)).convert('RGBA')
        w, hh = im.size
        ratio = 1024/max(w, hh)
        if abs(ratio-1) > 1e-3:
            im = im.resize((max(1,int(w*ratio)), max(1,int(hh*ratio))), Image.LANCZOS)
        c = Image.new('RGBA',(1024,1024),(0,0,0,0))
        c.paste(im,((1024-im.width)//2,(1024-im.height)//2), im)
        out = os.path.join(proj, f'mc_{pet}_idle.webp')
        c.save(out,'WEBP',quality=92)
        print(f'OK {pet} {w}x{hh} {os.path.getsize(out)}B')
    except Exception as e:
        print(f'ERR {pet}: {e}')
    time.sleep(1.5)
