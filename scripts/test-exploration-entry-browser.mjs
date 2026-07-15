import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765/';
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error?.message || error)));
page.on('console', (message) => {
    if (message.type() === 'error' && !/404|favicon|Failed to load resource/i.test(message.text())) errors.push(message.text());
});

try {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.PetBankRuntime && window.switchPage, { timeout: 20000 });
    await page.waitForSelector('#homeExplorePanel', { state: 'visible', timeout: 20000 });
    await page.waitForSelector('#sceneGridMap .map-scene-node', { state: 'attached', timeout: 20000 });

    assert.equal(await page.locator('#sceneGridMap .map-scene-node').count(), 12, 'home keeps all forest route nodes');
    assert.match(await page.locator('#sceneGridMap .map-scene-node').first().textContent(), /森林/, 'forest is the first home route');
    assert.equal(await page.locator('[data-home-explore-mode]').count(), 3, 'home exposes forest, story, and block modes');
    await page.screenshot({ path: 'tmp/exploration-home-forest.png', fullPage: true });

    await page.locator('[data-home-explore-mode="sci-fi"]').click();
    await page.waitForSelector('#homePixelWorldMapSlot .pixel-story-node', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#homePixelWorldMapSlot .pixel-story-node').count(), 1, 'home story entry opens the first unlocked sci-fi node');
    await page.screenshot({ path: 'tmp/exploration-story-roaming.png', fullPage: true });

    await page.locator('[data-home-explore-mode="block"]').evaluate((button) => button.click());
    await page.waitForSelector('#homePixelWorldMapSlot .pixel-story-node', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#homePixelWorldMapSlot .pixel-story-node').count(), 1, 'home block entry opens the first unlocked block node');
    await page.screenshot({ path: 'tmp/exploration-block-world.png', fullPage: true });

    await page.locator('#homePixelWorldMapSlot [data-detective-bonus]').click();
    await page.waitForSelector('#homePixelWorldMapSlot .pixel-story-node', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#homePixelWorldMapSlot .pixel-story-node').count(), 1, 'home detective entry opens the first unlocked bonus node');
    await page.screenshot({ path: 'tmp/exploration-star-detective.png', fullPage: true });

    await page.locator('[data-home-explore-mode="forest"]').click();
    await page.evaluate(() => window.switchPage('map'));
    await page.waitForSelector('.home-forest-map-view:not([hidden]) #sceneGridMap .map-scene-node', { state: 'visible', timeout: 20000 });
    await page.waitForSelector('#sceneGridMap .map-scene-node', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#sceneGridMap .map-scene-node').count(), 12, 'returning home restores the forest board');

    await page.locator('#sceneGridMap .map-scene-node').first().click();
    await page.waitForSelector('.galgame-stage', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('.galgame-bg img').count(), 1, 'forest node opens a playable scene');
    await page.locator('.galgame-back').click();
    await page.waitForSelector('#page-explore .page, #exploreLegacyContainer', { state: 'attached', timeout: 20000 });

    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
    assert.ok(layout.bodyWidth <= layout.viewportWidth, `home exploration has no mobile horizontal overflow: ${JSON.stringify(layout)}`);
    assert.deepEqual(errors, [], 'exploration entry flow has no page errors');
    console.log(JSON.stringify({ forestNodes: 12, storyNodesVisible: 1, blockNodesVisible: 1, detectiveNodes: 1, layout, errors }));
} finally {
    await browser.close();
}
