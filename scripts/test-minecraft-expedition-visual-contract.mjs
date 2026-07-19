import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assetRoot = path.join(root, 'assets', 'learn', 'english-vocab', 'generated', 'minecraft-expedition');
const manifest = JSON.parse(fs.readFileSync(path.join(assetRoot, 'manifest.json'), 'utf8'));
const pack = JSON.parse(fs.readFileSync(path.join(root, 'data', 'learn', 'minecraft-expedition', 'camp-regions.json'), 'utf8'));
const manifestByPath = new Map(manifest.assets.map(asset => [asset.path, asset]));
const storyAssets = [
    'story-camp', 'story-grassland', 'story-village', 'story-deep-mine',
    'story-nether', 'story-end', 'story-dragon'
];

assert.equal(manifest.schemaVersion, 1);
assert.match(manifest.textOverlayPolicy, /HTML\/CSS/);
assert.match(manifest.textOverlayPolicy, /no readable text/i);
assert.equal(manifest.assets.length, 13);

for (const asset of manifest.assets) {
    assert.ok(asset.id && asset.purpose && asset.path && asset.source, 'every runtime visual needs id, purpose, path, and source');
    assert.equal(asset.runtime, true, `${asset.id} must be explicitly runtime-safe`);
    assert.ok(!asset.path.startsWith('docs/'), `${asset.id} must not reference docs content`);
    const filePath = path.join(root, asset.path);
    assert.ok(fs.existsSync(filePath), `${asset.id} image is missing`);
    const png = fs.readFileSync(filePath);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${asset.id} must be a PNG`);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], asset.dimensions, `${asset.id} manifest dimensions must match the PNG`);
}

const promptRoot = path.join(root, manifest.promptRoot.replaceAll('/', path.sep));
for (const id of storyAssets) {
    const entry = manifest.assets.find(asset => asset.id === id);
    assert.ok(entry, `${id} must have a manifest entry`);
    const prompt = path.join(promptRoot, `${id}.txt`);
    assert.ok(fs.existsSync(prompt), `${id} must keep its generation prompt beside the runtime asset`);
    const text = fs.readFileSync(prompt, 'utf8');
    assert.match(text, /voxel/i);
    assert.match(text, /no text/i);
    assert.match(text, /no (?:logos|watermark)/i);
}

const referencedImages = [
    pack.camp.mapImage,
    pack.camp.storyImage,
    ...pack.regions.flatMap(region => [region.sceneImage, region.storyImage, region.storyFinalImage].filter(Boolean))
];
for (const imagePath of referencedImages) assert.ok(manifestByPath.has(imagePath), `${imagePath} must be covered by the runtime manifest`);
assert.equal(new Set(referencedImages).size, referencedImages.length, 'runtime story image references must not duplicate a different visual role');

console.log(`minecraft expedition visual contract: PASS (${manifest.assets.length} PNG assets / ${storyAssets.length} story prompts)`);
