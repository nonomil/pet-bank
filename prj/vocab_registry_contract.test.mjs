import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vocabRoot = path.join(repoRoot, 'data', 'vocab');
const packageDir = path.join(vocabRoot, 'english-minecraft');
const viewsDir = path.join(packageDir, 'views');
const upstreamModulesDir = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules');
const syncScriptPath = path.join(repoRoot, 'scripts', 'sync_vocab_registry.cjs');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function wordsOf(doc) {
  return (doc.cards || []).map(card => card.word).sort();
}

assert.ok(fs.existsSync(path.join(vocabRoot, 'README.md')), 'data/vocab should document the game vocab layer');
assert.ok(fs.existsSync(path.join(packageDir, 'README.md')), 'english-minecraft vocab package should include README');
assert.ok(fs.existsSync(syncScriptPath), 'root vocab sync script should exist');

const scriptSource = fs.readFileSync(syncScriptPath, 'utf8');
assert.match(scriptSource, /data['"],\s*['"]vocab['"],\s*['"]english-minecraft/s, 'sync script should publish to data/vocab/english-minecraft');
assert.match(scriptSource, /minecraft-vocab\.json/, 'sync script should copy the full vocab view');
assert.match(scriptSource, /minecraft-vocab-memory-view\.json/, 'sync script should copy the memory view');
assert.match(scriptSource, /minecraft-vocab-typing-view\.json/, 'sync script should copy the typing view');

const manifest = readJson(path.join(packageDir, 'manifest.json'));
assert.equal(manifest.id, 'english-minecraft');
assert.equal(manifest.type, 'game-vocab-pack');
assert.equal(manifest.sourcePackId, 'english-mc-hybrid-2026');
assert.equal(manifest.sourceModuleId, 'minecraft-vocab');
assert.ok(Array.isArray(manifest.views), 'manifest should list views');

const expectedViews = [
  ['all', 'all.json', 'minecraft-vocab.json', 96],
  ['starter', 'starter.json', 'minecraft-vocab-starter.json', 24],
  ['core', 'core.json', 'minecraft-vocab-core.json', 72],
  ['typing-view', 'typing-view.json', 'minecraft-vocab-typing-view.json', 92],
  ['memory-view', 'memory-view.json', 'minecraft-vocab-memory-view.json', 24]
];

for (const [id, fileName, upstreamName, count] of expectedViews) {
  const viewRecord = manifest.views.find(view => view.id === id);
  assert.ok(viewRecord, `manifest should register ${id}`);
  assert.equal(viewRecord.file, `data/vocab/english-minecraft/views/${fileName}`);
  assert.equal(viewRecord.upstreamFile, `data/learn/packs/english-mc-hybrid-2026/modules/${upstreamName}`);
  assert.equal(viewRecord.cardCount, count, `${id} manifest count should stay aligned`);

  const localView = readJson(path.join(viewsDir, fileName));
  const upstreamView = readJson(path.join(upstreamModulesDir, upstreamName));
  assert.equal(localView.id, upstreamView.id, `${id} should preserve upstream id`);
  assert.equal(localView.viewId || id, upstreamView.viewId || id, `${id} should preserve view id`);
  assert.equal(localView.cards.length, count, `${id} local view should have expected card count`);
  assert.deepEqual(wordsOf(localView), wordsOf(upstreamView), `${id} local view words should match upstream`);
}

console.log('PASS - vocab registry contract');
