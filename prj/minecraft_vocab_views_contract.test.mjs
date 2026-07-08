import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modulesDir = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const masterPath = path.join(modulesDir, 'minecraft-vocab.json');
const starterPath = path.join(modulesDir, 'minecraft-vocab-starter.json');
const corePath = path.join(modulesDir, 'minecraft-vocab-core.json');
const typingViewPath = path.join(modulesDir, 'minecraft-vocab-typing-view.json');
const memoryViewPath = path.join(modulesDir, 'minecraft-vocab-memory-view.json');

assert.ok(fs.existsSync(masterPath), 'master minecraft vocab should exist');
assert.ok(fs.existsSync(starterPath), 'starter view should exist');
assert.ok(fs.existsSync(corePath), 'core view should exist');
assert.ok(fs.existsSync(typingViewPath), 'typing view should exist');
assert.ok(fs.existsSync(memoryViewPath), 'memory view should exist');

const master = readJson(masterPath);
const starter = readJson(starterPath);
const core = readJson(corePath);
const typingView = readJson(typingViewPath);
const memoryView = readJson(memoryViewPath);

assert.equal(starter.id, 'minecraft-vocab-starter');
assert.equal(core.id, 'minecraft-vocab-core');
assert.equal(typingView.id, 'minecraft-vocab-typing-view');
assert.equal(memoryView.id, 'minecraft-vocab-memory-view');

assert.equal(starter.type, 'vocab-view');
assert.equal(core.type, 'vocab-view');
assert.equal(typingView.type, 'vocab-view');
assert.equal(memoryView.type, 'vocab-view');

assert.equal(starter.sourceModuleId, 'minecraft-vocab');
assert.equal(core.sourceModuleId, 'minecraft-vocab');
assert.equal(typingView.sourceModuleId, 'minecraft-vocab');
assert.equal(memoryView.sourceModuleId, 'minecraft-vocab');

assert.equal(starter.cards.length, 24, 'starter view should preserve the 24 seed cards');
assert.equal(core.cards.length, 72, 'core view should expose the curated 72-card core layer');
assert.equal(
  starter.cards.length + core.cards.length,
  master.cards.length,
  'starter + core should cover the master pack exactly once'
);

assert.ok(
  starter.cards.every(card => card.sourceProvider === 'mayihaoke'),
  'starter view should only keep mayihaoke seed cards'
);
assert.ok(
  core.cards.every(card => card.sourceProvider === 'minecraft_words_apk-main'),
  'core view should only keep curated external cards'
);

assert.ok(
  typingView.cards.length >= 80,
  'typing view should keep a large short-word pool for keyboard drills'
);
assert.ok(
  typingView.cards.every(card => /^[a-z]{3,7}$/.test(card.word)),
  'typing view should only keep short lowercase words'
);
assert.ok(
  typingView.cards.some(card => card.sourceProvider === 'mayihaoke')
    && typingView.cards.some(card => card.sourceProvider === 'minecraft_words_apk-main'),
  'typing view should mix starter and core sources'
);

assert.ok(
  memoryView.cards.length >= 18 && memoryView.cards.length <= 30,
  'memory view should be a compact meaning-memory deck'
);
assert.ok(
  memoryView.cards.every(card => /^[a-z]{3,8}$/.test(card.word)),
  'memory view should keep readable child-friendly words'
);
assert.ok(
  memoryView.cards.every(card => card.translation && card.image),
  'memory view should only contain image-friendly translated cards'
);
assert.ok(
  memoryView.cards.some(card => card.word === 'creeper'),
  'memory view should preserve at least one iconic Minecraft target'
);
assert.ok(
  memoryView.cards.some(card => ['animal', 'item', 'tool', 'food'].includes(card.viewCategory)),
  'memory view should expose concrete categories for meaning play'
);

const starterWords = new Set(starter.cards.map(card => card.word));
const coreWords = new Set(core.cards.map(card => card.word));
const typingWords = new Set(typingView.cards.map(card => card.word));
const memoryWords = new Set(memoryView.cards.map(card => card.word));
const masterWords = new Set(master.cards.map(card => card.word));

assert.equal(starterWords.size, starter.cards.length, 'starter view words should be unique');
assert.equal(coreWords.size, core.cards.length, 'core view words should be unique');
assert.equal(typingWords.size, typingView.cards.length, 'typing view words should be unique');
assert.equal(memoryWords.size, memoryView.cards.length, 'memory view words should be unique');

assert.ok(
  [...typingWords].every(word => masterWords.has(word)),
  'typing view should only reuse words from the master pack'
);
assert.ok(
  [...memoryWords].every(word => masterWords.has(word)),
  'memory view should only reuse words from the master pack'
);

console.log('PASS - minecraft vocab views contract');
