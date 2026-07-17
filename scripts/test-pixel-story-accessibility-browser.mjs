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
    await page.evaluate(async () => {
        localStorage.removeItem('petbank_pixel_worlds_progress_v1');
        await window.switchPage('explore');
    });
    await page.waitForSelector('#pixelStoryMapContainer .pixel-story-map', { state: 'attached', timeout: 20000 });

    assert.equal(await page.locator('#pixelStoryMapContainer [role="tab"]').count(), 3, 'three world tabs are exposed');
    assert.equal(await page.locator('#pixelStoryMapContainer [role="tabpanel"]').count(), 1, 'map panel is exposed as a tabpanel');
    assert.equal(await page.locator('#pixelStoryMapContainer [role="tab"]').evaluateAll((tabs) => {
        const controlsId = tabs[0]?.getAttribute('aria-controls');
        return Boolean(controlsId) && tabs.every((tab) => tab.getAttribute('aria-controls') === controlsId) && document.querySelectorAll(`#pixelStoryMapContainer #${CSS.escape(controlsId)}`).length === 1;
    }), true, 'world tabs point to the unique map panel');
    assert.equal(await page.locator('[data-map-page-label]').getAttribute('aria-live'), 'polite', 'page marker is announced politely');

    await page.locator('[data-world="sci-fi"]').focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForSelector('[data-world="forest"].is-active', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('.pixel-story-map-chrome > div:first-child > strong').textContent(), '森林回声区', 'ArrowRight moves to the next world');

    await page.locator('[data-world="forest"]').focus();
    await page.keyboard.press('End');
    await page.waitForSelector('[data-world="block"].is-active', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('.pixel-story-map-chrome > div:first-child > strong').textContent(), '方块地下城', 'End moves to the last world');

    assert.deepEqual(errors, [], 'accessibility flow has no page errors');
    console.log(JSON.stringify({ tabs: 3, keyboardNavigation: true, errors }));
} finally {
    await browser.close();
}
