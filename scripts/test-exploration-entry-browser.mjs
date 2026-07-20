import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000/';
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await page.addInitScript(() => { window.__PETBANK_TEST_MODE__ = true; });
const errors = [];
const storyManifestRequests = [];
const petCatalogRequests = [];
const petRuntimeIndexRequests = [];
const homeBackgroundRequests = [];
const defaultPetImageRequests = [];
const showcaseStyleRequests = [];
const showcaseScriptRequests = [];
const homeDemoImageRequests = [];
const homeDemoImagePaths = [
    '/assets/ui/home-thumbs/today.webp',
    '/assets/ui/home-thumbs/pet.webp',
    '/assets/ui/home-thumbs/learn.webp',
    '/assets/ui/home-thumbs/picturebooks.webp',
    '/assets/ui/home-thumbs/playground.webp'
];
page.on('pageerror', (error) => errors.push(String(error?.message || error)));
page.on('request', (request) => {
    if (request.url().includes('/data/story-packs/05-pixel-worlds-story/manifest.json')) {
        storyManifestRequests.push(request.url());
    }
    if (request.url().includes('/data/pets.json')) petCatalogRequests.push(request.url());
    if (request.url().includes('/data/pets-runtime-index.json')) petRuntimeIndexRequests.push(request.url());
    if (request.url().includes('/assets/home-bg.webp')) homeBackgroundRequests.push(request.url());
    if (request.url().includes('/assets/pets/poses/dog_idle.webp')) defaultPetImageRequests.push(request.url());
    if (request.url().includes('/css/showcase.css')) showcaseStyleRequests.push(request.url());
    if (request.url().includes('/js/showcase.js')) showcaseScriptRequests.push(request.url());
    if (homeDemoImagePaths.some((path) => request.url().includes(path))) homeDemoImageRequests.push(request.url());
});
page.on('console', (message) => {
    if (message.type() === 'error' && !/404|favicon|Failed to load resource/i.test(message.text())) errors.push(message.text());
});

try {
    await page.goto(new URL('app/explore/forest', baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.PetBankRuntime && window.switchPage, { timeout: 20000 });
    await page.waitForSelector('#page-forest-map.active #forestMapSceneGrid .map-scene-node', { state: 'attached', timeout: 20000 });

    assert.equal(await page.locator('#forestMapSceneGrid .map-scene-node').count(), 12, 'forest page keeps all forest route nodes');
    assert.match(await page.locator('#forestMapSceneGrid .map-scene-node').first().textContent(), /森林/, 'forest is the first route');
    assert.equal(petCatalogRequests.length, 0, `forest entry should not fetch the full pet catalog: ${JSON.stringify(petCatalogRequests)}`);
    assert.equal(petRuntimeIndexRequests.length, 1, `forest entry should fetch one runtime pet index: ${JSON.stringify(petRuntimeIndexRequests)}`);
    assert.equal(homeBackgroundRequests.length, 0, `forest entry should not fetch the home-only background: ${JSON.stringify(homeBackgroundRequests)}`);
    assert.equal(defaultPetImageRequests.length, 0, `forest entry should not fetch the default pet fallback image: ${JSON.stringify(defaultPetImageRequests)}`);
    assert.equal(showcaseStyleRequests.length, 0, `forest entry should not fetch the home-only showcase stylesheet: ${JSON.stringify(showcaseStyleRequests)}`);
    assert.equal(showcaseScriptRequests.length, 0, `forest entry should not fetch the home-only showcase script: ${JSON.stringify(showcaseScriptRequests)}`);
    assert.equal(await page.locator('#homeCommonEntries img[src]').count(), 0, 'forest entry should keep home resource card images unactivated');
    assert.deepEqual(
        homeDemoImageRequests.filter((url) => homeDemoImagePaths.some((path) => url.includes(path))),
        [],
        `forest entry should not fetch home-only resource images: ${JSON.stringify(homeDemoImageRequests)}`
    );
    await page.screenshot({ path: 'tmp/exploration-home-forest.png', fullPage: true });

    await page.evaluate(() => window.switchPage('explore'));
    await page.waitForSelector('#page-explore #pixelStoryShell .pixel-story-node', { state: 'attached', timeout: 20000 });
    assert.equal(petCatalogRequests.length, 0, `explore entry should not fetch the full pet catalog: ${JSON.stringify(petCatalogRequests)}`);
    assert.equal(petRuntimeIndexRequests.length, 1, `explore entry should reuse the runtime pet index: ${JSON.stringify(petRuntimeIndexRequests)}`);
    assert.equal(storyManifestRequests.length, 1, `pixel story manifest should be fetched once per page: ${JSON.stringify(storyManifestRequests)}`);
    assert.equal(await page.locator('#page-explore #pixelStoryShell .pixel-story-world-tab').count(), 3, 'explore exposes three story worlds');
    assert.ok(await page.locator('#page-explore #pixelStoryShell .pixel-story-node').count() >= 1, 'explore exposes the first unlocked story node');
    await page.screenshot({ path: 'tmp/exploration-story-roaming.png', fullPage: true });

    await page.locator('#page-explore #pixelStoryShell .pixel-story-world-tab').nth(2).click();
    await page.waitForSelector('#page-explore #pixelStoryShell .pixel-story-node', { state: 'attached', timeout: 20000 });
    await page.screenshot({ path: 'tmp/exploration-block-world.png', fullPage: true });

    await page.locator('#page-explore #pixelStoryShell [data-detective-bonus]').click();
    await page.waitForSelector('#page-explore #pixelStoryShell .pixel-story-node', { state: 'attached', timeout: 20000 });
    await page.screenshot({ path: 'tmp/exploration-star-detective.png', fullPage: true });

    await page.evaluate(() => window.switchPage('forest-map'));
    await page.waitForSelector('#forestMapSceneGrid .map-scene-node', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#forestMapSceneGrid .map-scene-node').count(), 12, 'returning to forest restores the forest board');

    await page.locator('#forestMapSceneGrid .map-scene-node').first().click();
    await page.waitForSelector('#explorationStageRoot .galgame-stage', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('.galgame-bg img').count(), 1, 'forest node opens a playable scene');
    await page.locator('#explorationStageRoot .galgame-back').evaluate((button) => button.click());
    await page.waitForSelector('#page-forest-map #forestMapSceneGrid', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#page-explore #sceneGrid').count(), 0, 'forest exit returns to the dedicated forest page');

    await page.evaluate(() => window.switchPage('map'));
    await page.waitForSelector('#page-map.active', { state: 'attached', timeout: 20000 });
    await page.waitForFunction(() => document.querySelectorAll('#homeCommonEntries img[src]').length === 5, { timeout: 20000 });
    assert.equal(homeBackgroundRequests.length, 1, `home map should restore its background when opened: ${JSON.stringify(homeBackgroundRequests)}`);
    assert.equal(defaultPetImageRequests.length, 1, `home map should restore its default pet placeholder when opened: ${JSON.stringify(defaultPetImageRequests)}`);
    const activatedHomeImagePaths = await page.locator('#homeCommonEntries img[src]').evaluateAll((images) => images.map((image) => new URL(image.src).pathname));
    assert.deepEqual(activatedHomeImagePaths, homeDemoImagePaths, 'home map should activate all five resource image sources');
    assert.ok(new Set(homeDemoImageRequests).size <= homeDemoImagePaths.length, `home map should not duplicate resource image requests: ${JSON.stringify(homeDemoImageRequests)}`);

    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
    assert.ok(layout.bodyWidth <= layout.viewportWidth, `home exploration has no mobile horizontal overflow: ${JSON.stringify(layout)}`);
    assert.deepEqual(errors, [], 'exploration entry flow has no page errors');
    console.log(JSON.stringify({ forestNodes: 12, storyNodesVisible: 1, blockNodesVisible: 1, detectiveNodes: 1, layout, errors }));
} finally {
    await browser.close();
}
