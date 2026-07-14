import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runtimeRoot = 'assets/learn/english-vocab/generated/minecraft-vocab-ui-pack/';
const packDir = path.join(repoRoot, runtimeRoot);
const manifestPath = path.join(packDir, 'manifest.json');
const expectedIds = [
    'stage-warmup', 'stage-new-word', 'stage-recall', 'stage-scene',
    'reward-chest', 'reward-star', 'learning-companion',
    'card-corner-tl', 'card-corner-tr', 'card-corner-bl', 'card-corner-br'
];

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.id, 'minecraft-vocab-ui-pack');
assert.equal(manifest.runtimeRoot, runtimeRoot);
assert.equal(manifest.assets.length, expectedIds.length);
assert.deepEqual(manifest.assets.map(asset => asset.id), expectedIds);

for (const asset of manifest.assets) {
    assert.ok(asset.path.startsWith(runtimeRoot), `${asset.id}: runtime path`);
    assert.match(asset.path, /\.png$/);
    const filePath = path.join(repoRoot, asset.path.replaceAll('/', path.sep));
    assert.ok(fs.existsSync(filePath), `${asset.id}: formal file exists`);
    const dimensions = JSON.parse(spawnSync('python', ['-X', 'utf8', '-c', [
        'import json, sys',
        'from PIL import Image',
        'image = Image.open(sys.argv[1])',
        'print(json.dumps({"size": list(image.size), "mode": image.mode}))'
    ].join('; '), filePath], { encoding: 'utf8', windowsHide: true }).stdout);
    assert.deepEqual(dimensions.size, asset.dimensions, `${asset.id}: dimensions`);
    assert.equal(dimensions.mode, 'RGBA', `${asset.id}: transparent PNG`);
}

const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'petbank-minecraft-vocab-ui-'));
try {
    const result = spawnSync(process.execPath, ['scripts/assemble-pages-artifact.mjs', artifactDir], {
        cwd: repoRoot,
        encoding: 'utf8',
        windowsHide: true,
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const publishedDir = path.join(artifactDir, runtimeRoot.replaceAll('/', path.sep));
    const publishedFiles = fs.readdirSync(publishedDir).sort();
    const expectedFiles = ['manifest.json', ...manifest.assets.map(asset => path.basename(asset.path))].sort();
    assert.deepEqual(publishedFiles, expectedFiles, 'Pages publishes only manifest and formal UI assets');
} finally {
    fs.rmSync(artifactDir, { recursive: true, force: true });
}

console.log(`PASS Minecraft vocabulary UI assets: ${expectedIds.length} transparent components`);
