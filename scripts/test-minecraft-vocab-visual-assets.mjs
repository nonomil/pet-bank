import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const visualRoot = path.join(repoRoot, 'assets', 'learn', 'english-vocab', 'generated', 'minecraft-vocab-visual-pack');
const manifestPath = path.join(visualRoot, 'manifest.json');

const expectedMainIds = [
    'study-camp-hero',
    'warmup-grove',
    'new-word-mine',
    'recall-bridge',
    'scene-village',
    'reward-word-stars',
    'card-frame-sheet',
];
const expectedWorkbenchIds = ['workbench-bg', 'detail-bg'];
const allowedDimensions = new Set([
    '1536x864',
    '1536x1024',
    '1024x1024',
    '1024x1536',
]);
const runtimeRoot = 'assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/';
const unsafePathPattern = /(?:^|\/)(?:docs|tmp|secrets?|keys?)(?:\/|$)|(?:token|api[_-]?key|authorization|bearer)/i;
const externalUrlPattern = /^(?:https?:)?\/\//i;

function readManifest() {
    assert.ok(fs.existsSync(manifestPath), `manifest exists: ${path.relative(repoRoot, manifestPath)}`);
    let manifest;
    assert.doesNotThrow(() => {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }, 'manifest is valid JSON');
    assert.equal(manifest.id, 'minecraft-vocab-visual-pack', 'manifest id');
    assert.equal(manifest.schemaVersion, 1, 'manifest schema version');
    assert.equal(manifest.runtimeRoot, runtimeRoot, 'manifest runtime root');
    assert.ok(Array.isArray(manifest.assets), 'manifest assets is an array');
    return manifest;
}

function assertRuntimePath(asset) {
    const value = String(asset.path || '');
    assert.ok(value, `${asset.id}: runtime path is declared`);
    assert.ok(!externalUrlPattern.test(value), `${asset.id}: runtime path must be local`);
    assert.ok(!unsafePathPattern.test(value), `${asset.id}: runtime path must not expose docs, temp, or secret material`);
    assert.ok(value.startsWith(runtimeRoot), `${asset.id}: runtime path stays inside the visual pack`);
    assert.ok(/\.(?:png|webp)$/i.test(value), `${asset.id}: runtime path uses PNG or WebP`);
}

function decodeWithPillow(filePath) {
    const script = [
        'import sys',
        'from PIL import Image',
        'image = Image.open(sys.argv[1])',
        'image.verify()',
    ].join('; ');
    const result = spawnSync('python', ['-c', script, filePath], {
        cwd: repoRoot,
        encoding: 'utf8',
        windowsHide: true,
    });
    assert.equal(result.status, 0, `${path.relative(repoRoot, filePath)} is decodable by Pillow: ${result.stderr.trim()}`);
}

function readDimensions(filePath, extension) {
    const bytes = fs.readFileSync(filePath);
    if (extension === '.png') {
        assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${filePath}: PNG signature`);
        assert.equal(bytes.toString('ascii', 12, 16), 'IHDR', `${filePath}: PNG IHDR`);
        return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
    }
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `${filePath}: WebP RIFF header`);
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `${filePath}: WebP signature`);
    const chunk = bytes.toString('ascii', 12, 16);
    if (chunk === 'VP8X') {
        return [1 + bytes.readUIntLE(24, 3), 1 + bytes.readUIntLE(27, 3)];
    }
    if (chunk === 'VP8 ') {
        const start = 20;
        assert.equal(bytes.readUIntLE(start + 6, 3), 0x2a019d, `${filePath}: VP8 key frame`);
        return [bytes.readUInt16LE(start + 8) & 0x3fff, bytes.readUInt16LE(start + 10) & 0x3fff];
    }
    if (chunk === 'VP8L') {
        const start = 20;
        assert.equal(bytes[start] & 0xff, 0x2f, `${filePath}: VP8L signature`);
        const bits = bytes.readUIntLE(21, 4);
        return [(bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1];
    }
    assert.fail(`${filePath}: unsupported WebP chunk ${chunk}`);
}

function assertAsset(asset) {
    assertRuntimePath(asset);
    const relativePath = asset.path.replaceAll('/', path.sep);
    const filePath = path.join(repoRoot, relativePath);
    assert.ok(fs.existsSync(filePath), `${asset.id}: formal image exists at ${asset.path}`);
    const extension = path.extname(filePath).toLowerCase();
    assert.ok(['.png', '.webp'].includes(extension), `${asset.id}: supported raster extension`);
    const dimensions = readDimensions(filePath, extension);
    assert.ok(allowedDimensions.has(`${dimensions[0]}x${dimensions[1]}`), `${asset.id}: dimensions ${dimensions[0]}x${dimensions[1]} are allowed`);
    assert.deepEqual(asset.dimensions, dimensions, `${asset.id}: manifest dimensions match the file`);
    assert.equal(asset.runtime, true, `${asset.id}: runtime asset is marked publishable`);
    decodeWithPillow(filePath);
}

function assertPagesAllowlist() {
    const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'petbank-minecraft-vocab-visual-'));
    try {
        const result = spawnSync(process.execPath, ['scripts/assemble-pages-artifact.mjs', artifactDir], {
            cwd: repoRoot,
            encoding: 'utf8',
            windowsHide: true,
        });
        assert.equal(result.status, 0, `Pages artifact assembly succeeds: ${result.stderr.trim()}`);
        const publishedRoot = path.join(artifactDir, runtimeRoot.replaceAll('/', path.sep));
        const publishedFiles = fs.readdirSync(publishedRoot).sort();
        const expectedFiles = ['manifest.json', ...manifest.assets.map((asset) => `${path.basename(asset.path, path.extname(asset.path))}.webp`)].sort();
        assert.deepEqual(publishedFiles, expectedFiles, 'Pages publishes only the visual manifest and formal root images');
    } finally {
        fs.rmSync(artifactDir, { recursive: true, force: true });
    }
}

const manifest = readManifest();
const assetsById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
assert.equal(manifest.assets.length, expectedMainIds.length + expectedWorkbenchIds.length, 'manifest declares exactly 9 visual assets');
assert.deepEqual(manifest.main?.assetIds, expectedMainIds, 'manifest declares the 7 main-site assets');
assert.deepEqual(manifest.workbench?.assetIds, expectedWorkbenchIds, 'manifest declares the 2 workbench assets');

const expectedIds = [...expectedMainIds, ...expectedWorkbenchIds];
const missingFiles = expectedIds
    .map((id) => assetsById.get(id))
    .filter((asset) => !fs.existsSync(path.join(repoRoot, asset.path.replaceAll('/', path.sep))))
    .map((asset) => asset.path);
assert.equal(missingFiles.length, 0, `formal images missing: ${missingFiles.join(', ')}`);

for (const id of expectedIds) {
    assert.ok(assetsById.has(id), `${id}: manifest entry exists`);
    assertAsset(assetsById.get(id));
}

assertPagesAllowlist();

console.log(`PASS Minecraft vocabulary visual assets: ${expectedMainIds.length} main + ${expectedWorkbenchIds.length} workbench`);
