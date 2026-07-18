import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000/';
const rootUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
const forestUrl = new URL('app/explore/forest', rootUrl).href;
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];

page.on('pageerror', (error) => errors.push(`pageerror: ${String(error?.message || error)}`));
page.on('console', (message) => {
    if (message.type() === 'error' && !/404|favicon|Failed to load resource/i.test(message.text())) {
        errors.push(`console: ${message.text()}`);
    }
});

const isVisible = async (locator) => locator.isVisible().catch(() => false);

try {
    await page.goto(forestUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.PetBankRuntime && window.switchPage, { timeout: 20000 });
    await page.waitForFunction(() => document.body.classList.contains('app-ready'), { timeout: 20000 });
    await page.waitForSelector('#page-forest-map.active #forestMapSceneGrid .map-scene-node', { state: 'attached', timeout: 20000 });

    assert.equal(await page.locator('#page-forest-map.active').count(), 1, 'forest route activates the dedicated page');
    assert.equal(await page.locator('#forestMapSceneGrid .map-scene-node').count(), 12, 'forest route exposes all 12 legacy forest scenes');
    assert.equal(await page.locator('#page-forest-map #pixelStoryMapHost').count(), 0, 'forest page does not mount the pixel story host');
    assert.equal(await page.locator('#page-explore #pixelStoryMapHost').count(), 1, 'pixel story page keeps its own host');
    assert.equal(await page.locator('#exploreMapSwitcher [data-explore-map="story"]').count(), 1, 'story map switch is exposed');
    assert.equal(await page.locator('#exploreMapSwitcher [data-explore-map="forest"]').count(), 1, 'forest map switch is exposed');

    await page.setViewportSize({ width: 390, height: 844 });
    const forestLayout = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
    assert.ok(forestLayout.bodyWidth <= forestLayout.viewportWidth, `forest page has no mobile horizontal overflow: ${JSON.stringify(forestLayout)}`);
    await page.setViewportSize({ width: 1280, height: 900 });

    await page.locator('#forestMapSceneGrid .map-scene-node').first().click();
    await page.waitForSelector('#explorationStageRoot .galgame-stage', { state: 'visible', timeout: 20000 });
    assert.equal(await page.locator('#explorationStageRoot .galgame-stage').count(), 1, 'forest node opens the legacy dialogue stage');
    await page.locator('#explorationStageRoot .galgame-back').evaluate((button) => button.click());
    await page.waitForSelector('#explorationStageRoot', { state: 'hidden', timeout: 20000 });
    await page.waitForSelector('#page-forest-map.active #forestMapSceneGrid .map-scene-node', { state: 'attached', timeout: 20000 });
    assert.equal(await isVisible(page.locator('#page-forest-map.active')), true, 'forest dialogue returns to the forest page');

    await page.locator('#exploreMapSwitcher [data-explore-map="story"]').click();
    await page.waitForSelector('#page-explore.active #pixelStoryShell .pixel-story-world-tab', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#page-explore.active #pixelStoryShell .pixel-story-world-tab').count(), 3, 'story switch returns to three world map');
    assert.equal(await page.locator('#page-forest-map #forestMapSceneGrid').count(), 1, 'forest host remains separate from story map');
    assert.deepEqual(errors, [], `forest map route should have no browser errors: ${JSON.stringify(errors)}`);
    console.log(JSON.stringify({ forestUrl, sceneCount: 12, storyWorlds: 3, forestLayout, errors }));
} finally {
    await browser.close();
}
