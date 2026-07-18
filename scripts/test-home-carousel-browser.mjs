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
    if (message.type() === 'error' && !/404|favicon|Failed to load resource/i.test(message.text())) {
        errors.push(`console: ${message.text()}`);
    }
});

try {
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => document.body.classList.contains('app-ready'), { timeout: 20000 });
    await page.waitForSelector('#page-map.active #showcaseTrack .showcase-slide', { state: 'attached', timeout: 20000 });

    assert.equal(await page.locator('#page-map .home-demo-main #showcase').count(), 1, 'carousel belongs to the home main workspace');
    assert.equal(await page.locator('#showcaseTrack .showcase-slide').count(), 4, 'home carousel exposes four current columns');
    assert.equal(await page.locator('#showcaseDots .showcase-dot').count(), 4, 'home carousel exposes four slide controls');
    assert.equal(await page.locator('#exploreMapSwitcher').isHidden(), true, 'explore map switcher is hidden on home');
    assert.equal(await page.locator('#homeCommonEntries .home-demo-resource-card').count(), 5, 'home exposes five common entries');

    await page.locator('#showcaseDots .showcase-dot').nth(1).click();
    await page.waitForFunction(() => document.querySelector('#showcaseTrack .showcase-slide.active')?.dataset.index === '1');
    await page.locator('#showcaseNext').click();
    await page.waitForFunction(() => document.querySelector('#showcaseTrack .showcase-slide.active')?.dataset.index === '2');
    await page.locator('#showcasePrev').click();
    await page.waitForFunction(() => document.querySelector('#showcaseTrack .showcase-slide.active')?.dataset.index === '1');

    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
    assert.ok(layout.bodyWidth <= layout.viewportWidth, `home carousel has no mobile overflow: ${JSON.stringify(layout)}`);
    assert.deepEqual(errors, [], `home carousel has no browser errors: ${JSON.stringify(errors)}`);
    console.log(JSON.stringify({ homeUrl, slides: 4, commonEntries: 5, layout, errors }));
} finally {
    await browser.close();
}
