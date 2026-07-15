import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'assets', 'learn', 'english-vocab', 'minecraft-cards', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const output = execFileSync(process.execPath, ['scripts/build-minecraft-vocab-local-media.mjs'], {
    cwd: new URL('..', import.meta.url),
    encoding: 'utf8'
});
const report = JSON.parse(output);

assert.equal(report.cardCount, 96);
assert.equal(report.mappedCount, 96);
assert.deepEqual(report.unresolved, []);
assert.deepEqual(report.lowConfidence, []);
assert.equal(report.mapping.filter(item => item.sourceQuality === 'gpt-generated').map(item => item.word).join(','), 'disk');

const expected = new Map([
    ['friend', 'tamed-wolf'],
    ['house', 'new-village'],
    ['white', 'White Wool']
]);
for (const [word, sourceToken] of expected) {
    const item = report.mapping.find(entry => entry.word === word);
    assert.ok(item, `missing mapping for ${word}`);
    assert.match(item.sourceKey, new RegExp(sourceToken, 'i'));
    assert.equal(item.status, 'anki-extracted');
}
const generatedDisk = report.mapping.find(entry => entry.word === 'disk');
assert.match(generatedDisk.sourceKey, /minecraft-disk-gpt-image-2/i);
assert.equal(generatedDisk.status, 'gpt-generated');
assert.equal(manifest.presentationVersion, 1);
assert.equal(manifest.assets.length, 96);

for (const item of report.mapping) {
    assert.match(item.image, /^assets\/learn\/english-vocab\/minecraft-cards\/card-/);
    assert.ok(item.sourcePath, `${item.word} should include a source path`);
}
for (const item of manifest.assets) {
    assert.deepEqual(item.dimensions, [512, 512], `${item.word} should use a square presentation canvas`);
    assert.match(item.presentation, /^normalized-/);
    assert.ok(fs.existsSync(path.join(repoRoot, item.path)), `${item.word} presentation asset should exist`);
}

console.log('minecraft vocab media mapping: PASS');
