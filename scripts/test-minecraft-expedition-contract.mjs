import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expeditionPath = path.join(ROOT, 'data/learn/minecraft-expedition/camp-regions.json');
const vocabPath = path.join(ROOT, 'data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json');
const modulePath = path.join(ROOT, 'js/minecraft-vocab-expedition.js');
const pagePath = path.join(ROOT, 'js/minecraft-vocab-page.js');
const cssPath = path.join(ROOT, 'css/minecraft-vocab.css');

function createStorage() {
    const values = new Map();
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(String(key), String(value)); },
        removeItem(key) { values.delete(String(key)); },
        clear() { values.clear(); }
    };
}

async function loadExpedition() {
    const source = await fs.readFile(modulePath, 'utf8');
    const storage = createStorage();
    const window = {
        localStorage: storage,
        ProfileManager: { getActiveId: () => 'child-a' },
        console: { warn() {} }
    };
    vm.runInNewContext(source, { window, localStorage: storage, console: window.console, JSON, Date });
    return { api: window.MinecraftVocabExpedition, storage, window };
}

test('expedition data references real cards and has a connected MVP route', async () => {
    const expedition = JSON.parse(await fs.readFile(expeditionPath, 'utf8'));
    const vocab = JSON.parse(await fs.readFile(vocabPath, 'utf8'));
    const cardIds = new Set(vocab.cards.map(card => card.id));
    assert.equal(expedition.version, 2);
    assert.equal(expedition.camp.id, 'minecraft-camp');
    assert.ok(Array.isArray(expedition.regions));
    assert.ok(expedition.regions.length >= 3);
    assert.equal(expedition.collection.id, 'word-card-collection');

    const regionIds = new Set(expedition.regions.map(region => region.id));
    assert.equal(regionIds.size, expedition.regions.length);
    const missionIds = new Set();
    let missionCount = 0;
    for (const region of expedition.regions) {
        assert.match(region.title, /\S/);
        assert.match(region.titleEn, /\S/);
        assert.match(region.sceneImage, /minecraft-expedition\/.+\.png$/);
        for (const prerequisite of region.prerequisiteRegionIds || []) assert.ok(regionIds.has(prerequisite));
        const mission = region.mission;
        assert.ok(mission, `${region.id} should expose one story mission`);
        assert.ok(!missionIds.has(mission.id));
        missionIds.add(mission.id);
        missionCount += 1;
        assert.equal(mission.cardIds.length, 4);
        mission.cardIds.forEach(cardId => assert.ok(cardIds.has(cardId), `missing vocab card ${cardId}`));
        assert.match(mission.reward.rewardId, /^minecraft-expedition-/);
        assert.ok(mission.battle.enemy && mission.battle.enemyEn);
        assert.ok(mission.battle.enemyPower > 0);
        assert.ok(mission.reward.item && mission.reward.experience > 0);
    }
    assert.equal(missionCount, expedition.regions.length);
});

test('expedition state transitions unlock the next region and persist by profile', async () => {
    const { api, storage } = await loadExpedition();
    const regions = [
        { id: 'grassland-trail', prerequisiteRegionIds: [] },
        { id: 'mineshaft-entrance', prerequisiteRegionIds: ['grassland-trail'] }
    ];
    const initial = api.readState(regions, 'child-a');
    assert.equal(initial.regions['grassland-trail'], 'available');
    assert.equal(initial.regions['mineshaft-entrance'], 'locked');

    const entered = api.enterRegion(initial, 'grassland-trail', regions);
    assert.equal(entered.state.regions['grassland-trail'], 'active');
    assert.equal(entered.persisted, true);
    const completed = api.completeRegion(entered.state, 'grassland-trail', regions, 'grassland-first-steps', 'grassland-stamp');
    assert.equal(completed.state.regions['grassland-trail'], 'cleared');
    assert.equal(completed.state.regions['mineshaft-entrance'], 'available');
    assert.deepEqual(Array.from(completed.state.collection), ['grassland-stamp']);
    assert.equal(completed.duplicate, false);

    const duplicate = api.completeRegion(completed.state, 'grassland-trail', regions);
    assert.equal(duplicate.duplicate, true);
    assert.deepEqual(duplicate.state.regions, completed.state.regions);

    const restored = api.readState(regions, 'child-a');
    assert.equal(restored.regions['mineshaft-entrance'], 'available');
    assert.ok(storage.getItem(api.storageKey('child-a')));
});

test('expedition state is isolated and damaged data falls back safely', async () => {
    const { api, storage } = await loadExpedition();
    const regions = [{ id: 'grassland-trail', prerequisiteRegionIds: [] }];
    const childA = api.readState(regions, 'child-a');
    api.enterRegion(childA, 'grassland-trail', regions);
    const childB = api.readState(regions, 'child-b');
    assert.equal(childB.regions['grassland-trail'], 'available');

    storage.setItem(api.storageKey('child-b'), '{bad-json');
    const recovered = api.readState(regions, 'child-b');
    assert.equal(recovered.profileId, 'child-b');
    assert.equal(recovered.regions['grassland-trail'], 'available');
});

test('learning page exposes camp map controls and responsive card layout', async () => {
    const pageSource = await fs.readFile(pagePath, 'utf8');
    const cssSource = await fs.readFile(cssPath, 'utf8');
    assert.match(pageSource, /data-mv-region/);
    assert.match(pageSource, /data-mv-return-camp/);
    assert.match(pageSource, /camp-regions\.json/);
    assert.match(pageSource, /data-mv-listen/);
    assert.match(cssSource, /\.mv-region-route\s*\{[\s\S]*grid-template-columns: repeat\(5/);
    assert.match(cssSource, /@media \(max-width: 760px\)[\s\S]*\.mv-region-route\s*\{\s*grid-template-columns: 1fr/);
    assert.match(cssSource, /\.mv-card-rack\s*\{[\s\S]*grid-template-columns/);
});
