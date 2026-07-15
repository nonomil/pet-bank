import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765/';
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];

page.on('pageerror', (error) => errors.push(String(error?.message || error)));
page.on('console', (message) => {
    if (message.type() === 'error' && !/404|favicon|Failed to load resource/i.test(message.text())) errors.push(message.text());
});

try {
    await page.goto(`${baseUrl}app/explore-terminal/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForSelector('[data-terminal-world]', { state: 'attached', timeout: 20000 });

    const worldButtons = page.locator('[data-terminal-world]');
    assert.deepEqual(await worldButtons.evaluateAll((buttons) => buttons.map((button) => button.dataset.terminalWorld)), ['forest', 'sci-fi', 'block']);
    assert.equal(await page.locator('#terminalPreviewImage').count(), 1, 'terminal has one main preview image');
    assert.equal(await page.locator('[data-terminal-asset]').count(), 15, 'semantic asset shelf exposes the published pack');
    assert.ok(await page.locator('#terminalPreviewImage').evaluate((image) => image.complete && image.naturalWidth > 0), 'initial preview image loads');
    assert.match(await page.locator('#terminalPreviewImage').getAttribute('src'), /clean-forest\.png$/, 'forest preview uses a clean map background');

    await worldButtons.filter({ hasText: '星港科技区' }).click();
    await page.waitForFunction(() => document.body.dataset.activeWorld === 'sci-fi');
    assert.match(await page.locator('#terminalPreviewImage').getAttribute('src'), /clean-scifi\.png$/, 'sci-fi preview uses a clean map background');
    assert.equal(await page.locator('#terminalActiveWorld').textContent(), '星港科技区');

    await worldButtons.filter({ hasText: '方块地下城' }).click();
    await page.waitForFunction(() => document.body.dataset.activeWorld === 'block');
    assert.match(await page.locator('#terminalPreviewImage').getAttribute('src'), /clean-block\.png$/, 'block preview uses a clean map background');

    await page.getByRole('button', { name: '继续冒险' }).click();
    assert.match(await page.locator('#terminalLiveStatus').textContent(), /方块地下城/);
    await page.getByRole('button', { name: '打开侦探小游戏' }).click();
    assert.match(await page.locator('#terminalLiveStatus').textContent(), /侦探/);

    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
    assert.ok(layout.bodyWidth <= layout.viewportWidth, `terminal page has no mobile horizontal overflow: ${JSON.stringify(layout)}`);
    assert.deepEqual(errors, [], 'terminal page has no page or console errors');
    console.log(JSON.stringify({ worlds: 3, assets: 15, layout, errors }));
} finally {
    await browser.close();
}
