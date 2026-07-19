import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'scripts', 'runtime-asset-manifests', 'pixel-worlds-story.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const storyManifestPath = path.join(repoRoot, 'data', 'story-packs', '05-pixel-worlds-story', 'manifest.json');
const storyManifest = JSON.parse(fs.readFileSync(storyManifestPath, 'utf8'));
const providedArtifact = process.argv[2] ? path.resolve(repoRoot, process.argv[2]) : null;

function walkFiles(root) {
    const files = [];
    const pending = [root];
    while (pending.length) {
        const current = pending.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const fullPath = path.join(current, entry.name);
            if (entry.isDirectory()) pending.push(fullPath);
            else if (entry.isFile()) files.push(fullPath);
        }
    }
    return files.sort();
}

function assertSourceManifest() {
    assert.equal(manifest.id, 'pixel-worlds-story');
    assert.equal(manifest.releaseStage, 'full-runtime-pool');
    const mapBackgrounds = [...(storyManifest.worlds || []), ...(storyManifest.bonusTracks || [])]
        .map((track) => track.background)
        .filter(Boolean);
    assert.ok(mapBackgrounds.length > 0, 'story manifest should define map backgrounds');
    assert.ok(mapBackgrounds.every((background) => background.endsWith('.webp')),
        `story map backgrounds should use published WebP variants: ${mapBackgrounds.join(', ')}`);
    mapBackgrounds.forEach((background) => {
        assert.ok(fs.existsSync(path.join(repoRoot, background)), `story map background is missing: ${background}`);
    });
    for (const relative of [...manifest.entry, ...manifest.data, ...(manifest.sourceData || [])]) {
        assert.ok(fs.existsSync(path.join(repoRoot, relative)), `manifest source is missing: ${relative}`);
    }
    for (const prefix of manifest.runtimePrefixes) {
        const directory = path.join(repoRoot, prefix);
        assert.ok(fs.existsSync(directory), `manifest runtime prefix is missing: ${prefix}`);
        assert.ok(walkFiles(directory).length > 0, `manifest runtime prefix is empty: ${prefix}`);
    }
    const audioSet = manifest.audioSets[0];
    const audioFiles = walkFiles(path.join(repoRoot, audioSet.sourceDir));
    assert.equal(audioFiles.filter((file) => file.endsWith('.wav')).length, audioSet.clipCount);
    assert.equal(audioFiles.filter((file) => file.endsWith('.ogg')).length, audioSet.clipCount);
}

function assertArtifact(artifactRoot) {
    const storyDataRoot = path.join(artifactRoot, 'data', 'story-packs', '05-pixel-worlds-story');
    assert.ok(fs.existsSync(path.join(storyDataRoot, 'audio-index.json')), 'runtime audio root index must be published');
    assert.equal(fs.existsSync(path.join(storyDataRoot, 'audio-manifest.json')), false,
        'source full audio manifest must stay out of the Pages artifact');
    const root = path.join(artifactRoot, 'assets', 'story', 'pixel-worlds-v1');
    assert.ok(fs.existsSync(root), 'pixel worlds runtime root must be published');
    const files = walkFiles(root);
    assert.equal(files.filter((file) => file.endsWith('.wav')).length, 0, 'source WAV files must stay out of Pages');
    assert.equal(files.filter((file) => file.endsWith('.png')).length, 0, 'source map PNG files must stay out of Pages');
    assert.equal(files.filter((file) => file.endsWith('.webp')).length, 276, 'published story images must match the runtime set');
    assert.equal(files.filter((file) => file.endsWith('.ogg')).length, manifest.audioSets[0].clipCount,
        'published story audio must match the runtime set');
    assert.ok(files.every((file) => ['.webp', '.ogg'].includes(path.extname(file).toLowerCase())),
        'pixel worlds asset root must contain only converted runtime media');
}

assertSourceManifest();
if (providedArtifact) {
    assertArtifact(providedArtifact);
    console.log(`PASS pixel story publish contract: ${providedArtifact}`);
} else {
    console.log('PASS pixel story publish manifest contract');
}
