import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000/';
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();
const errors = [];

page.on('pageerror', (error) => errors.push(`pageerror: ${String(error?.message || error)}`));
page.on('console', (message) => {
    if (message.type() === 'error' && !/404|favicon|Failed to load resource/i.test(message.text())) {
        errors.push(`console: ${message.text()}`);
    }
});

try {
    await page.goto(new URL('app', baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.PetBankRuntime && window.switchPage, { timeout: 20000 });

    await page.evaluate(() => window.switchPage('learn'));
    await page.waitForSelector('#learn-container .learn-shell', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#childPrimaryNav [data-child-primary]').count(), 7, 'child workbench should expose seven primary entries');
    assert.equal(await page.locator('#childProgressRail').count(), 1, 'child workbench should expose one shared progress rail');
    assert.equal(await page.locator('.top-nav .primary-nav [data-page]').count(), 0, 'top nav should not own child primary entries');
    assert.equal(await page.locator('.top-nav').evaluate((element) => getComputedStyle(element).display), 'none', 'child workbench should hide the top navigation bar');
    assert.equal(await page.locator('body').evaluate((element) => element.classList.contains('child-workbench-secondary')), true, 'learning should expose its secondary navigation state');
    assert.equal(await page.locator('#childPrimarySidebar [data-child-action="profile"]').count(), 1, 'child workbench should expose profile switching outside the top bar');
    assert.equal(await page.locator('#childPrimarySidebar [data-child-action="parent"]').count(), 1, 'child workbench should expose parent access outside the top bar');
    const desktopShell = await page.locator('.page-shell').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const primary = document.querySelector('#childPrimarySidebar').getBoundingClientRect();
        const main = document.querySelector('#mainContent').getBoundingClientRect();
        const progress = document.querySelector('#childProgressRail').getBoundingClientRect();
        return {
            display: getComputedStyle(element).display,
            columns: getComputedStyle(element).gridTemplateColumns,
            viewportWidth: window.innerWidth,
            bodyWidth: document.body.scrollWidth,
            shellWidth: rect.width,
            primaryRight: primary.right,
            mainLeft: main.left,
            mainRight: main.right,
            progressLeft: progress.left
        };
    });
    assert.equal(desktopShell.display, 'grid', `desktop workbench should use grid columns: ${JSON.stringify(desktopShell)}`);
    assert.ok(desktopShell.columns.includes('224px') && desktopShell.columns.includes('264px'), `desktop shell should reserve the left and right columns: ${JSON.stringify(desktopShell)}`);
    assert.ok(desktopShell.bodyWidth <= desktopShell.viewportWidth, `desktop workbench should not overflow: ${JSON.stringify(desktopShell)}`);
    assert.ok(desktopShell.primaryRight <= desktopShell.mainLeft && desktopShell.mainRight <= desktopShell.progressLeft, `desktop workbench columns should not overlap: ${JSON.stringify(desktopShell)}`);
    await page.locator('#childPrimaryNav [data-child-primary="picturebooks"]').click();
    await page.waitForSelector('#page-picturebooks.active', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#childPrimaryNav [data-child-primary="picturebooks"].is-current').count(), 1, 'picturebooks should be an independent primary entry');
    assert.equal(await page.locator('body').evaluate((element) => element.classList.contains('child-workbench-secondary')), false, 'picturebooks should use full content without a secondary navigation bar');

    await page.evaluate(() => window.switchPage('walk'));
    await page.waitForSelector('#page-walk.active', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#childPrimarySidebar').evaluate((element) => element.hidden), true, 'fullscreen child game should hide workbench shell');
    assert.equal(await page.locator('body').evaluate((element) => element.classList.contains('child-workbench-active')), false, 'fullscreen child game should not activate workbench shell');

    await page.evaluate(() => window.switchPage('parent'));
    await page.waitForSelector('#page-parent.active', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#childPrimarySidebar').evaluate((element) => element.hidden), true, 'parent shell should hide child workbench shell');
    assert.equal(await page.locator('body').evaluate((element) => element.classList.contains('child-workbench-active')), false, 'parent shell should not activate child workbench shell');

    await page.evaluate(() => window.switchPage('learn'));
    await page.waitForSelector('#learn-container .learn-shell', { state: 'attached', timeout: 20000 });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileLayout = await page.evaluate(() => ({
        bodyWidth: document.body.scrollWidth,
        viewportWidth: window.innerWidth,
        display: getComputedStyle(document.querySelector('.page-shell')).display,
        columns: getComputedStyle(document.querySelector('.page-shell')).gridTemplateColumns
    }));
    assert.ok(mobileLayout.bodyWidth <= mobileLayout.viewportWidth, `child workbench should not overflow on mobile: ${JSON.stringify(mobileLayout)}`);
    assert.equal(mobileLayout.display, 'flex', `mobile workbench should stack its columns: ${JSON.stringify(mobileLayout)}`);
    assert.deepEqual(errors, [], `child workbench should have no browser errors: ${JSON.stringify(errors)}`);
    console.log(JSON.stringify({ desktopColumns: '224px / content / 264px', mobileLayout, errors }));
} finally {
    await browser.close();
}
