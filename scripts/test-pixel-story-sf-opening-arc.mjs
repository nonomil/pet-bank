import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const levelsDir = path.join(root, 'data', 'story-packs', '05-pixel-worlds-story', 'levels');
const expected = {
  'sf-01': ['第一道蓝线断了', '被风暴吹断的', '月环补给站'],
  'sf-02': ['光核碎片', '蓝光', '云朵信号带'],
  'sf-03': ['三条航线', '安全航线', '星尘维修区'],
  'sf-04': ['推进器', '光核', '漂浮温室'],
  'sf-05': ['星芽', '森林世界听见了', '轨道电梯'],
};

for (const [levelId, fragments] of Object.entries(expected)) {
  const file = path.join(levelsDir, `${levelId}.json`);
  const level = JSON.parse(fs.readFileSync(file, 'utf8'));
  const text = level.scenes.flatMap((scene) => scene.lines || [])
    .map((line) => line.text || line.prompt || '')
    .join('\n');
  for (const fragment of fragments) {
    if (!text.includes(fragment)) {
      throw new Error(`${levelId}: missing opening arc fragment: ${fragment}`);
    }
  }
}

const sf01 = JSON.parse(fs.readFileSync(path.join(levelsDir, 'sf-01.json'), 'utf8'));
const sf03 = JSON.parse(fs.readFileSync(path.join(levelsDir, 'sf-03.json'), 'utf8'));
const sf05 = JSON.parse(fs.readFileSync(path.join(levelsDir, 'sf-05.json'), 'utf8'));
const sf01Text = sf01.scenes[0].lines.map((line) => line.text || line.prompt || '').join('\n');
const sf03Text = sf03.scenes[0].lines.map((line) => line.text || line.prompt || '').join('\n');
const sf05Text = sf05.scenes[0].lines.map((line) => line.text || line.prompt || '').join('\n');

if (!sf01Text.includes('风暴')) throw new Error('sf-01: opening incident must identify the storm as a cause');
if (!sf03Text.includes('断')) throw new Error('sf-03: route discovery must preserve the broken-route problem');
if (!sf05Text.includes('森林')) throw new Error('sf-05: star-bud response must connect to the next world');

console.log('PASS pixel story sci-fi opening arc contract: sf-01 to sf-05');
