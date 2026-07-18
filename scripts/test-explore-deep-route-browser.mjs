import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000/';
const rootUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
const exploreUrl = new URL('app/explore', rootUrl).href;
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

try {
    await page.goto(exploreUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => {
        const loading = document.getElementById('exploreLoadingState');
        const map = document.querySelector('#pixelStoryMapHost .pixel-story-map');
        const visible = (element) => element && !element.hidden && getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden';
        return visible(loading) || visible(map);
    }, { timeout: 10000 });
    assert.equal(await page.locator('#exploreLoadingState').count(), 1, 'deep explore route has a loading host');
    await page.waitForFunction(() => document.body.classList.contains('app-ready'), { timeout: 20000 });
    await page.waitForSelector('#page-explore.active #pixelStoryShell .pixel-story-world-tab', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#page-explore.active #pixelStoryShell .pixel-story-world-tab').count(), 3, 'deep explore route loads three world tabs');
    assert.equal(await page.locator('#exploreLoadingState').isHidden(), true, 'loading state hides after map activation');
    assert.ok(await page.locator('#page-explore.active #pixelStoryShell .pixel-story-node').count() >= 1, 'deep explore route has an unlocked node');
    assert.deepEqual(errors, [], `deep explore route should have no browser errors: ${JSON.stringify(errors)}`);
    console.log(JSON.stringify({ exploreUrl, worldTabs: 3, loadingHidden: true, errors }));
} finally {
    await browser.close();
}
