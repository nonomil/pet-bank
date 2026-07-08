import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vocabPath = path.join(
  repoRoot,
  'data',
  'learn',
  'packs',
  'english-mc-hybrid-2026',
  'modules',
  'minecraft-vocab.json'
);

const STARTER_IDS = [
  'mc-word-block',
  'mc-word-world',
  'mc-word-hello',
  'mc-word-look',
  'mc-word-stone',
  'mc-word-light',
  'mc-word-run',
  'mc-word-door',
  'mc-word-friend',
  'mc-word-cat',
  'mc-word-bag',
  'mc-word-sun',
  'mc-word-tree',
  'mc-word-red',
  'mc-word-play',
  'mc-word-sword',
  'mc-word-pickaxe',
  'mc-word-diamond',
  'mc-word-creeper',
  'mc-word-craft',
  'mc-word-water',
  'mc-word-fire',
  'mc-word-house',
  'mc-word-apple'
];

const vocab = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));

assert.equal(vocab.id, 'minecraft-vocab');
assert.equal(vocab.type, 'vocab');
assert.equal(vocab.sourceProvider, 'mixed', 'formal vocab should expose mixed sources after expansion');
assert.deepEqual(
  vocab.sourceProviders,
  ['mayihaoke', 'minecraft_words_apk-main'],
  'formal vocab should record both starter and external providers'
);
assert.ok(Array.isArray(vocab.cards), 'formal vocab should expose cards array');
assert.ok(vocab.cards.length >= 80 && vocab.cards.length <= 120, `formal vocab should expand to 80-120 cards, got ${vocab.cards.length}`);

const cardIds = new Set(vocab.cards.map(card => card.id));
for (const id of STARTER_IDS) {
  assert.ok(cardIds.has(id), `starter card should be preserved: ${id}`);
}

const words = vocab.cards.map(card => card.word);
assert.equal(new Set(words).size, words.length, 'expanded formal vocab should dedupe words globally');
assert.ok(words.every(word => /^[a-z]{3,8}$/.test(word)), 'all formal vocab words should be short lowercase English words');

const coreCards = vocab.cards.filter(card => card.level === 'core');
assert.ok(coreCards.length >= 40, `formal vocab should add at least 40 core cards, got ${coreCards.length}`);

for (const card of vocab.cards) {
  assert.ok(card.translation, `${card.id} should include translation`);
  assert.ok(card.example, `${card.id} should include example`);
  assert.ok(card.exampleZh, `${card.id} should include Chinese example`);
  assert.ok(Array.isArray(card.distractors) && card.distractors.length >= 3, `${card.id} should include 3 distractors`);
}

for (const card of coreCards) {
  assert.equal(card.sourceProvider, 'minecraft_words_apk-main', `${card.id} core card should come from external Minecraft repo`);
  assert.ok(card.sourceFile, `${card.id} core card should keep sourceFile`);
  assert.ok(card.category, `${card.id} core card should keep category`);
  assert.ok(typeof card.image === 'string' && card.image.length > 0, `${card.id} core card should include image`);
}

console.log('PASS - minecraft core vocab expansion contract');
