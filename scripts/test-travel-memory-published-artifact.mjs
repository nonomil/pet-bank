import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const artifactDir = path.join(repoRoot, 'tmp', 'test-artifacts', 'travel-memory-pages-artifact');
const catalog = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'travel-rewards.json'), 'utf8'));

fs.rmSync(artifactDir, { recursive: true, force: true });
try {
    execFileSync(process.execPath, ['scripts/assemble-pages-artifact.mjs', artifactDir], {
        cwd: repoRoot,
        stdio: 'pipe'
    });

    for (const [sceneId, scene] of Object.entries(catalog.scenes)) {
        if (scene.assetStatus !== 'verified') continue;
        for (const field of ['asset', 'cardAsset', 'fridgeAsset', 'petCardAsset']) {
            const publishedPath = path.join(artifactDir, scene[field]);
            assert.ok(fs.existsSync(publishedPath), `${sceneId} ${field} is included in Pages artifact`);
        }
    }
} finally {
    fs.rmSync(artifactDir, { recursive: true, force: true });
}

console.log('PASS travel memory published artifact contract');
