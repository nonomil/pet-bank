import fs from 'node:fs';
import path from 'node:path';

const levelsDir = path.join(process.cwd(), 'data', 'story-packs', '05-pixel-worlds-story', 'levels');
const expected = {
  'forest-01': ['星港的呼唤', '回应系统', '圆脚印', '萤火溪'],
  'forest-02': ['露珠', '回应也被卡住了', '树屋邮局'],
  'forest-03': ['朋友信件', '蓝光', '蘑菇谷'],
  'forest-04': ['小芽', '回应', '风铃瀑布'],
  'forest-05': ['风铃', '森林的声音', '古树图书馆'],
};

for (const [levelId, fragments] of Object.entries(expected)) {
  const level = JSON.parse(fs.readFileSync(path.join(levelsDir, `${levelId}.json`), 'utf8'));
  const text = level.scenes.flatMap((scene) => scene.lines || [])
    .map((line) => line.text || line.prompt || '')
    .join('\n');
  for (const fragment of fragments) {
    if (!text.includes(fragment)) {
      throw new Error(`${levelId}: missing forest opening arc fragment: ${fragment}`);
    }
  }
}

const forest01 = JSON.parse(fs.readFileSync(path.join(levelsDir, 'forest-01.json'), 'utf8'));
const forest03 = JSON.parse(fs.readFileSync(path.join(levelsDir, 'forest-03.json'), 'utf8'));
const forest05 = JSON.parse(fs.readFileSync(path.join(levelsDir, 'forest-05.json'), 'utf8'));
const text01 = forest01.scenes[0].lines.map((line) => line.text || line.prompt || '').join('\n');
const text03 = forest03.scenes[0].lines.map((line) => line.text || line.prompt || '').join('\n');
const text05 = forest05.scenes[0].lines.map((line) => line.text || line.prompt || '').join('\n');

if (!text01.includes('没有')) throw new Error('forest-01: opening must establish a missing response');
if (!text03.includes('送不出去')) throw new Error('forest-03: post office must have a concrete obstruction');
if (!text05.includes('恢复')) throw new Error('forest-05: first forest arc must reach a restored state');

console.log('PASS pixel story forest opening arc contract: forest-01 to forest-05');
