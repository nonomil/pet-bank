import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000/';
const homeUrl = new URL('app', baseUrl).href;
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];

page.on('pageerror', (error) => errors.push(`pageerror: ${String(error?.message || error)}`));
page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('requestfailed', (request) => {
    errors.push(`requestfailed: ${request.url()} (${request.failure()?.errorText || 'unknown'})`);
});

async function assertActivePage(pageId) {
    await page.waitForSelector(`#page-${pageId}.active`, { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('.page.active').count(), 1, `only ${pageId} should be active`);
}

async function clickUnique(selector, label) {
    const target = page.locator(selector);
    assert.equal(await target.count(), 1, `${label} should have one clickable entry`);
    await target.click();
}

async function assertPageBinding(pageId, contentSelector, runtimeMarker) {
    await page.waitForSelector(contentSelector, { state: 'attached', timeout: 20000 });
    if (runtimeMarker) {
        await page.waitForSelector(`script[data-petbank-src="${runtimeMarker}"]`, { state: 'attached', timeout: 20000 });
    }
}

try {
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.PetBankRuntime && window.switchPage, { timeout: 20000 });
    await assertActivePage('map');
    assert.match(await page.title(), /成长伙伴/);
    assert.equal(new URL(await page.url()).port, '7000', 'home should be opened on port 7000');

    const primaryEntries = [
        ['.primary-nav > .nav-tab[data-page="map"]', 'map', '#sceneGridMap .map-scene-node'],
        ['.primary-nav > .nav-hub[data-page="today"] > button', 'today', '#taskGrid .task-card'],
        ['.primary-nav > .nav-tab[data-page="learn"]', 'learn', '#learn-container .learn-shell', 'js/learn-center.js?v=6'],
        ['.primary-nav > .nav-tab[data-page="picturebooks"]', 'picturebooks', '#picturebooks-root .picturebooks-portal', 'js/picturebook-external-bridge.js'],
        ['.primary-nav > .nav-hub[data-page="pet"] > button', 'pet', '#petDisplayArea'],
        ['.primary-nav > .nav-tab[data-page="explore"]', 'explore', '#page-explore #pixelStoryShell', 'js/pixel-story-map.js?v=20260715-stage-fullscreen1'],
        ['.primary-nav > .nav-hub[data-page="playground"] > button', 'playground', '#playgroundProgressBoard', 'js/math-pk.js?v=4'],
    ];
    for (const [selector, pageId, contentSelector, runtimeMarker] of primaryEntries) {
        await clickUnique(selector, pageId);
        await assertActivePage(pageId);
        await assertPageBinding(pageId, contentSelector, runtimeMarker);
        await page.evaluate(() => window.switchPage('map'));
        await assertActivePage('map');
    }

    await clickUnique('.nav-utility-settings[data-page="parent"]', 'parent');
    await assertActivePage('parent');
    await assertPageBinding('parent', '#page-parent .parent-home-primary');
    await page.evaluate(() => window.switchPage('map'));
    await assertActivePage('map');

    const journeyEntries = [
        ['#childJourneyHero .child-journey-hero-action', 'today'],
        ['#childJourneyToday', 'today'],
        ['#childJourneyPet', 'pet'],
        ['#childJourneyAdventure', 'playground'],
    ];
    for (const [selector, pageId] of journeyEntries) {
        await clickUnique(selector, selector);
        await assertActivePage(pageId);
        if (pageId === 'today') await assertPageBinding(pageId, '#taskGrid .task-card');
        if (pageId === 'pet') await assertPageBinding(pageId, '#petDisplayArea');
        if (pageId === 'playground') await assertPageBinding(pageId, '#playgroundProgressBoard');
        await page.evaluate(() => window.switchPage('map'));
        await assertActivePage('map');
    }

    const moreEntries = page.locator('#childJourneyMore button');
    assert.equal(await moreEntries.count(), 2, 'home should keep exploration and shop secondary entries');
    await moreEntries.nth(0).click();
    await assertActivePage('explore');
    await assertPageBinding('explore', '#page-explore #pixelStoryShell');
    await page.evaluate(() => window.switchPage('map'));
    await assertActivePage('map');

    await moreEntries.nth(1).click();
    await assertActivePage('shop');
    await assertPageBinding('shop', '#shop-ui');
    await page.evaluate(() => window.switchPage('map'));
    await assertActivePage('map');

    await page.waitForSelector('#sceneGridMap .map-scene-node', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#sceneGridMap .map-scene-node').count(), 12, 'forest map should retain all original nodes');

    await clickUnique('[data-home-explore-mode="sci-fi"]', 'sci-fi map');
    await page.waitForSelector('#homePixelWorldMapSlot .pixel-story-map', { state: 'attached', timeout: 20000 });
    assert.ok(await page.locator('#homePixelWorldMapSlot .pixel-story-node').count() >= 1, 'sci-fi map should expose an unlocked node');

    await clickUnique('[data-home-explore-mode="block"]', 'block map');
    await page.waitForFunction(() => document.querySelector('#homePixelWorldMapSlot .pixel-story-map')?.className.includes('pixel-story-map-tone-block'), { timeout: 20000 });

    await clickUnique('[data-home-explore-mode="sci-fi"]', 'sci-fi map return');
    await page.waitForSelector('#homePixelWorldMapSlot [data-detective-bonus]', { state: 'attached', timeout: 20000 });
    await clickUnique('#homePixelWorldMapSlot [data-detective-bonus]', 'detective bonus');
    await page.waitForFunction(() => document.querySelector('#homePixelWorldMapSlot .pixel-story-map')?.className.includes('pixel-story-map-tone-detective'), { timeout: 20000 });

    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
    assert.ok(layout.bodyWidth <= layout.viewportWidth, `home should not overflow on mobile: ${JSON.stringify(layout)}`);
    assert.deepEqual(errors, [], `home flow should have no browser errors: ${JSON.stringify(errors)}`);
    console.log(JSON.stringify({ homeUrl, primaryEntries: primaryEntries.map(([, pageId]) => pageId), forestNodes: 12, layout, errors }));
} finally {
    await browser.close();
}
