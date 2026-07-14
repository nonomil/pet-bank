import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const packRoot = path.join(root, 'data', 'story-packs', '05-pixel-worlds-story');
const manifest = JSON.parse(fs.readFileSync(path.join(packRoot, 'manifest.json'), 'utf8'));
const tracks = [...(manifest.worlds || []), ...(manifest.bonusTracks || [])];
const allNodes = tracks.flatMap((track) => track.nodes.map((node) => ({ ...node, trackId: track.id })));

assert.equal(allNodes.length, 80, 'expected 80 story and detective nodes');
assert.equal(manifest.assetPlan?.sceneCount, 80, 'asset plan must cover every node');
const scenePaths = new Set();
for (const node of allNodes) {
    assert.ok(node.background, `${node.levelId}: background path`);
    assert.match(node.background, new RegExp(`^assets/story/pixel-worlds-v1/scenes/${node.trackId}/`));
    assert.ok(fs.existsSync(path.join(root, node.background)), `${node.levelId}: independent scene is generated`);
    assert.equal(scenePaths.has(node.background), false, `${node.levelId}: scene must not be reused`);
    scenePaths.add(node.background);
    const levelPath = path.join(packRoot, 'levels', `${node.levelId}.json`);
    assert.ok(fs.existsSync(levelPath), `${node.levelId}: level JSON exists`);
    const level = JSON.parse(fs.readFileSync(levelPath, 'utf8'));
    assert.ok(Array.isArray(level.scenes) && level.scenes.length > 0, `${node.levelId}: scenes exist`);
    for (const scene of level.scenes) {
        assert.equal(scene.background, node.background, `${node.levelId}: scene points to node background`);
        assert.ok(scene.sceneAssets?.characters?.length, `${node.levelId}: scene characters`);
        assert.ok(scene.sceneAssets?.props?.length, `${node.levelId}: scene props`);
        for (const prop of scene.sceneAssets.props) {
            assert.ok(fs.existsSync(path.join(root, prop)), `${node.levelId}: prop asset exists`);
        }
        for (const characterId of scene.sceneAssets.characters) {
            assert.ok(manifest.characters?.[characterId], `${node.levelId}: character ${characterId} exists`);
        }
    }
}

for (const character of Object.values(manifest.characters || {})) {
    if (character.sprite) assert.ok(fs.existsSync(path.join(root, character.sprite)), `${character.id}: sprite exists`);
}
for (const track of tracks) {
    const props = path.join(root, 'assets', 'story', 'pixel-worlds-v1', 'props', track.id);
    assert.ok(fs.existsSync(props), `${track.id}: props directory exists`);
}

const outDir = path.join(root, 'tmp', 'pixel-worlds-assets-artifact');
fs.rmSync(outDir, { recursive: true, force: true });
const result = spawnSync(process.execPath, ['scripts/assemble-pages-artifact.mjs', outDir], { cwd: root, encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr || result.stdout);
const publishedWorlds = path.join(outDir, 'assets', 'story', 'pixel-worlds-v1');
assert.ok(fs.existsSync(publishedWorlds), 'published pixel worlds assets directory exists');
for (const node of allNodes) {
    assert.ok(fs.existsSync(path.join(outDir, node.background)), `${node.levelId}: scene is published`);
    for (const prop of JSON.parse(fs.readFileSync(path.join(packRoot, 'levels', `${node.levelId}.json`), 'utf8')).scenes[0].sceneAssets.props) {
        assert.ok(fs.existsSync(path.join(outDir, prop)), `${node.levelId}: prop is published`);
    }
}
fs.rmSync(outDir, { recursive: true, force: true });
console.log(`PASS pixel worlds assets contract: ${scenePaths.size} unique scenes / ${allNodes.length} nodes`);
