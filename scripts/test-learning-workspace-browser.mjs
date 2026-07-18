import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000/';
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const errors = [];

page.on('pageerror', error => errors.push(`pageerror: ${String(error?.message || error)}`));
page.on('console', message => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('requestfailed', request => {
    errors.push(`requestfailed: ${request.url()} (${request.failure()?.errorText || 'unknown'})`);
});

try {
    await page.goto(new URL('app', baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.PetBankRuntime && window.switchPage, { timeout: 20000 });
    await page.locator('#childPrimaryNav [data-child-primary="learn"]').click();
    await page.waitForSelector('#learn-container .learn-demo-workspace', { state: 'attached', timeout: 20000 });

    const columns = await page.locator('.page-shell').evaluate(element => getComputedStyle(element).gridTemplateColumns);
    assert.match(columns, /^224px\s+.+\s+264px$/, `desktop child workbench should have three columns: ${columns}`);
    assert.equal(await page.locator('#childPrimaryNav [data-child-primary]').count(), 7, 'child workbench should expose seven primary entries');
    assert.equal(await page.locator('#childProgressRail').count(), 1, 'personal progress should stay visible in the shared rail');

    const tabs = ['packs', 'sites', 'prints', 'progress', 'today'];
    for (const tabId of tabs) {
        await page.locator(`.learn-demo-side-link[role="tab"][data-learn-hub-tab="${tabId}"]`).click();
        await page.waitForFunction(expected => document.querySelector(`.learn-demo-side-link[role="tab"][data-learn-hub-tab="${expected}"]`)?.getAttribute('aria-selected') === 'true', tabId);
        assert.equal(await page.locator('#childProgressRail').count(), 1, `${tabId} should keep personal progress visible`);
    }

    await page.locator('.learn-demo-side-link[role="tab"][data-learn-hub-tab="today"]').click();
    await page.waitForSelector('.learn-demo-resource-grid .learn-demo-resource-card', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('.learn-demo-resource-card').count(), 4, 'today tab should show compact learning resource cards without picturebooks');
    assert.equal(await page.locator('.learn-demo-resource-card-picturebook').count(), 0, 'today tab should not show a picturebook card');
    assert.equal(await page.locator('.learn-demo-focus-grid').count(), 1, 'today tab should show the main mission and completion card');
    const primaryAction = page.locator('.learn-demo-mission-actions .learn-btn-primary');
    assert.equal(await primaryAction.count(), 1, 'today card should have a primary action');
    await primaryAction.click();
    await page.waitForSelector('#page-learn-lesson.active, #page-learn-plan.active, #page-learn-pack.active', { state: 'attached', timeout: 20000 });

    await page.evaluate(() => window.switchPage('learn'));
    await page.waitForSelector('#learn-container .learn-demo-workspace', { state: 'attached', timeout: 20000 });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileLayout = await page.evaluate(() => ({
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        columns: getComputedStyle(document.querySelector('.page-shell')).gridTemplateColumns,
        display: getComputedStyle(document.querySelector('.page-shell')).display
    }));
    assert.ok(mobileLayout.bodyWidth <= mobileLayout.viewportWidth, `learning page should not overflow on mobile: ${JSON.stringify(mobileLayout)}`);
    assert.equal(mobileLayout.display, 'flex', `mobile child workbench should stack: ${JSON.stringify(mobileLayout)}`);
    assert.deepEqual(errors, [], `learning workspace should have no browser errors: ${JSON.stringify(errors)}`);
    console.log(JSON.stringify({ columns, mobileLayout, sidebarTabs: tabs.length, errors }));
} finally {
    await browser.close();
}
