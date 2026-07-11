import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sceneIds = ['forest', 'beach', 'mountain', 'space', 'candy', 'cave', 'waterfall', 'desert', 'underwater', 'castle', 'volcano', 'stargarden'];
const storyTypes = ['narrate', 'discover', 'math', 'choice', 'encounter'];
const travelRewardScenes = sceneIds;

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(repo, relativePath), 'utf8'));
}

function assertShortCopy(event, sceneId) {
    assert.equal(typeof event.shortText, 'string', `${sceneId}: ${event.type} needs shortText`);
    assert.ok(event.shortText.trim().length >= 4, `${sceneId}: ${event.type} shortText is too short`);
    assert.ok(event.shortText.trim().length <= 24, `${sceneId}: ${event.type} shortText is too long`);
    assert.equal(typeof event.petMood, 'string', `${sceneId}: ${event.type} needs petMood`);
}

for (const sceneId of sceneIds) {
    const story = readJson(`data/stories/${sceneId}.json`);
    assert.equal(story.id, sceneId, `${sceneId}: id mismatch`);
    assert.equal(typeof story.chapter_skill, 'string', `${sceneId}: missing chapter_skill`);
    assert.ok(story.chapter_skill.trim(), `${sceneId}: empty chapter_skill`);
    assert.equal(typeof story.ending_text, 'string', `${sceneId}: missing ending_text`);
    assert.ok(story.ending_text.trim(), `${sceneId}: empty ending_text`);
    assert.ok(Array.isArray(story.events), `${sceneId}: events must be an array`);
    assert.equal(story.events.length, 5, `${sceneId}: expected five events`);
    assert.deepEqual(story.events.map((event) => event.type), storyTypes, `${sceneId}: event order changed`);
    for (const event of story.events) assertShortCopy(event, sceneId);
    const math = story.events.find((event) => event.type === 'math');
    assert.equal(typeof math.question, 'string', `${sceneId}: math question missing`);
    assert.ok(math.question.trim(), `${sceneId}: math question empty`);
    assert.ok(Array.isArray(math.options) && math.options.length >= 2, `${sceneId}: math options missing`);
    const choice = story.events.find((event) => event.type === 'choice');
    assert.ok(Array.isArray(choice.options) && choice.options.length >= 2, `${sceneId}: choice options missing`);
    for (const option of choice.options) {
        assert.equal(typeof option.reward, 'string', `${sceneId}: choice reward missing`);
        assert.ok(option.reward.trim(), `${sceneId}: choice reward empty`);
    }
    const encounter = story.events.find((event) => event.type === 'encounter');
    assert.equal(typeof encounter.text, 'string', `${sceneId}: encounter text missing`);
    assert.ok(encounter.text.trim(), `${sceneId}: encounter text empty`);
}

const rewards = readJson('data/travel-rewards.json');
for (const sceneId of travelRewardScenes) {
    const scene = rewards.scenes?.[sceneId];
    assert.ok(scene, `travel reward missing: ${sceneId}`);
    for (const field of ['asset', 'cardAsset', 'fridgeAsset', 'petCardAsset']) {
        if (scene.assetStatus === 'verified') {
            assert.equal(scene.assetStatuses?.[field], 'verified', `${sceneId}: ${field} is not verified`);
            assert.ok(fs.existsSync(path.join(repo, scene[field])), `${sceneId}: missing ${scene[field]}`);
        } else {
            assert.equal(scene.assetStatuses?.[field], 'placeholder', `${sceneId}: ${field} placeholder status`);
            assert.equal(scene[field], '', `${sceneId}: ${field} placeholder value`);
        }
    }
}

const runtime = fs.readFileSync(path.join(repo, 'js/exploration-detail.js'), 'utf8');
assert.match(runtime, /storyData\[STORY_SCENE_IDS\[i\]\] = s/);
assert.match(runtime, /storyData\[currentScene\.id\]\?\.ending_text/);
assert.doesNotMatch(runtime, /let\s+SCENE_ENDING\s*=/);
assert.doesNotMatch(runtime, /let\s+sceneEvents\s*=/);
assert.doesNotMatch(runtime, /硬编码 sceneEvents/);

console.log(`narrative closure contract passed: ${sceneIds.length} stories, ${travelRewardScenes.length} travel reward scenes`);
