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
const manifestByPath = new Map(manifest.assets.map(asset => [asset.path, asset]));
const lowAgeLevels = new Set(['kindergarten', 'bridge', 'lower-grade']);
const kindergartenCardIds = new Set(vocab.cards
  .filter(card => card.curriculumLevel === 'kindergarten')
  .map(card => card.id));

assert.equal(pack.version, 2);
assert.equal(pack.regions.length, 5);
assert.deepEqual(pack.regions.map(region => region.minVocabLevel), ['kindergarten', 'bridge', 'lower-grade', 'minecraft', 'minecraft']);
assert.equal(pack.regions[0].status, 'available');
assert.equal(pack.regions.at(-1).id, 'ender-dragon-arena');
assert.equal(pack.regions.at(-1).mission.battle.enemyEn, 'Ender Dragon Boss');
assert.ok(pack.story.opening && pack.story.openingEn && pack.story.ending && pack.story.endingEn);
assert.ok(fs.existsSync(path.join(root, pack.camp.mapImage)));
assert.ok(fs.existsSync(path.join(root, pack.camp.storyImage)));
assert.ok(manifestByPath.has(pack.camp.mapImage), 'camp map must be in the runtime manifest');
assert.ok(manifestByPath.has(pack.camp.storyImage), 'camp story image must be in the runtime manifest');

const ids = new Set();
for (const [index, region] of pack.regions.entries()) {
  assert.ok(region.titleEn, `region ${index} needs English title`);
  assert.ok(region.sceneImage, `region ${index} needs scene image`);
  assert.ok(fs.existsSync(path.join(root, region.sceneImage)), `${region.id} scene image missing`);
    assert.ok(region.storyImage, `${region.id} needs a story image`);
    assert.ok(fs.existsSync(path.join(root, region.storyImage)), `${region.id} story image missing`);
  assert.ok(manifestByPath.has(region.sceneImage), `${region.id} scene image must be in the runtime manifest`);
  assert.ok(manifestByPath.has(region.storyImage), `${region.id} story image must be in the runtime manifest`);
  assert.ok(Array.isArray(region.storyBeats) && region.storyBeats.length >= 2 && region.storyBeats.length <= 3, `${region.id} needs two or three story beats`);
  assert.ok(region.story?.zh && region.story?.en, `${region.id} needs a bilingual story summary`);
  for (const beat of region.storyBeats) {
    assert.ok(beat.title && beat.titleEn && beat.zh && beat.en, `${region.id} story beats must be bilingual`);
  }
  const mission = region.mission;
  assert.ok(mission.title && mission.titleEn, `${region.id} needs bilingual mission title`);
  assert.ok(mission.cardIds.length >= 4 && mission.cardIds.length <= 6, `${region.id} should have four to six cards`);
  for (const cardId of mission.cardIds) {
    assert.ok(!ids.has(cardId), `story route card is duplicated: ${cardId}`);
    ids.add(cardId);
    assert.ok(cards.has(cardId), `${region.id} references missing card ${cardId}`);
    const card = cards.get(cardId);
    assert.ok(card.phrase && card.sentence, `${cardId} needs phrase and sentence`);
    assert.ok(card.image && fs.existsSync(path.join(root, card.image)), `${cardId} image missing`);
    assert.ok(String(card.sentence).trim().split(/\s+/).length <= 12, `${cardId} sentence should stay short for Pre-A1/A1`);
  }
  assert.ok(mission.battle.enemy && mission.battle.enemyEn && mission.battle.enemyPower > 0);
  assert.ok(mission.reward.item && mission.reward.experience > 0 && mission.reward.points > 0);
  if (index === pack.regions.length - 1) {
    assert.ok(region.storyFinalImage);
    assert.ok(fs.existsSync(path.join(root, region.storyFinalImage)));
    assert.ok(manifestByPath.has(region.storyFinalImage), `${region.id} final story image must be in the runtime manifest`);
  }
  if (index > 0) assert.deepEqual(region.prerequisiteRegionIds, [pack.regions[index - 1].id]);
}

const lowAgeRegions = pack.regions.filter(region => lowAgeLevels.has(region.minVocabLevel));
assert.ok(lowAgeRegions.length >= 3, 'the connected route needs kindergarten through lower-grade regions');
for (const region of pack.regions.filter(region => region.minVocabLevel === 'minecraft')) {
  assert.equal(region.mission.cardIds.some(cardId => kindergartenCardIds.has(cardId)), false, `${region.id} must stay out of the default kindergarten queue`);
}

assert.equal(manifest.assets.length, 13);
assert.ok(manifest.assets.filter(asset => asset.source === 'grok-imagine-image-quality').length >= 7);
for (const asset of manifest.assets) {
  const file = path.join(root, asset.path);
  assert.ok(fs.existsSync(file), `${asset.id} file missing`);
  const png = fs.readFileSync(file);
  assert.deepEqual(asset.dimensions, [png.readUInt32BE(16), png.readUInt32BE(20)], `${asset.id} manifest dimensions must match the PNG`);
}

const expeditionSource = fs.readFileSync(path.join(root, 'js', 'minecraft-vocab-expedition.js'), 'utf8');
assert.match(expeditionSource, /experience/);
assert.match(expeditionSource, /calculateBattle/);
assert.match(expeditionSource, /inventory/);
assert.match(expeditionSource, /LEGACY_STORAGE_PREFIX/);
console.log(`minecraft expedition content: PASS (${pack.regions.length} regions / ${ids.size} story cards / ${manifest.assets.length} scenes, Grok story assets verified)`);
