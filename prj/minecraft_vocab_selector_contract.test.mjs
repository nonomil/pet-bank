import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const selector = require(path.join(repoRoot, 'scripts', 'minecraft_vocab_selector.cjs'));

assert.equal(typeof selector.normalizeMinecraftWord, 'function', 'selector should export normalizeMinecraftWord');
assert.equal(typeof selector.selectCuratedMinecraftCards, 'function', 'selector should export selectCuratedMinecraftCards');

const fixtureRows = [
  {
    word: 'Cow',
    chinese: '牛',
    category: 'animal',
    difficulty: 'basic',
    sourceFile: 'minecraft/minecraft_basic.js',
    imageURLs: [{ url: 'https://minecraft.wiki/w/File:Cow.png', filename: 'Cow.png', type: 'Default' }]
  },
  {
    word: 'Cow',
    chinese: '奶牛',
    category: 'animal',
    difficulty: 'basic',
    sourceFile: 'minecraft/minecraft_entities.js',
    imageURLs: [{ url: 'https://minecraft.wiki/w/File:Cow_entity.png', filename: 'Cow_entity.png', type: 'Default' }]
  },
  {
    word: 'Stronghold',
    chinese: '要塞',
    category: 'structure',
    difficulty: 'advanced',
    sourceFile: 'minecraft/minecraft_advanced.js',
    imageURLs: [{ url: 'https://minecraft.wiki/w/File:Stronghold.png', filename: 'Stronghold.png', type: 'Default' }]
  },
  {
    word: 'Axe',
    chinese: '',
    category: 'tool',
    difficulty: 'basic',
    sourceFile: 'minecraft/minecraft_items.js',
    imageURLs: [{ url: 'https://minecraft.wiki/w/File:Axe.png', filename: 'Axe.png', type: 'Default' }]
  },
  {
    word: 'Oak',
    chinese: '橡木',
    category: 'block',
    difficulty: 'basic',
    sourceFile: 'minecraft/minecraft_blocks.js',
    imageURLs: [{ url: 'https://minecraft.wiki/w/File:Oak_Log.png', filename: 'Oak_Log.png', type: 'Default' }]
  },
  {
    word: 'Milk',
    chinese: '牛奶',
    category: 'food',
    difficulty: 'basic',
    sourceFile: 'minecraft/minecraft_items.js',
    imageURLs: [{ url: 'https://minecraft.wiki/w/File:Milk_Bucket.png', filename: 'Milk_Bucket.png', type: 'Default' }]
  }
];

const cards = selector.selectCuratedMinecraftCards(fixtureRows, {
  minWordLength: 3,
  maxWordLength: 7,
  limit: 10,
  level: 'minecraft-expanded',
  tagsSuffix: ['typing-expanded']
});

assert.deepEqual(cards.map(card => card.word), ['cow', 'oak', 'milk'], 'selector should keep only short, translated, allowed-category words');
assert.equal(cards[0].sourceFile, 'minecraft/minecraft_basic.js', 'selector should keep the higher-priority duplicate source');
assert.ok(cards.every(card => Array.isArray(card.distractors) && card.distractors.length === 3), 'selector should build 3 distractors for every retained card');

console.log('PASS - minecraft vocab selector contract');
