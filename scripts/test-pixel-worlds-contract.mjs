import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packRoot = path.join(root, 'data', 'story-packs', '05-pixel-worlds-story');
const manifestPath = path.join(packRoot, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const map = fs.readFileSync(path.join(root, 'js', 'pixel-story-map.js'), 'utf8');
const engine = fs.readFileSync(path.join(root, 'js', 'pixel-story-engine.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.equal(manifest.id, 'pixel-worlds-story');
assert.equal(manifest.status, 'active');
assert.equal(manifest.levelCount, 60);
assert.equal(manifest.bonusLevelCount, 20);
assert.equal(manifest.learningPolicy, 'recognition-only');
assert.deepEqual(manifest.worlds.map((world) => world.id), ['sci-fi', 'forest', 'block']);
assert.deepEqual(manifest.worlds.map((world) => world.nodes.length), [20, 20, 20]);
assert.equal(manifest.bonusTracks.length, 1);
assert.equal(manifest.bonusTracks[0].id, 'detective');
assert.equal(manifest.bonusTracks[0].nodes.length, 20);

const levelIds = [];
for (const world of manifest.worlds) {
  assert.ok(world.background && fs.existsSync(path.join(root, world.background)), `${world.id}: map background exists`);
  for (const node of world.nodes) {
    levelIds.push(node.levelId);
    assert.ok(node.icon && fs.existsSync(path.join(root, node.icon)), `${node.levelId}: node icon exists`);
    const levelPath = path.join(packRoot, 'levels', `${node.levelId}.json`);
    const level = fs.existsSync(levelPath)
      ? JSON.parse(fs.readFileSync(levelPath, 'utf8'))
      : node;
    if (!fs.existsSync(levelPath)) assert.ok(node.background && fs.existsSync(path.join(root, node.background)), `${node.levelId}: inline background exists`);
    assert.equal(level.levelId, node.levelId);
    assert.equal(level.worldId || node.worldId || world.id, world.id);
    assert.ok(Array.isArray(level.scenes) && level.scenes.length > 0 || node.prompt, `${node.levelId}: scenes or inline story`);
    const scenes = level.scenes || [{ background: node.background, lines: [{ type: 'activity', activityType: node.activityType, prompt: node.prompt, actions: node.actions }] }];
    assert.ok(scenes.some((scene) => scene.lines.some((line) => line.type === 'activity') || node.prompt), `${node.levelId}: story activity`);
    for (const scene of scenes) {
      assert.ok(scene.background || node.background, `${node.levelId}/${scene.sceneId || 'inline'}: background`);
      for (const line of scene.lines) {
        assert.ok(['narration', 'dialogue', 'activity'].includes(line.type), `${node.levelId}: no quiz line types`);
        const text = line.type === 'activity' ? line.prompt : line.text;
        assert.equal(typeof text, 'string');
        assert.ok(text.length > 0, `${node.levelId}: line text`);
        if (line.type === 'activity') {
          assert.ok(['scan', 'collect', 'repair', 'route', 'build', 'care'].includes(line.activityType), `${node.levelId}: known activity type`);
          assert.ok(Array.isArray(line.actions) && line.actions.length >= 2, `${node.levelId}: activity actions`);
          assert.ok(line.actions.every((action) => action.label && action.feedback), `${node.levelId}: activity feedback`);
        }
      }
    }
  }
}
assert.equal(new Set(levelIds).size, 60);
for (const node of manifest.bonusTracks[0].nodes) {
  assert.ok(node.levelId && node.prompt && node.activityType, `${node.levelId}: detective mini-game metadata`);
  assert.ok(node.background && fs.existsSync(path.join(root, node.background)), `${node.levelId}: detective background exists`);
  assert.ok(node.icon && fs.existsSync(path.join(root, node.icon)), `${node.levelId}: detective icon exists`);
  assert.ok(Array.isArray(node.actions) && node.actions.length >= 2, `${node.levelId}: detective actions`);
}
assert.match(index, /data-home-explore-mode="block"/);
assert.match(app, /openHomeExploreMode/);
assert.match(app, /block/);
assert.match(map, /worlds/);
assert.match(engine, /line\.type === 'activity'/);

console.log(`PASS pixel worlds contract: ${manifest.worlds.length} worlds / ${manifest.levelCount} levels`);
