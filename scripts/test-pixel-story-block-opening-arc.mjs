import fs from 'node:fs';
import path from 'node:path';

const levelsDir = path.join(process.cwd(), 'data', 'story-packs', '05-pixel-worlds-story', 'levels');
const expected = {
  'block-01': ['绿色光', '星门', '路牌', '矿洞火把路'],
  'block-02': ['火把', '安全', '地下水渠'],
  'block-03': ['水渠', '星门', '红石工坊'],
  'block-04': ['红石机关', '能源', '遗迹图书馆'],
  'block-05': ['旧地图', '钥匙顺序', '地下城星门'],
};

for (const [levelId, fragments] of Object.entries(expected)) {
  const level = JSON.parse(fs.readFileSync(path.join(levelsDir, `${levelId}.json`), 'utf8'));
  const text = level.scenes.flatMap((scene) => scene.lines || [])
    .map((line) => line.text || line.prompt || '')
    .join('\n');
  for (const fragment of fragments) {
    if (!text.includes(fragment)) {
      throw new Error(`${levelId}: missing block opening arc fragment: ${fragment}`);
    }
  }
}

const block01 = JSON.parse(fs.readFileSync(path.join(levelsDir, 'block-01.json'), 'utf8'));
const block03 = JSON.parse(fs.readFileSync(path.join(levelsDir, 'block-03.json'), 'utf8'));
const block05 = JSON.parse(fs.readFileSync(path.join(levelsDir, 'block-05.json'), 'utf8'));
const text01 = block01.scenes[0].lines.map((line) => line.text || line.prompt || '').join('\n');
const text03 = block03.scenes[0].lines.map((line) => line.text || line.prompt || '').join('\n');
const text05 = block05.scenes[0].lines.map((line) => line.text || line.prompt || '').join('\n');

if (!text01.includes('缺少')) throw new Error('block-01: opening must establish a missing gate condition');
if (!text03.includes('供水')) throw new Error('block-03: waterway must provide a concrete gate condition');
if (!text05.includes('第一幕')) throw new Error('block-05: opening arc must reach a clear first-act conclusion');

console.log('PASS pixel story block opening arc contract: block-01 to block-05');
