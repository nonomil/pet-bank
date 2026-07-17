import fs from 'node:fs';
import path from 'node:path';

const levelsDir = path.join(process.cwd(), 'data', 'story-packs', '05-pixel-worlds-story', 'levels');
const expected = {
  'block-06': ['第一幕', '回家门', '安全路线', '木门小路'],
  'block-07': ['回家门', '木门通道', '路标', '方块农场'],
  'block-08': ['麦穗', '伙伴', '物资', '石砖广场'],
  'block-09': ['星星图案', '路标', '地图', '水晶矿井'],
  'block-10': ['蓝色水晶', '能源', '轨道车站', '下一段远行'],
};

for (const [levelId, fragments] of Object.entries(expected)) {
  const level = JSON.parse(fs.readFileSync(path.join(levelsDir, `${levelId}.json`), 'utf8'));
  const text = level.scenes.flatMap((scene) => scene.lines || [])
    .map((line) => line.text || line.prompt || '')
    .join('\n');
  for (const fragment of fragments) {
    if (!text.includes(fragment)) {
      throw new Error(`${levelId}: missing block return-prep arc fragment: ${fragment}`);
    }
  }
}

const block06 = JSON.parse(fs.readFileSync(path.join(levelsDir, 'block-06.json'), 'utf8'));
const block08 = JSON.parse(fs.readFileSync(path.join(levelsDir, 'block-08.json'), 'utf8'));
const block10 = JSON.parse(fs.readFileSync(path.join(levelsDir, 'block-10.json'), 'utf8'));
const text06 = block06.scenes[0].lines.map((line) => line.text || line.prompt || '').join('\n');
const text08 = block08.scenes[0].lines.map((line) => line.text || line.prompt || '').join('\n');
const text10 = block10.scenes[0].lines.map((line) => line.text || line.prompt || '').join('\n');

if (!text06.includes('入口')) throw new Error('block-06: opening must retain the awakened gate transition');
if (!text08.includes('照顾')) throw new Error('block-08: farm resource must change the companion state');
if (!text10.includes('供能')) throw new Error('block-10: crystal must provide a concrete rail-station condition');

console.log('PASS pixel story block return-prep arc contract: block-06 to block-10');
