import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'js', 'minecraft-vocab-levels.js'), 'utf8');
const context = { window: {}, console: { warn() {} } };
vm.runInNewContext(source, context);
const levels = context.window.MinecraftVocabLevels;

assert.ok(levels, 'MinecraftVocabLevels should be exposed');
assert.equal(levels.DEFAULT_LEVEL_ID, 'kindergarten');
assert.equal(JSON.stringify(levels.list().map(item => item.id)), JSON.stringify(['kindergarten', 'bridge', 'lower-grade', 'minecraft', 'all']));
assert.equal(JSON.stringify(levels.minecraftBands().map(item => item.id)), JSON.stringify([
  'minecraft-core', 'minecraft-basic', 'minecraft-building', 'minecraft-mobs', 'minecraft-world', 'minecraft-advanced'
]));

const cards = [
  { id: 'starter', word: 'cat', level: 'starter', difficulty: 1, tags: ['starter'] },
  { id: 'bridge', word: 'wood', level: 'core', difficulty: 1, tags: ['core'] },
  { id: 'lower', word: 'pickaxe', level: 'ket-1', difficulty: 2, tags: [] },
  { id: 'minecraft', word: 'redstone', level: 'anki-official', difficulty: 2, tags: ['anki'] },
  { id: 'advanced', word: 'amethyst', level: 'anki-official', difficulty: 3, tags: ['anki'] }
];

assert.deepEqual(levels.filterCards(cards, 'kindergarten').map(card => card.id), ['starter']);
assert.deepEqual(levels.filterCards(cards, 'bridge').map(card => card.id), ['starter', 'bridge']);
assert.deepEqual(levels.filterCards(cards, 'lower-grade').map(card => card.id), ['starter', 'bridge', 'lower']);
assert.deepEqual(levels.filterCards(cards, 'minecraft').map(card => card.id), ['starter', 'bridge', 'lower', 'minecraft']);
assert.equal(levels.filterCards(cards, 'all').length, cards.length);
assert.equal(levels.filterCards(cards, 'unknown').length, 1, 'unknown selection falls back to the default level');
assert.deepEqual(levels.filterCards([
  { id: 'core', curriculumLevel: 'minecraft', minecraftBand: 'minecraft-core' },
  { id: 'advanced', curriculumLevel: 'minecraft', minecraftBand: 'minecraft-advanced' },
  { id: 'kindergarten', curriculumLevel: 'kindergarten' }
], 'minecraft', 'minecraft-core').map(card => card.id), ['core']);

const moduleDoc = JSON.parse(fs.readFileSync(path.join(root, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json'), 'utf8'));
const defaultCards = levels.filterCards(moduleDoc.cards, levels.DEFAULT_LEVEL_ID);
assert.ok(defaultCards.length >= 80, 'default kindergarten pool should include the mapped kindergarten vocabulary');
assert.ok(defaultCards.every(card => levels.cardLevel(card) === 'kindergarten'), 'default pool must not leak higher-level cards');
assert.deepEqual(defaultCards.filter(card => ['inventory', 'respawn', 'spawn', 'coordinates', 'leggings', 'boots', 'damage', 'health', 'hunger', 'pyramid'].includes(String(card.word).toLowerCase())).map(card => card.word), []);
assert.ok(moduleDoc.cards.every(card => ['kindergarten', 'bridge', 'lower-grade', 'minecraft', 'all'].includes(card.curriculumLevel)), 'every card should declare a curriculum level');
const minecraftCards = moduleDoc.cards.filter(card => card.curriculumLevel === 'minecraft');
assert.equal(minecraftCards.length, 2039, 'Minecraft starter pool should contain the 2039 cards');
assert.ok(minecraftCards.every(card => levels.minecraftBands().some(band => band.id === card.minecraftBand)), 'every Minecraft starter card should declare an internal band');
const minecraftCardByWord = new Map(minecraftCards.map(card => [card.word, card]));
const commonMechanicWords = ['Inventory', 'Respawn', 'Trade', 'Tame', 'Chunk', 'Enchanting', 'Brewing'];
assert.ok(minecraftCards.filter(card => card.minecraftBand === 'minecraft-core').length >= 100, 'the common core band should contain at least 100 cards');
assert.ok(commonMechanicWords.every(word => minecraftCardByWord.get(word)?.minecraftBand !== 'minecraft-advanced'), 'common gameplay words must not be placed in the advanced band');
assert.deepEqual(moduleDoc.curriculumLeveling.minecraftBandCounts, {
  'minecraft-core': 123,
  'minecraft-basic': 312,
  'minecraft-building': 610,
  'minecraft-mobs': 131,
  'minecraft-world': 269,
  'minecraft-advanced': 594
});
assert.deepEqual(minecraftCards.filter(card => ['Status Effect', 'Coordinates', 'Spectator Mode', 'Hardcore Mode', 'Adventure Mode'].includes(card.word)).map(card => card.minecraftBand), [
  'minecraft-advanced', 'minecraft-advanced', 'minecraft-advanced', 'minecraft-advanced', 'minecraft-advanced'
]);

const pageSource = fs.readFileSync(path.join(root, 'js', 'minecraft-vocab-page.js'), 'utf8');
assert.match(pageSource, /data-mv-level/);
assert.match(pageSource, /petbank_minecraft_vocab_level_v1/);
assert.match(pageSource, /data-mv-band/);
assert.match(pageSource, /petbank_minecraft_vocab_band_v1/);
console.log(`minecraft vocab levels: PASS (${defaultCards.length} kindergarten cards)`);
