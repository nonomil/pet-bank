import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expeditionSource = fs.readFileSync(path.join(root, 'js', 'minecraft-vocab-expedition.js'), 'utf8');
const progressSource = fs.readFileSync(path.join(root, 'js', 'english-vocab-progress.js'), 'utf8');
const sessionSource = fs.readFileSync(path.join(root, 'js', 'minecraft-vocab-session.js'), 'utf8');
const levelsSource = fs.readFileSync(path.join(root, 'js', 'minecraft-vocab-levels.js'), 'utf8');

function createStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); },
        dump(key) { return values.get(key); }
    };
}

function loadModules(storage) {
    const window = {
        localStorage: storage,
        ProfileManager: { getActiveId: () => 'profile-a' },
        PetBankTime: { localDate: () => '2026-07-19' },
        GameRewardReceipts: { claim(event) { return { accepted: true, event }; } }
    };
    const context = { window, localStorage: storage, JSON, Date, console: { warn() {} } };
    vm.runInNewContext(progressSource, context);
    vm.runInNewContext(expeditionSource, context);
    vm.runInNewContext(sessionSource, context);
    vm.runInNewContext(levelsSource, context);
    return {
        progress: window.EnglishVocabProgress,
        expedition: window.MinecraftVocabExpedition,
        session: window.MinecraftVocabSession,
        levels: window.MinecraftVocabLevels
    };
}

const regions = [
    { id: 'grassland-trail', prerequisiteRegionIds: [] },
    { id: 'village-gate', prerequisiteRegionIds: ['grassland-trail'] }
];

{
    const modules = loadModules(createStorage());
    const { progress, expedition } = modules;
    let state = expedition.createDefaultState(regions, 'profile-a');
    state = expedition.enterRegion(state, 'grassland-trail', regions).state;

    const before = progress.get('stone');
    const afterProgress = progress.record('stone', 'good', { now: '2026-07-19T08:00:00.000Z' });
    const growth = expedition.recordWordAction(state, 'stone', before, 'good', { mode: 'new' });

    assert.equal(before.status, 'new');
    assert.equal(afterProgress.status, 'learning', 'one correct answer must not fake mastered vocabulary');
    assert.equal(growth.accepted, true);
    assert.equal(growth.masteryStatus, 'new');
    assert.deepEqual(JSON.parse(JSON.stringify(growth.state.wordCardIds)), ['stone']);
    assert.equal(growth.state.experience, 2, 'first successful expedition card should award expedition XP');
    assert.equal(growth.state.wordMastery, undefined, 'expedition state must not become a second mastery ledger');
    assert.deepEqual(JSON.parse(JSON.stringify(growth.state.collection)), [], 'word completion must not award a region stamp');
    assert.deepEqual(JSON.parse(JSON.stringify(growth.state.inventory)), [], 'word completion must not award a region item');
    assert.deepEqual(JSON.parse(JSON.stringify(growth.state.abilities)), [], 'word completion must not invent an expedition ability');
}

{
    const modules = loadModules(createStorage());
    const { expedition } = modules;
    const state = expedition.createDefaultState(regions, 'profile-a');
    const result = expedition.recordWordAction(state, 'stone', { status: 'new' }, 'again');
    assert.equal(result.accepted, false);
    assert.equal(result.reason, 'incorrect');
    assert.equal(result.state.experience, 0);
    assert.deepEqual(JSON.parse(JSON.stringify(result.state.wordCardIds)), []);
}

{
    const modules = loadModules(createStorage());
    const { progress, session } = modules;
    progress.record('stone', 'good', { now: '2026-07-19T08:00:00.000Z' });
    progress.record('stone', 'good', { now: '2026-07-20T08:00:00.000Z' });
    const existing = session.cardProgress(card => progress.get(card.id), { id: 'stone' });
    assert.equal(existing.status, 'mastered');
    assert.equal(session.isDue(existing, Date.parse('2026-07-24T00:00:00.000Z')), true);
}

{
    const modules = loadModules(createStorage());
    const { expedition } = modules;
    let state = expedition.createDefaultState(regions, 'profile-a');
    state = expedition.enterRegion(state, 'grassland-trail', regions).state;
    const completed = expedition.completeRegion(state, 'grassland-trail', regions, 'mission-1', 'grassland-stamp', {
        experience: 12,
        item: 'pathfinder',
        enemy: 'slime'
    });
    const duplicate = expedition.completeRegion(completed.state, 'grassland-trail', regions, 'mission-1', 'grassland-stamp', {
        experience: 12,
        item: 'pathfinder',
        enemy: 'slime'
    });

    assert.equal(completed.persisted, true);
    assert.equal(completed.state.experience, 12);
    assert.deepEqual(JSON.parse(JSON.stringify(completed.state.collection)), ['grassland-stamp']);
    assert.deepEqual(JSON.parse(JSON.stringify(completed.state.inventory)), ['pathfinder']);
    assert.deepEqual(JSON.parse(JSON.stringify(completed.state.abilities)), ['pathfinder']);
    assert.equal(duplicate.duplicate, true);
    assert.equal(duplicate.state.experience, completed.state.experience);
    assert.deepEqual(JSON.parse(JSON.stringify(duplicate.state.collection)), JSON.parse(JSON.stringify(completed.state.collection)));
    assert.deepEqual(JSON.parse(JSON.stringify(duplicate.state.inventory)), JSON.parse(JSON.stringify(completed.state.inventory)));
    assert.deepEqual(JSON.parse(JSON.stringify(duplicate.state.abilities)), JSON.parse(JSON.stringify(completed.state.abilities)));
}

{
    const modules = loadModules(createStorage());
    const { expedition, session, levels } = modules;
    let state = expedition.createDefaultState(regions, 'profile-a');
    state = expedition.enterRegion(state, 'grassland-trail', regions).state;
    const growth = expedition.recordWordAction(state, 'stone', { status: 'new' }, 'good');
    const repeated = expedition.recordWordAction(growth.state, 'stone', { status: 'learning' }, 'easy');
    assert.equal(repeated.duplicate, true);
    assert.equal(repeated.state.experience, growth.state.experience);
    assert.deepEqual(JSON.parse(JSON.stringify(repeated.state.wordCardIds)), ['stone']);

    const rewardEvent = session.getRewardEvent({
        profileId: 'profile-a', localDate: '2026-07-19', regionId: '',
        rewardPoints: 10, queue: [{ cardId: 'stone' }], completed: ['stone']
    });
    assert.equal(rewardEvent.points, 10, 'main-site points remain a separate session reward');
    assert.equal(Object.hasOwn(growth.state, 'points'), false);
    assert.equal(Object.hasOwn(growth.state, 'rewardPoints'), false);

    const moduleDoc = JSON.parse(fs.readFileSync(path.join(root, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json'), 'utf8'));
    const kindergartenCards = levels.filterCards(moduleDoc.cards, 'kindergarten');
    assert.ok(kindergartenCards.length > 0);
    assert.ok(kindergartenCards.every(card => card.curriculumLevel === 'kindergarten'));
    assert.equal(kindergartenCards.some(card => card.minecraftBand), false, 'kindergarten must not select Minecraft starter bands');
}

console.log('minecraft vocab progression: PASS');
