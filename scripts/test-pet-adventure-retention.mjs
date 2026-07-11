import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadGlobal(file, name) {
  const source = fs.readFileSync(file, 'utf8');
  const context = { console, globalThis: null, window: null };
  context.globalThis = context;
  context.window = context;
  vm.runInNewContext(source, context, { filename: file });
  assert.ok(context[name], `${name} should be exposed by ${file}`);
  return context[name];
}

const preview = loadGlobal('js/pet-evolution-preview.js', 'PetEvolutionPreview');
const stages = [
  { min_level: 1, name: '蛋', stageIdx: 0 },
  { min_level: 3, name: '幼崽', stageIdx: 1 },
  { min_level: 5, name: '成长期', stageIdx: 2 },
  { min_level: 8, name: '完全体', stageIdx: 3 }
];
const species = {
  id: 'demo',
  name: '示例宠物',
  emoji: '🐾',
  imageStages: {
    '0': 'stage-0.webp',
    '1': 'stage-1.webp',
    '2': 'stage-2.webp',
    '3': 'stage-3.webp'
  }
};

const levelTwo = preview.get({ level: 2, species: 'demo' }, { stages, species, maxLevel: 8 });
assert.equal(levelTwo.current.name, '蛋');
assert.equal(levelTwo.next.name, '幼崽');
assert.equal(levelTwo.remainingLevels, 1);
assert.equal(levelTwo.current.image, 'stage-0.webp');
assert.equal(levelTwo.next.image, 'stage-1.webp');

const maxLevel = preview.get({ level: 8, species: 'demo' }, { stages, species, maxLevel: 8 });
assert.equal(maxLevel.isMax, true);
assert.equal(maxLevel.next, null);
assert.equal(maxLevel.remainingLevels, 0);

const copy = loadGlobal('js/exploration-copy.js', 'ExplorationCopy');
const shortEvent = copy.get({ text: '长文本', shortText: '看见一只小鸟！', detailText: '长文本详情', petMood: 'surprised' });
assert.equal(shortEvent.text, '看见一只小鸟！');
assert.equal(shortEvent.detailText, '长文本详情');
assert.equal(shortEvent.mood, 'surprised');
assert.equal(shortEvent.isShort, true);

const legacyEvent = copy.get({ text: '旧故事文本' });
assert.equal(legacyEvent.text, '旧故事文本');
assert.equal(legacyEvent.detailText, '');
assert.equal(legacyEvent.mood, 'happy');
assert.equal(legacyEvent.isShort, false);

const runtime = fs.readFileSync('js/runtime-loader.js', 'utf8');
assert.match(runtime, /home:\s*\[[\s\S]*pet-evolution-preview\.js/);
assert.match(runtime, /explore:\s*\[[\s\S]*exploration-copy\.js/);

for (const sceneId of ['forest', 'beach', 'stargarden']) {
  const story = JSON.parse(fs.readFileSync(`data/stories/${sceneId}.json`, 'utf8'));
  assert.equal(story.events.length, 5);
  for (const event of story.events) {
    assert.ok(typeof event.shortText === 'string' && event.shortText.length > 0, `${sceneId}:${event.id} shortText`);
    assert.ok(event.shortText.length <= 24, `${sceneId}:${event.id} shortText should stay compact`);
    assert.ok(['happy', 'surprised', 'worried', 'proud'].includes(event.petMood), `${sceneId}:${event.id} petMood`);
  }
}

console.log('pet adventure retention contract tests passed');
