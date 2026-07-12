import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('data/story-packs/02-space-exploration');
const manifestPath = path.join(root, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const expectedSceneIds = ['forest', 'beach', 'candy', 'waterfall', 'underwater', 'desert', 'mountain', 'cave', 'castle', 'volcano', 'space', 'stargarden'];
const expectedTypes = ['narrate', 'discover', 'math', 'choice', 'encounter'];
const moods = new Set(['happy', 'surprised', 'worried', 'proud']);

assert.equal(manifest.id, '02-space-exploration');
assert.equal(manifest.active, false, '第二故事必须先保持未启用');
assert.deepEqual(manifest.sceneIds, expectedSceneIds);
assert.equal(manifest.audience, '幼小衔接');

for (const sceneId of expectedSceneIds) {
  const file = path.join(root, `${sceneId}.json`);
  assert.ok(fs.existsSync(file), `missing story scene: ${sceneId}`);
  const scene = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(scene.id, sceneId);
  assert.equal(scene.events.length, 5, `${sceneId}: expected five events`);
  assert.deepEqual(scene.events.map((event) => event.type), expectedTypes, `${sceneId}: event order`);
  assert.deepEqual(scene.chapter_flow.see, [0, 1]);
  assert.equal(scene.chapter_flow.choose, 3);
  assert.deepEqual(scene.chapter_flow.challenge, { math: 2, battle: 4 });
  assert.ok(scene.chapter_skill);
  assert.ok(scene.ending_text);

  for (const event of scene.events) {
    assert.ok(event.id.startsWith(`${sceneId}.`));
    assert.ok(event.text && event.shortText && event.detailText);
    assert.ok(moods.has(event.petMood), `${event.id}: invalid petMood`);
    assert.ok([...event.shortText].length <= 24, `${event.id}: shortText too long`);
  }

  const math = scene.events[2];
  assert.ok(math.question && math.hint && math.explanation);
  assert.ok(math.options.includes(math.answer), `${sceneId}: answer missing from options`);
  assert.ok(math.options.length >= 3);

  const choice = scene.events[3];
  assert.ok(Array.isArray(choice.options) && choice.options.length >= 2);
  for (const option of choice.options) assert.ok(option.text && option.reward && option.item);
}

console.log(`PASS: ${expectedSceneIds.length} scenes in ${manifest.id}`);
