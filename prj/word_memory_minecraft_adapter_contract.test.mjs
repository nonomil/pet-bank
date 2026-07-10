import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const prototypeDir = path.join(repoRoot, 'prj', '单词记忆射击场原型');
const rootVocabManifestPath = path.join(repoRoot, 'data', 'vocab', 'word-memory-combined', 'manifest.json');
const upstreamSourcePath = path.join(
  repoRoot,
  'data',
  'vocab',
  'external',
  'mario-minecraft-words-0315',
  'vocabs',
  'manifest.js'
);
const sourcePath = path.join(repoRoot, 'data', 'vocab', 'word-memory-combined', 'views', 'all.json');
const scriptPath = path.join(prototypeDir, 'scripts', 'build_word_memory_cards_from_minecraft.cjs');
const activePath = path.join(prototypeDir, 'assets', 'word-memory-cards.json');
const snapshotPath = path.join(
  prototypeDir,
  'assets',
  'generated',
  'minecraft-memory-adapter',
  'minecraft-word-memory-cards.json'
);
const manifestPath = path.join(prototypeDir, 'assets', 'generated', 'minecraft-memory-adapter', 'manifest.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

assert.ok(fs.existsSync(scriptPath), 'minecraft memory adapter build script should exist');
assert.ok(fs.existsSync(upstreamSourcePath), 'external vocab manifest should exist as an upstream source');
assert.ok(fs.existsSync(rootVocabManifestPath), 'root vocab package manifest should exist');
assert.ok(fs.existsSync(sourcePath), 'root vocab package should publish an all view');
assert.ok(fs.existsSync(activePath), 'word memory active cards should exist');
assert.ok(fs.existsSync(snapshotPath), 'adapter should keep a generated snapshot');
assert.ok(fs.existsSync(manifestPath), 'adapter should publish a generated manifest');

const scriptSource = fs.readFileSync(scriptPath, 'utf8');
const rootVocabManifest = readJson(rootVocabManifestPath);
const source = readJson(sourcePath);
const active = readJson(activePath);
const snapshot = readJson(snapshotPath);
const manifest = readJson(manifestPath);

assert.match(
  scriptSource,
  /data['"],\s*['"]vocab['"],\s*['"]word-memory-combined['"],\s*['"]views['"],\s*['"]all\.json/s,
  'adapter script should default to the combined word-memory all view'
);
assert.equal(rootVocabManifest.id, 'word-memory-combined');
assert.ok(
  rootVocabManifest.views.some(view => view.id === 'all' && view.file === 'data/vocab/word-memory-combined/views/all.json' && view.cardCount >= 3000),
  'root vocab manifest should register the combined all view'
);
assert.equal(active.adapterVersion, 'minecraft-memory-v1');
assert.equal(active.source?.moduleId, 'word-memory-combined');
assert.equal(active.source?.viewId, 'all');
assert.equal(active.source?.file, 'data/vocab/word-memory-combined/views/all.json');
assert.equal(active.source?.registryManifest, 'data/vocab/word-memory-combined/manifest.json');
assert.deepEqual(active, snapshot, 'generated snapshot should match the active cards file');
assert.equal(manifest.cardCount, active.cards.length, 'manifest card count should match active data');

const sourceWords = source.cards.map(card => card.word).sort();
const activeWords = active.cards.map(card => card.word).sort();
assert.deepEqual(activeWords, sourceWords, 'active game deck should mirror the combined all-view words');
assert.ok(active.cards.length >= 3000, 'current memory game should expose the copied external English vocab deck');

assert.ok(
  active.cards.every(card => card.word && card.translation && card.icon && card.enemyImage && card.bombImage && card.burstImage),
  'every adapted card should include the fields consumed by the map game'
);
assert.ok(
  active.cards.every(card => card.sourceCardId && card.sourceProvider && card.viewCategory),
  'every adapted card should retain source trace metadata'
);
assert.ok(
  active.cards.some(card => /assets\/MineCraft宠物图片\/poses\/mc_(creeper|zombie|wolf|cat)_idle\.webp/.test(card.enemyImage)),
  'iconic Minecraft cards should prefer project-local transparent Minecraft pose art when available'
);
assert.ok(
  active.cards.some(card => /enemy_(chicken|pig|sheep|chick|mouse)\.png/.test(card.enemyFallbackImage)),
  'cards should keep polished generated farm targets as local fallbacks'
);
assert.ok(
  active.cards.filter(card => /^https?:\/\//.test(card.enemyImage)).length > 1000,
  'active target images should use online source images when available'
);
assert.ok(
  active.cards.every(card => card.enemyFallbackImage && !/^https?:\/\//.test(card.enemyFallbackImage)),
  'active target images should provide a local fallback for browser load failures'
);
assert.ok(
  active.cards.some(card => card.word === 'diamond' && /^https:\/\/minecraft\.wiki\/w\/Special:Redirect\/file\/Diamond\.png/.test(card.enemyImage)),
  'Minecraft Wiki reference images should stay online as primary source images'
);
assert.ok(
  active.cards
    .filter(card => ['hen', 'piglet', 'lamb', 'boar', 'mouse'].includes(card.word))
    .every(card => card.sourcePackId && card.sourceProvider),
  'animal words from the external deck should retain source trace metadata'
);

console.log('PASS - word memory minecraft adapter contract');
