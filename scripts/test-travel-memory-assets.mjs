import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loadTravelMemory(initial = {}) {
  const storage = new Map();
  Object.entries(initial).forEach(([key, value]) => storage.set(key, String(value)));
  const context = {
    console,
    globalThis: null,
    window: null,
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    }
  };
  context.globalThis = context;
  context.window = context;
  vm.runInNewContext(fs.readFileSync('js/travel-memory.js', 'utf8'), context, { filename: 'js/travel-memory.js' });
  return context.TravelMemory;
}

const catalog = JSON.parse(fs.readFileSync('data/travel-rewards.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('assets/generated/travel-memory/manifest.json', 'utf8'));
const allowedSources = new Set(['existing', 'Agnes', 'Bee/Grok', 'ChatGPT-web', 'manual']);
const allowedStatuses = new Set(['placeholder', 'candidate', 'verified', 'published']);

assert.equal(catalog.version, 2);
assert.deepEqual(Object.keys(catalog.scenes).sort(), ['beach', 'forest', 'stargarden']);
assert.equal(manifest.status, 'verified');
assert.equal(manifest.assets.length, 10);
for (const asset of manifest.assets) {
  assert.equal(asset.width, 1024, `${asset.name} width`);
  assert.equal(asset.height, 1024, `${asset.name} height`);
  assert.equal(asset.status, 'verified', `${asset.name} status`);
  assert.ok(fs.existsSync(asset.file), `${asset.name} file`);
  if (asset.colorMode === 'RGBA') {
    assert.equal(asset.edgeAlphaMax, 0, `${asset.name} edge alpha`);
    assert.equal(asset.greenLikePixels, 0, `${asset.name} green residue`);
  }
}

for (const [sceneId, scene] of Object.entries(catalog.scenes)) {
  assert.ok(scene.assetVersion, `${sceneId} assetVersion`);
  assert.ok(allowedSources.has(scene.assetSource), `${sceneId} assetSource`);
  assert.ok(allowedStatuses.has(scene.assetStatus), `${sceneId} assetStatus`);
  for (const key of ['asset', 'cardAsset', 'fridgeAsset', 'petCardAsset']) {
    assert.equal(typeof scene[key], 'string', `${sceneId} ${key}`);
    assert.ok(scene[key].startsWith('assets/generated/travel-memory/'), `${sceneId} ${key} path`);
  }
}

const travel = loadTravelMemory();
travel.configure(catalog.scenes);
const memory = travel.getSceneMemory('forest');
assert.equal(memory.asset, catalog.scenes.forest.asset);
assert.equal(memory.cardAsset, catalog.scenes.forest.cardAsset);
assert.equal(memory.fridgeAsset, catalog.scenes.forest.fridgeAsset);
assert.equal(memory.petCardAsset, catalog.scenes.forest.petCardAsset);
assert.equal(memory.assetSource, 'Agnes');
assert.equal(memory.assetStatus, 'verified');
assert.equal(memory.assetStatuses.asset, 'verified');
assert.equal(memory.assetStatuses.cardAsset, 'verified');
assert.equal(travel.isRenderableAsset(memory, 'asset'), true);
assert.equal(travel.isRenderableAsset(memory, 'cardAsset'), true);

const result = travel.record({ sceneId: 'forest', completedAt: '2026-07-12T00:00:00.000Z' });
assert.equal(result.accepted, true);
assert.equal(result.memory.fridgeAsset, catalog.scenes.forest.fridgeAsset);
assert.deepEqual(JSON.parse(JSON.stringify(travel.getOwnedAssets('fridge'))), JSON.parse(JSON.stringify([result.memory])));
assert.deepEqual(JSON.parse(JSON.stringify(travel.getOwnedAssets('card'))), JSON.parse(JSON.stringify([result.memory])));
assert.equal(travel.record({ sceneId: 'forest' }).reason, 'duplicate');
const legacyStorage = loadTravelMemory({
  petbank_travel_memory_v1: JSON.stringify({
    beach: {
      sceneId: 'beach',
      title: '海滩贝壳',
      icon: '🐚',
      itemId: 'shell',
      nextPreview: '下一站：星光花园',
      returnText: '旧记录',
      completedAt: '2026-07-12T00:00:00.000Z',
      schemaVersion: 1
    }
  })
});
legacyStorage.configure(catalog.scenes);
const hydrated = legacyStorage.hydrateStoredMemories().find((item) => item.sceneId === 'beach');
assert.equal(hydrated.cardAsset, catalog.scenes.beach.cardAsset);
assert.equal(hydrated.fridgeFurnitureId, catalog.scenes.beach.fridgeFurnitureId);

const detailSource = fs.readFileSync('js/exploration-detail.js', 'utf8');
assert.match(detailSource, /isRenderableAsset\?\.\(memory, 'asset'\)/);
assert.match(detailSource, /travel-memory-art/);
const homeSource = fs.readFileSync('js/home.js', 'utf8');
assert.match(homeSource, /TravelMemory/);
assert.match(homeSource, /travel-memory-collection/);
const cardSource = fs.readFileSync('js/card-collection.js', 'utf8');
assert.match(cardSource, /travel-memory-gallery/);
const runtimeSource = fs.readFileSync('js/runtime-loader.js', 'utf8');
assert.match(runtimeSource, /home: \[[\s\S]*js\/travel-memory\.js/);
assert.match(runtimeSource, /cardCollection: \[[\s\S]*js\/travel-memory\.js/);

console.log('travel memory asset contract tests passed');
