import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expeditionSource = fs.readFileSync(path.join(root, 'js', 'minecraft-vocab-expedition.js'), 'utf8');
const sessionSource = fs.readFileSync(path.join(root, 'js', 'minecraft-vocab-session.js'), 'utf8');
const progressSource = fs.readFileSync(path.join(root, 'js', 'english-vocab-progress.js'), 'utf8');
const pageSource = fs.readFileSync(path.join(root, 'js', 'minecraft-vocab-page.js'), 'utf8');
const bridgeSource = fs.readFileSync(path.join(root, 'js', 'minecraft-vocab-exploration-bridge.js'), 'utf8');
const registry = fs.readFileSync(path.join(root, 'docs_project', 'data-contracts', 'localstorage-registry.json'), 'utf8');

function createStorage() {
    const values = new Map();
    return {
        getItem(key) { return values.has(key) ? values.get(key) : null; },
        setItem(key, value) { values.set(key, String(value)); },
        removeItem(key) { values.delete(key); },
        dump(key) { return values.get(key); }
    };
}

function load(storage, activeId) {
    const window = {
        localStorage: storage,
        ProfileManager: { getActiveId: () => activeId.value },
        PetBankTime: { localDate: () => '2026-07-19' },
        GameRewardReceipts: { claim(event) { return { accepted: true, event }; } }
    };
    const context = { window, localStorage: storage, JSON, Date, console: { warn() {} } };
    vm.runInNewContext(progressSource, context);
    vm.runInNewContext(expeditionSource, context);
    vm.runInNewContext(sessionSource, context);
    return window;
}

const regions = [{ id: 'grassland-trail', prerequisiteRegionIds: [] }];
const storage = createStorage();
const activeId = { value: 'profile-a' };
const window = load(storage, activeId);
const aExpedition = window.MinecraftVocabExpedition;
let aState = aExpedition.createDefaultState(regions, 'profile-a');
aState = aExpedition.enterRegion(aState, 'grassland-trail', regions).state;
aState = aExpedition.recordWordAction(aState, 'stone', { status: 'new' }, 'good').state;
assert.ok(storage.dump('petbank_minecraft_expedition_state_v2_profile-a'));
window.EnglishVocabProgress.record('stone', 'good');
const aSession = window.MinecraftVocabSession.start([{ id: 'stone', category: 'block' }], card => window.EnglishVocabProgress.get(card.id), '2026-07-19', { levelId: 'kindergarten', queueSize: 1 });
assert.ok(storage.dump('petbank_minecraft_vocab_session_v1_profile-a'));

activeId.value = 'profile-b';
assert.equal(window.MinecraftVocabExpedition.readState(regions, 'profile-b').wordCardIds.length, 0);
assert.equal(window.MinecraftVocabSession.readState('profile-b'), null);
assert.equal(window.EnglishVocabProgress.get('stone').status, 'new');
assert.equal(storage.dump('petbank_minecraft_expedition_state_v2_profile-b'), undefined);

activeId.value = 'profile-a';
assert.deepEqual(JSON.parse(JSON.stringify(window.MinecraftVocabExpedition.readState(regions, 'profile-a').wordCardIds)), ['stone']);
assert.equal(window.MinecraftVocabSession.readState('profile-a').profileId, 'profile-a');
assert.equal(window.EnglishVocabProgress.get('stone').status, 'learning');
assert.equal(aSession.state.profileId, 'profile-a');

assert.match(pageSource, /petbank_minecraft_vocab_level_v1/);
assert.match(pageSource, /petbank_minecraft_vocab_band_v1/);
assert.match(pageSource, /pageGeneration/);
assert.match(pageSource, /selectionRequestId/);
assert.match(pageSource, /preserveBridgeContext/);
assert.match(pageSource, /MinecraftVocabExplorationBridge\?\.stop/);
assert.match(bridgeSource, /stop/);
assert.match(registry, /petbank_minecraft_expedition_state_v2_\*/);
assert.match(registry, /petbank_minecraft_vocab_level_v1_\*/);

console.log('minecraft vocab profile isolation: PASS');
