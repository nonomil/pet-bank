from PIL import Image, ImageChops
import os
proj = r'g:\StudyCode\宠物积分系统\assets\pets\poses'
p = os.path.join(proj, 'mc_entity_303_idle.webp')
im = Image.open(p).convert('RGBA')
r, g, b, a = im.split()
white = Image.new('RGB', im.size, (255, 255, 255))
diff = ImageChops.difference(Image.merge('RGB', (r, g, b)), white)
# 纯白/近白(diff<22) -> 透明(0)，非白 -> 不透明(255)
mask = diff.convert('L').point(lambda x: 0 if x < 22 else 255)
im.putalpha(mask)
im.save(p, 'WEBP', quality=92)
# 统计透明比例
hist = mask.histogram()
trans = hist[0]  # 0 像素数 = 透明
total = mask.width * mask.height
print(f'entity_303 keyed: {trans}/{total} ({trans*100//total}%) -> transparent, file {os.path.getsize(p)}B')
