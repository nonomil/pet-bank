import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packPath = path.join(root, 'data', 'learn', 'minecraft-expedition', 'camp-regions.json');
const manifestPath = path.join(root, 'assets', 'learn', 'english-vocab', 'generated', 'minecraft-expedition', 'manifest.json');
const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const vocab = JSON.parse(fs.readFileSync(path.join(root, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json'), 'utf8'));
const cards = new Map(vocab.cards.map(card => [card.id, card]));

assert.equal(pack.version, 2);
assert.equal(pack.regions.length, 5);
assert.equal(pack.regions[0].status, 'available');
assert.equal(pack.regions.at(-1).id, 'ender-dragon-arena');
assert.equal(pack.regions.at(-1).mission.battle.enemyEn, 'Ender Dragon Boss');
assert.ok(pack.story.opening && pack.story.openingEn && pack.story.ending && pack.story.endingEn);
assert.ok(fs.existsSync(path.join(root, pack.camp.mapImage)));

const ids = new Set();
for (const [index, region] of pack.regions.entries()) {
  assert.ok(region.titleEn, `region ${index} needs English title`);
  assert.ok(region.sceneImage, `region ${index} needs scene image`);
  assert.ok(fs.existsSync(path.join(root, region.sceneImage)), `${region.id} scene image missing`);
  const mission = region.mission;
  assert.ok(mission.title && mission.titleEn, `${region.id} needs bilingual mission title`);
  assert.equal(mission.cardIds.length, 4, `${region.id} should have four cards`);
  for (const cardId of mission.cardIds) {
    assert.ok(!ids.has(cardId), `story route card is duplicated: ${cardId}`);
    ids.add(cardId);
    assert.ok(cards.has(cardId), `${region.id} references missing card ${cardId}`);
    assert.ok(cards.get(cardId).phrase && cards.get(cardId).sentence, `${cardId} needs phrase and sentence`);
  }
  assert.ok(mission.battle.enemy && mission.battle.enemyEn && mission.battle.enemyPower > 0);
  assert.ok(mission.reward.item && mission.reward.experience > 0 && mission.reward.points > 0);
  if (index > 0) assert.deepEqual(region.prerequisiteRegionIds, [pack.regions[index - 1].id]);
}

assert.equal(manifest.assets.length, 6);
for (const asset of manifest.assets) {
  const file = path.join(root, asset.path);
  assert.ok(fs.existsSync(file), `${asset.id} file missing`);
  assert.deepEqual(asset.dimensions, [1536, 1024]);
}

const expeditionSource = fs.readFileSync(path.join(root, 'js', 'minecraft-vocab-expedition.js'), 'utf8');
assert.match(expeditionSource, /experience/);
assert.match(expeditionSource, /calculateBattle/);
assert.match(expeditionSource, /inventory/);
assert.match(expeditionSource, /LEGACY_STORAGE_PREFIX/);
console.log(`minecraft expedition content: PASS (${pack.regions.length} regions / ${ids.size} story cards / ${manifest.assets.length} Agnes scenes)`);
