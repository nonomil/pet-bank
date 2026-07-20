import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const packageRoot = 'prj/学习机玩法原型';
const packageDir = path.join(repoRoot, packageRoot);
const manifestPath = path.join(repoRoot, 'scripts', 'runtime-asset-manifests', 'learning-arcade.json');
const indexPath = path.join(packageDir, 'assets', 'generated', 'english-typing-index.json');
const gamePath = path.join(packageDir, 'game.js');
const artifactArg = process.argv[2];
const artifactRoot = artifactArg ? path.resolve(repoRoot, artifactArg) : null;
const shardIds = [
    'minecraft',
    'kindergarten',
    'elementary',
    'junior_high',
    'core-english',
    'extension-english'
];

function fail(message) {
    console.error(`FAIL learning arcade vocab shards contract: ${message}`);
    process.exitCode = 1;
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertManifestPath(value, label) {
    assert.equal(typeof value, 'string', `${label} must be a string`);
    assert.ok(value && !value.startsWith('/') && !value.includes('..'), `${label} must stay inside the package`);
}

assert.ok(fs.existsSync(manifestPath), 'learning arcade manifest must exist');
assert.ok(fs.existsSync(indexPath), 'learning arcade vocab index must exist');
const manifest = readJson(manifestPath);
const index = readJson(indexPath);
const game = fs.readFileSync(gamePath, 'utf8');

assert.equal(index.version, 1, 'vocab index version must be 1');
assert.equal(index.id, 'english-typing-index', 'vocab index must identify the sharded typing runtime');
assert.ok(Array.isArray(index.packs) && index.packs.length >= 8, 'vocab index must expose all word pack metadata');
assert.match(game, /english-typing-index\.json/, 'HTTP typing runtime must load the vocab index');
assert.ok(
    !manifest.runtimeFiles.includes('assets/generated/english-typing-unified.json'),
    'unified typing JSON must not remain an HTTP runtime file after sharding'
);
assert.ok(
    manifest.excludedPrefixes.includes('assets/generated/english-typing-unified.json'),
    'unified typing JSON must be explicitly excluded from Pages after sharding'
);
assert.ok(
    manifest.runtimeFiles.includes('assets/generated/english-typing-index.json'),
    'vocab index must be published'
);

const packsById = new Map(index.packs.map(pack => [pack.id, pack]));
for (const packId of shardIds) {
    const pack = packsById.get(packId);
    assert.ok(pack, `vocab index must include shard metadata: ${packId}`);
    assert.ok(Array.isArray(pack.files) && pack.files.length === 1, `single-pack entry must have one shard file: ${packId}`);
    assertManifestPath(pack.files[0], `shard file for ${packId}`);
    assert.ok(fs.existsSync(path.join(packageDir, 'assets', 'generated', pack.files[0])), `missing source shard: ${pack.files[0]}`);
    assert.ok(
        manifest.runtimeFiles.includes(`assets/generated/${pack.files[0]}`),
        `shard must be published: ${pack.files[0]}`
    );
}

for (const [packId, expectedFiles] of [
    ['all', shardIds.slice(0, 4)],
    ['curriculum-all', shardIds.slice(4)]
]) {
    const pack = packsById.get(packId);
    assert.ok(pack, `vocab index must include aggregate pack metadata: ${packId}`);
    assert.deepEqual(pack.files, expectedFiles.map(id => packsById.get(id).files[0]), `aggregate pack files must be explicit: ${packId}`);
}

if (artifactRoot) {
    assert.ok(fs.existsSync(artifactRoot), `missing artifact: ${artifactArg}`);
    const publishedFiles = [];
    const stack = [artifactRoot];
    while (stack.length) {
        const current = stack.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const absolute = path.join(current, entry.name);
            if (entry.isDirectory()) stack.push(absolute);
            else publishedFiles.push(path.relative(artifactRoot, absolute).split(path.sep).join('/'));
        }
    }
    const publishedPrefix = `${packageRoot}/assets/generated/`;
    assert.ok(publishedFiles.includes(`${publishedPrefix}english-typing-index.json`), 'vocab index must be in the artifact');
    for (const packId of shardIds) {
        const shardFile = packsById.get(packId).files[0];
        assert.ok(publishedFiles.includes(`${publishedPrefix}${shardFile}`), `shard must be in the artifact: ${shardFile}`);
    }
    for (const sourceOnlyFile of [
        'english-typing-unified.json',
        'english-typing-unified.js'
    ]) {
        assert.ok(!publishedFiles.includes(`${publishedPrefix}${sourceOnlyFile}`), `source-only typing data leaked: ${sourceOnlyFile}`);
    }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(artifactRoot
    ? `PASS learning arcade vocab shards contract: ${path.relative(repoRoot, artifactRoot)}`
    : 'PASS learning arcade vocab shards source contract');
