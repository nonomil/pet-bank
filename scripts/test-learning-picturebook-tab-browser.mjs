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
    await page.waitForSelector('#learn-container [data-learn-hub-tab="picturebooks"]', { state: 'attached', timeout: 20000 });

    assert.equal(await page.locator('.top-nav [data-page="picturebooks"]').evaluate((element) => getComputedStyle(element).display), 'none', 'standalone top-nav picturebook entry is hidden');
    assert.equal(await page.locator('.app-bottom-dock [data-app-dock="picturebooks"]').evaluate((element) => getComputedStyle(element).display), 'none', 'standalone bottom-dock picturebook entry is hidden');

    await page.locator('#learn-container [data-learn-hub-tab="picturebooks"]').click();
    await page.waitForSelector('#learn-picturebooks-root .picturebooks-portal', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#learn-container [data-learn-hub-tab].is-active').textContent(), '绘本', 'picturebook tab becomes active');
    assert.equal(await page.locator('#learn-picturebooks-root .picturebooks-portal-card').count(), 25, 'picturebook library renders inside learning');
    assert.equal(await page.locator('#learn-hub-panel[role="tabpanel"]').count(), 1, 'learning tab panel is exposed');
    assert.deepEqual(errors, [], 'learning picturebook tab has no page errors');
    console.log(JSON.stringify({ tab: 'picturebooks', portalCards: 25, errors }));
} finally {
    await browser.close();
}
