import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const levelsDir = path.join(root, 'data/story-packs/05-pixel-worlds-story/levels');
const expectedWorlds = {
  'sci-fi': { prefix: 'sf-', final: ['森林', '航线'] },
  forest: { prefix: 'forest-', final: ['方块', '入口'] },
  block: { prefix: 'block-', final: ['三界', '回家'] },
  detective: { prefix: 'detective-', final: ['光核', '回家'] }
};
const forbiddenFragments = [
  '。，',
  '新的线索正在等着被发现',
  '做完这一小步，回家的星图又亮了一格'
];

function fail(message) {
  throw new Error(message);
}

const files = fs.readdirSync(levelsDir).filter((file) => file.endsWith('.json'));
const worlds = new Map();

for (const file of files) {
  const level = JSON.parse(fs.readFileSync(path.join(levelsDir, file), 'utf8'));
  const lines = level.scenes?.flatMap((scene) => scene.lines || []) || [];
  if (!worlds.has(level.worldId)) worlds.set(level.worldId, []);
  worlds.get(level.worldId).push({ file, level, lines });
}

for (const [worldId, rule] of Object.entries(expectedWorlds)) {
  const levels = worlds.get(worldId) || [];
  if (levels.length !== 20) fail(`${worldId}: expected 20 levels, got ${levels.length}`);

  const repeated = new Map();
  for (const { file, level, lines } of levels.sort((a, b) => a.level.levelId.localeCompare(b.level.levelId))) {
    if (lines.length < 11) fail(`${file}: expected at least 11 story lines, got ${lines.length}`);
    if (!lines.some((line) => line.type === 'activity')) fail(`${file}: missing activity`);
    for (const line of lines) {
      const text = line.text || line.prompt || '';
      for (const fragment of forbiddenFragments) {
        if (text.includes(fragment)) fail(`${file}: forbidden template fragment: ${fragment}`);
      }
      if (line.type === 'dialogue') repeated.set(text, (repeated.get(text) || 0) + 1);
    }
  }

  const overused = [...repeated.entries()].filter(([, count]) => count > 4);
  if (overused.length) fail(`${worldId}: repeated dialogue over limit: ${overused.map(([text, count]) => `${count}x ${text}`).join(' | ')}`);

  const finalLevel = levels.find(({ level }) => level.levelId === `${rule.prefix}20`);
  const finalText = finalLevel.lines.map((line) => line.text || line.prompt || '').join('\n');
  for (const keyword of rule.final) {
    if (!finalText.includes(keyword)) fail(`${finalLevel.file}: final chapter missing keyword ${keyword}`);
  }
}

console.log('PASS pixel story content contract: 4 tracks / 80 levels / no template residue');
