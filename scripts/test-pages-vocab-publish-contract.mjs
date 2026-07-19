import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const providedArtifactRoot = process.argv[2] ? path.resolve(repoRoot, process.argv[2]) : null;
const artifactRoot = providedArtifactRoot || fs.mkdtempSync(path.join(os.tmpdir(), 'petbank-vocab-publish-'));

try {
    if (!providedArtifactRoot) {
        execFileSync(process.execPath, ['scripts/assemble-pages-artifact.mjs', artifactRoot], {
            cwd: repoRoot,
            stdio: 'ignore'
        });
    }

    const requiredRuntimeFiles = [
        'data/vocab/english-minecraft/manifest.json',
        'data/vocab/english-minecraft/views/all.json',
        'data/vocab/english-minecraft/views/typing-view.json',
        'data/vocab/word-memory-combined/manifest.json',
        'data/vocab/word-memory-combined/views/all.json',
        'data/vocab/core-english/manifest.json',
        'data/vocab/core-english/views/core.json',
        'data/vocab/extension-english/manifest.json',
        'data/vocab/extension-english/views/extension.json'
    ];
    for (const relative of requiredRuntimeFiles) {
        assert.ok(fs.existsSync(path.join(artifactRoot, relative)), `${relative} must remain published`);
    }

    for (const relative of [
        'data/vocab/english-minecraft/narration-manifest.json',
        'data/vocab/english-minecraft/audio-manifest.json'
    ]) {
        assert.equal(fs.existsSync(path.join(artifactRoot, relative)), false, `${relative} must stay out of Pages`);
    }

    const forbiddenSourcePaths = [
        'data/vocab/单词库_分级',
        'data/vocab/external',
        'data/vocab/单词库_分级/_archive'
    ];
    for (const relative of forbiddenSourcePaths) {
        assert.equal(fs.existsSync(path.join(artifactRoot, relative)), false, `${relative} must not be published`);
    }
} finally {
    if (!providedArtifactRoot) fs.rmSync(artifactRoot, { recursive: true, force: true });
}

console.log('PASS Pages vocab publish contract');
