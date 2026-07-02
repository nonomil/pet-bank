import os, glob, tempfile
from PIL import Image, ImageChops

WORK = tempfile.gettempdir()
PROJ = r'g:\StudyCode\宠物积分系统\assets\pets\poses'
TARGET = 1024
done = []
for f in glob.glob(os.path.join(WORK, 'mc_*_*.webp')):
    base = os.path.basename(f)[:-5]  # mc_pet_action.webp -> mc_pet_action
    try:
        im = Image.open(f).convert('RGBA')
        w, h = im.size
        r, g, b, a = im.split()
        white = Image.new('RGB', im.size, (255, 255, 255))
        diff = ImageChops.difference(Image.merge('RGB', (r, g, b)), white)
        mask = diff.convert('L').point(lambda x: 0 if x < 22 else 255)
        im.putalpha(mask)
        ratio = TARGET / max(w, h)
        if abs(ratio - 1) > 1e-3:
            im = im.resize((max(1, int(w*ratio)), max(1, int(h*ratio))), Image.LANCZOS)
        c = Image.new('RGBA', (TARGET, TARGET), (0, 0, 0, 0))
        c.paste(im, ((TARGET-im.width)//2, (TARGET-im.height)//2), im)
        out = os.path.join(PROJ, f'{base}.webp')
        c.save(out, 'WEBP', quality=92)
        done.append(f'{base}({os.path.getsize(out)}B)')
    except Exception as e:
        print(f'ERR {base}: {e}')
print('KEYOUT', len(done))
for d in done:
    print(' ', d)
