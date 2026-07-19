import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bridgePath = path.join(root, 'js', 'minecraft-vocab-exploration-bridge.js');
const bridgeSource = fs.existsSync(bridgePath) ? fs.readFileSync(bridgePath, 'utf8') : '';
const mapSource = fs.readFileSync(path.join(root, 'js', 'pixel-story-map.js'), 'utf8');
const pageSource = fs.readFileSync(path.join(root, 'js', 'minecraft-vocab-page.js'), 'utf8');
const runtimeSource = fs.readFileSync(path.join(root, 'js', 'runtime-loader.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'story-packs', '05-pixel-worlds-story', 'manifest.json'), 'utf8'));
const blockTrack = (manifest.worlds || []).find(track => track.id === 'block');
const blockNode = (blockTrack?.nodes || []).find(node => node.levelId === 'block-01');

assert.match(bridgeSource, /MinecraftVocabExplorationBridge/, 'bridge namespace should be exposed');
assert.match(bridgeSource, /canUseAbility/);
assert.match(bridgeSource, /buildStoryContext/);
assert.match(bridgeSource, /openExpedition/);
assert.match(bridgeSource, /returnToExploration/);
assert.match(bridgeSource, /stop/);
assert.match(mapSource, /vocabRegionId/);
assert.match(mapSource, /openExpedition/);
assert.match(pageSource, /consumeOpenContext/);
assert.match(pageSource, /returnToExploration/);
assert.match(runtimeSource, /minecraft-vocab-exploration-bridge\.js/);

assert.equal(blockNode?.vocabRegionId, 'grassland-trail', 'the first block story node should point to the low-age expedition region');
assert.equal(blockNode?.requiredAbility, '', 'the first block story node should not require a hidden ability');

const switchCalls = [];
const dispatched = [];
function CustomEvent(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
}
const window = {
    CustomEvent,
    dispatchEvent(event) { dispatched.push(event); },
    switchPage(page) { switchCalls.push(page); },
    ProfileManager: { getActiveId: () => 'profile-a' },
    MinecraftVocabExpedition: {
        readState() {
            return { level: 2, experience: 24, wordCardIds: ['stone'], abilities: ['pathfinder'] };
        }
    }
};
vm.runInNewContext(bridgeSource, { window, console: { warn() {} } });
const bridge = window.MinecraftVocabExplorationBridge;
assert.ok(bridge);
assert.equal(bridge.canUseAbility('pathfinder', 'profile-a'), true);
assert.equal(bridge.canUseAbility('ore-breaker', 'profile-a'), false);
assert.deepEqual(JSON.parse(JSON.stringify(bridge.buildStoryContext('grassland-trail', 'profile-a'))), {
    regionId: 'grassland-trail',
    profileId: 'profile-a',
    level: 2,
    experience: 24,
    wordCards: ['stone'],
    abilities: ['pathfinder']
});

const opened = bridge.openExpedition('grassland-trail', {
    returnTarget: 'explore',
    storyNodeId: 'block-01',
    requiredAbility: ''
});
assert.equal(opened.regionId, 'grassland-trail');
assert.equal(opened.returnTarget, 'explore');
assert.equal(switchCalls.at(-1), 'minecraft-vocab');
assert.equal(bridge.getReturnContext().storyNodeId, 'block-01');

const returned = bridge.returnToExploration({ reason: 'test' });
assert.equal(returned.returnTarget, 'explore');
assert.equal(switchCalls.at(-1), 'explore');
assert.equal(dispatched.at(-1).type, 'petbank:minecraft-vocab-return');
bridge.stop();
assert.equal(bridge.getReturnContext(), null);

console.log('minecraft exploration bridge: PASS');
