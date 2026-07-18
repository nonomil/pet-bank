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
        localStorage.removeItem('petbank_learning_catalog_state');
        await window.switchPage('learn');
    });
    await page.waitForSelector('#learn-container #learn-hub-panel[role="tabpanel"]', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('.top-nav [data-page="picturebooks"]').count(), 0, 'top-nav should not own the picturebook primary entry');
    assert.equal(await page.locator('#childPrimaryNav [data-child-primary="picturebooks"]').count(), 1, 'picturebooks should be a child workbench primary entry');
    assert.equal(await page.locator('.app-bottom-dock [data-app-dock="picturebooks"]').count(), 1, 'legacy bottom-dock picturebook entry remains as a compatibility node');
    assert.equal(await page.locator('#learn-container [data-learn-hub-tab="picturebooks"]').count(), 0, 'learning workspace should not expose a picturebook tab');
    assert.equal(await page.locator('#learn-container .learn-demo-resource-card-picturebook').count(), 0, 'learning workspace should not expose a picturebook card');
    assert.equal(await page.locator('#learn-container #learn-picturebooks-root').count(), 0, 'learning workspace should not mount the picturebook library');
    assert.equal(await page.locator('#learn-container [onclick*="openHubTab(\'picturebooks\')"]').count(), 0, 'learning workspace should not link to an embedded picturebook tab');
    assert.equal(await page.locator('#learn-hub-panel[role="tabpanel"]').count(), 1, 'learning tab panel is exposed');
    assert.deepEqual(errors, [], 'learning picturebook tab has no page errors');
    console.log(JSON.stringify({ picturebookPrimaryEntry: true, embeddedPicturebooks: false, errors }));
} finally {
    await browser.close();
}
