import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const scriptPath = path.join(repoRoot, 'scripts', 'assemble-pixel-story-audio-artifact.mjs');
const providedArtifact = Boolean(process.argv[2]);
const artifactRoot = providedArtifact ? path.resolve(repoRoot, process.argv[2]) : path.join(repoRoot, 'tmp', 'pixel-story-audio-artifact-contract');

function walk(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const target = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...walk(target));
        else files.push(target);
    }
    return files;
}

if (!providedArtifact) execFileSync(process.execPath, [scriptPath, artifactRoot, 'test-v1'], { cwd: repoRoot, stdio: 'inherit' });
const manifest = JSON.parse(fs.readFileSync(path.join(artifactRoot, 'manifest.json'), 'utf8'));
assert.equal(manifest.id, 'pixel-worlds-story-audio');
assert.equal(manifest.format, 'OGG');
assert.equal(manifest.subtype, 'OPUS');
assert.equal(manifest.clipCount, 960);
const files = walk(artifactRoot).map((file) => path.relative(artifactRoot, file).split(path.sep).join('/'));
assert.equal(files.filter((file) => file.endsWith('.ogg')).length, 960);
assert.equal(files.filter((file) => file.endsWith('.wav')).length, 0);
assert.equal(files.filter((file) => file === 'manifest.json').length, 1);
if (!providedArtifact) fs.rmSync(artifactRoot, { recursive: true, force: true });
console.log('PASS pixel story audio artifact: clips=960');
