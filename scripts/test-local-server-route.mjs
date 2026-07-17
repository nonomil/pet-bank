import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const port = 18765;
const child = spawn(process.execPath, ['scripts/local-server.mjs'], {
    cwd: root,
    env: { ...process.env, PETBANK_PORT: String(port), PETBANK_HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });

async function waitForServer() {
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`http://127.0.0.1:${port}/app/explore`);
            if (response.status === 200) return response;
        } catch (_) {
            // The child process may still be binding the port.
        }
        await new Promise((resolve) => setTimeout(resolve, 80));
    }
    throw new Error(`local server did not become ready: ${output}`);
}

try {
    const exploreResponse = await waitForServer();
    const exploreHtml = await exploreResponse.text();
    assert.match(exploreHtml, /<title>成长伙伴 · 萌宠冒险岛<\/title>/, 'deep explore route should serve the SPA shell');
    assert.doesNotMatch(exploreHtml, /<link\s+rel="preload"[^>]+href="(?:js|css)\//i, 'deep routes must not preload route-relative assets before the base is resolved');

    const assetResponse = await fetch(`http://127.0.0.1:${port}/js/app.js`);
    assert.equal(assetResponse.status, 200, 'static JavaScript assets should remain directly accessible');

    const audioResponse = await fetch(`http://127.0.0.1:${port}/assets/story/pixel-worlds-v1/audio/sf-01/sf-01.ogg`);
    assert.equal(audioResponse.status, 200, 'compressed story audio should remain directly accessible');
    assert.equal(audioResponse.headers.get('content-type'), 'audio/ogg', 'compressed story audio should use the OGG MIME type');

    const deepAssetResponse = await fetch(`http://127.0.0.1:${port}/app/js/app.js`);
    assert.equal(deepAssetResponse.status, 200, 'deep route-relative JavaScript assets should resolve to the shared root asset');

    const missingResponse = await fetch(`http://127.0.0.1:${port}/does-not-exist.txt`);
    assert.equal(missingResponse.status, 404, 'unknown file requests should remain 404');
    console.log('PASS local server deep route contract');
} finally {
    child.kill();
}
