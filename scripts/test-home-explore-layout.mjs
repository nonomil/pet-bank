import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000/';
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
    await page.evaluate(() => window.switchPage('map'));
    await page.waitForSelector('#page-map .home-demo-workspace', { state: 'attached', timeout: 20000 });

    assert.equal(await page.locator('[data-home-explore-mode]').count(), 0, 'home should not embed the pixel world selector');
    assert.equal(await page.locator('#homePixelWorldMapSlot').count(), 0, 'home should not embed the pixel world map');
    assert.equal(await page.locator('body > .page-shell > .sidebar').count(), 1, 'legacy shell remains in the DOM for compatibility');
    assert.equal(await page.locator('#page-map #forestMapSceneGrid').count(), 0, 'home does not mount the forest route');

    await page.evaluate(() => window.switchPage('forest-map'));
    await page.waitForSelector('#page-forest-map #forestMapSceneGrid .map-scene-node', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#forestMapSceneGrid .map-scene-node').count(), 12, 'forest map keeps all 12 original nodes on its dedicated page');

    await page.evaluate(() => window.switchPage('explore'));
    await page.waitForSelector('#pixelStoryMapContainer .pixel-story-world-tab', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#pixelStoryMapContainer .pixel-story-world-tab').count(), 3, 'standalone story map keeps three world tabs');
    assert.equal(await page.locator('#page-explore #sceneGrid').count(), 0, 'explore tab should not render the forest route');
    assert.equal(await page.locator('#page-explore .map-scene-node').count(), 0, 'explore tab should not render forest route nodes');

    await page.evaluate(() => window.switchPage('forest-map'));
    await page.waitForSelector('#page-forest-map.active #forestMapSceneGrid .map-scene-node', { state: 'attached', timeout: 20000 });
    await page.locator('#forestMapSceneGrid .map-scene-node').first().click();
    await page.waitForSelector('#explorationStageRoot .galgame-stage', { state: 'attached', timeout: 20000 });
    await page.locator('#explorationStageRoot .galgame-back').evaluate((button) => button.click());
    await page.waitForSelector('#page-forest-map.active #forestMapSceneGrid', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#page-explore #sceneGrid').count(), 0, 'forest page keeps the card map separate');

    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
    assert.ok(layout.bodyWidth <= layout.viewportWidth, `home exploration has no mobile horizontal overflow: ${JSON.stringify(layout)}`);
    assert.deepEqual(errors, [], 'home exploration flow has no page errors');
    console.log(JSON.stringify({ homeEmbedsForest: false, forestPageNodes: 12, storyWorlds: 3, layout, errors }));
} finally {
    await browser.close();
}
