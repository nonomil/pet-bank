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
    assert.equal(await page.locator('[data-world-node]').count(), 9, 'terminal exposes three nodes per world');
    assert.equal(await page.locator('[data-world-node]:not([hidden])').count(), 3, 'only active world nodes are visible');
    assert.equal(await page.locator('.terminal-assets').isVisible(), false, 'developer asset shelf is hidden from child-facing home');
    assert.ok(await page.locator('[data-world-node]:not([hidden]) img').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), 'active world node images load');
    assert.ok(await page.locator('#terminalPreviewImage').evaluate((image) => image.complete && image.naturalWidth > 0), 'initial preview image loads');
    assert.match(await page.locator('#terminalPreviewImage').getAttribute('src'), /clean-forest\.png$/, 'forest preview uses a clean map background');

    await page.getByRole('button', { name: '打开瀑布回声' }).click();
    assert.match(await page.locator('#terminalLiveStatus').textContent(), /瀑布回声/);

    await worldButtons.filter({ hasText: '星港科技区' }).click();
    await page.waitForFunction(() => document.body.dataset.activeWorld === 'sci-fi');
    assert.match(await page.locator('#terminalPreviewImage').getAttribute('src'), /clean-scifi\.png$/, 'sci-fi preview uses a clean map background');
    assert.equal(await page.locator('#terminalActiveWorld').textContent(), '星港科技区');
    assert.equal(await page.locator('[data-world-node]:not([hidden])').count(), 3, 'sci-fi exposes three nodes');
    await page.getByRole('button', { name: '打开星港中枢' }).click();
    assert.match(await page.locator('#terminalLiveStatus').textContent(), /星港中枢/);

    await worldButtons.filter({ hasText: '方块地下城' }).click();
    await page.waitForFunction(() => document.body.dataset.activeWorld === 'block');
    assert.match(await page.locator('#terminalPreviewImage').getAttribute('src'), /clean-block\.png$/, 'block preview uses a clean map background');
    assert.equal(await page.locator('[data-world-node]:not([hidden])').count(), 3, 'block exposes three nodes');

    await page.getByRole('button', { name: '继续冒险' }).click();
    assert.match(await page.locator('#terminalLiveStatus').textContent(), /方块地下城.*方块村口/);
    await page.getByRole('button', { name: '打开侦探小游戏' }).click();
    assert.match(await page.locator('#terminalLiveStatus').textContent(), /侦探/);

    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
    assert.ok(layout.bodyWidth <= layout.viewportWidth, `terminal page has no mobile horizontal overflow: ${JSON.stringify(layout)}`);
    assert.deepEqual(errors, [], 'terminal page has no page or console errors');
    console.log(JSON.stringify({ worlds: 3, visibleNodes: 3, totalNodes: 9, layout, errors }));
} finally {
    await browser.close();
}
