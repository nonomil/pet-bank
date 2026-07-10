import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawRoot = path.join(repoRoot, 'data', 'vocab', 'external', 'mario-minecraft-words-0315', 'vocabs');
const combinedRoot = path.join(repoRoot, 'data', 'vocab', 'word-memory-combined');
const combinedAllPath = path.join(combinedRoot, 'views', 'all.json');
const combinedManifestPath = path.join(combinedRoot, 'manifest.json');
const buildScriptPath = path.join(repoRoot, 'scripts', 'build_word_memory_combined_vocab.cjs');
const activeCardsPath = path.join(repoRoot, 'prj', '单词记忆射击场原型', 'assets', 'word-memory-cards.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

assert.ok(fs.existsSync(rawRoot), 'external vocabs should be copied into data/vocab/external');
assert.ok(fs.existsSync(path.join(rawRoot, 'manifest.js')), 'external vocab manifest should be preserved');
assert.ok(fs.existsSync(buildScriptPath), 'combined vocab build script should exist');
assert.ok(fs.existsSync(combinedAllPath), 'combined word-memory all view should exist');
assert.ok(fs.existsSync(combinedManifestPath), 'combined word-memory manifest should exist');
assert.ok(fs.existsSync(activeCardsPath), 'word-memory runtime cards should exist');

const combined = readJson(combinedAllPath);
const manifest = readJson(combinedManifestPath);
const active = readJson(activeCardsPath);

assert.equal(combined.id, 'word-memory-combined-all');
assert.equal(combined.viewId, 'all');
assert.ok(combined.cards.length >= 3000, 'combined view should merge the external English vocab packs');
assert.equal(new Set(combined.cards.map(card => card.word)).size, combined.cards.length, 'combined words should be unique after normalization');
assert.ok(combined.cards.some(card => card.word === 'smile' && /微笑/.test(card.translation)), 'kindergarten words should be merged');
assert.ok(combined.cards.some(card => card.word === 'ability' && /能力/.test(card.translation)), 'junior high words should be merged');
assert.ok(combined.cards.some(card => card.word === 'zombie' && /minecraft|external/i.test(card.sourceProvider)), 'external Minecraft words should be merged');
assert.ok(combined.cards.some(card => card.word === 'granite' && card.sourcePackId === 'english-minecraft/all'), 'existing curated Minecraft words should be retained');
assert.ok(
  combined.cards.every(card => card.word && card.translation && card.sourceProvider && card.sourcePackId),
  'every combined card should retain source trace fields'
);

assert.equal(manifest.id, 'word-memory-combined');
assert.equal(manifest.views[0]?.cardCount, combined.cards.length, 'manifest should track combined all-view count');
assert.equal(active.source?.file, 'data/vocab/word-memory-combined/views/all.json');
assert.equal(active.cards.length, combined.cards.length, 'runtime game deck should use the combined all-view');
assert.ok(
  active.cards.filter(card => /^https?:\/\//.test(card.enemyImage)).length > 1000,
  'runtime target images should prefer source-provided online images when available'
);
assert.ok(
  active.cards.every(card => card.enemyFallbackImage && !/^https?:\/\//.test(card.enemyFallbackImage)),
  'runtime target images should keep a local fallback for browser load failures'
);
assert.ok(
  active.cards.every(card => !/assets\/cards\/composed-v2\/mc_/.test(card.enemyImage) && !/assets\/cards\/composed-v2\/mc_/.test(card.enemyFallbackImage)),
  'runtime target images should not fall back to full composed cards'
);

console.log('PASS - word memory external vocab merge contract');
