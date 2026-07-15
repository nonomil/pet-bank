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
    await page.evaluate(() => window.switchPage('map'));
    await page.waitForSelector('#sceneGridMap .map-scene-node', { state: 'attached', timeout: 20000 });

    const homePanel = page.locator('#homeExplorePanel');
    const modes = homePanel.locator('[data-home-explore-mode]');
    assert.deepEqual(await modes.evaluateAll((buttons) => buttons.map((button) => button.dataset.homeExploreMode)), ['forest', 'sci-fi', 'block']);
    assert.deepEqual(await modes.locator('strong').allTextContents(), ['森林探险', '星港科技区', '方块地下城']);
    assert.equal(await homePanel.locator('.home-explore-panel-status').count(), 0, 'home map status card should be removed');
    assert.equal(await homePanel.locator('.home-forest-map-action').count(), 0, 'forest refresh action should be removed');
    assert.equal(await homePanel.locator('.home-forest-map-head h3').textContent(), '森林探险');
    assert.equal(await homePanel.locator('.home-forest-map-head').textContent().then((text) => text.includes('原有探索路线')), false);
    assert.equal(await homePanel.locator('.home-explore-modebar').evaluate((bar, view) => bar.compareDocumentPosition(view) & Node.DOCUMENT_POSITION_FOLLOWING, await homePanel.locator('#homeExploreView').elementHandle()) !== 0, true, 'map selector should precede map views');
    assert.equal(await homePanel.locator('#sceneGridMap .map-scene-node').count(), 12, 'forest map keeps all 12 original nodes');

    await modes.nth(1).click();
    await page.waitForSelector('#homePixelWorldMapSlot .pixel-story-map', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#homePixelWorldMapSlot .pixel-story-world-tabs').count(), 0, 'home embed should hide duplicate world tabs');
    assert.equal(await page.locator('#homePixelWorldMapSlot [data-detective-bonus]').count(), 1, 'detective mini-games remain an auxiliary entry');
    await page.locator('#homePixelWorldMapSlot [data-detective-bonus]').click();
    await page.waitForFunction(() => document.querySelector('#homePixelWorldMapSlot .pixel-story-map')?.className.includes('pixel-story-map-tone-detective'));
    assert.equal(await page.locator('#homePixelWorldMapSlot .pixel-story-world-tabs').count(), 0, 'detective auxiliary view should not add a fourth world tab');

    await modes.nth(2).click();
    await page.waitForFunction(() => document.querySelector('#homePixelWorldMapSlot .pixel-story-map')?.className.includes('pixel-story-map-tone-block'));
    assert.equal(await page.locator('#homePixelWorldMapSlot .pixel-story-world-tabs').count(), 0, 'block home embed should hide duplicate world tabs');

    await page.evaluate(() => window.switchPage('explore'));
    await page.waitForSelector('#pixelStoryMapContainer .pixel-story-world-tab', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#pixelStoryMapContainer .pixel-story-world-tab').count(), 3, 'standalone story map keeps three world tabs');

    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
    assert.ok(layout.bodyWidth <= layout.viewportWidth, `home exploration has no mobile horizontal overflow: ${JSON.stringify(layout)}`);
    assert.deepEqual(errors, [], 'home exploration flow has no page errors');
    console.log(JSON.stringify({ modes: ['forest', 'sci-fi', 'block'], forestNodes: 12, layout, errors }));
} finally {
    await browser.close();
}
