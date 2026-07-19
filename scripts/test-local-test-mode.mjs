import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

import { browserLaunchOpts } from './playwright-browser.mjs';

const root = process.cwd();
const port = 18766;
const child = spawn(process.execPath, ['scripts/test-mode-server.mjs'], {
    cwd: root,
    env: { ...process.env, PETBANK_TEST_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });

try {
    const deadline = Date.now() + 8000;
    let response;
    while (Date.now() < deadline) {
        try {
            response = await fetch(`http://127.0.0.1:${port}/app`);
            if (response.status === 200) break;
        } catch (_) {
            // Wait for the child process to bind the loopback port.
        }
        await new Promise((resolve) => setTimeout(resolve, 80));
    }
    assert.equal(response?.status, 200, `test mode server did not become ready: ${output}`);
    const html = await response.text();
    assert.match(html, /__PETBANK_TEST_MODE__\s*=\s*true/);
    assert.match(output, /TEST MODE/);
    const browser = await chromium.launch(browserLaunchOpts());
    try {
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        await page.goto(`http://127.0.0.1:${port}/app`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelector('#page-map.active'));
        assert.match(await page.locator('#page-map').innerText(), /成长|今日|任务/);
    } finally {
        await browser.close();
    }
    console.log('PASS local test mode server');
} finally {
    child.kill();
}
