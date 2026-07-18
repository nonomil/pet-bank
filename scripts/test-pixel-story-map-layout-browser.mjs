import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000/';
const browser = await chromium.launch(browserLaunchOpts());
const failures = [];

function intersects(a, b) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

async function rect(page, selector, rootSelector) {
    return page.locator(rootSelector).evaluate((root, targetSelector) => {
        const element = root.querySelector(targetSelector);
        if (!element) return null;
        const value = element.getBoundingClientRect();
        return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height };
    }, selector);
}

async function openStoryMap(page) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.PetBankRuntime && window.switchPage, { timeout: 20000 });
    await page.evaluate(async () => { await window.switchPage('explore'); });
    await page.waitForSelector('#pixelStoryMapContainer .pixel-story-map', { state: 'attached', timeout: 20000 });
}

async function openHomeSciFiMap(page) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.PetBankRuntime && window.switchPage, { timeout: 20000 });
    await page.evaluate(async () => { await window.switchPage('explore'); });
    await page.waitForSelector('#pixelStoryMapContainer .pixel-story-map', { state: 'attached', timeout: 20000 });
}

async function checkStoryMap(page, viewportName) {
    await openStoryMap(page);
    const rootSelector = '#pixelStoryMapContainer';
    const tabs = await rect(page, '.pixel-story-map-world-tabs', rootSelector);
    const chrome = await rect(page, '.pixel-story-map-chrome', rootSelector);
    const pager = await rect(page, '.pixel-story-map-pager', rootSelector);
    const legend = await rect(page, '.pixel-story-map-legend', rootSelector);
    if (tabs && chrome && intersects(tabs, chrome)) failures.push(`${viewportName}: world tabs overlap map chrome`);
    if (viewportName === 'mobile' && pager && legend && intersects(pager, legend)) failures.push('mobile: pager overlaps map legend');

    const targetHeights = await page.locator(`${rootSelector} .pixel-story-world-tab, ${rootSelector} .pixel-story-map-page-btn`).evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
    if (viewportName === 'mobile' && targetHeights.some((height) => height < 44)) failures.push(`mobile: map touch target below 44px (${targetHeights.join(',')})`);
}

async function checkHomeMap(page) {
    await openHomeSciFiMap(page);
    const rootSelector = '#pixelStoryMapContainer';
    const chrome = await rect(page, '.pixel-story-map-chrome', rootSelector);
    const node = await rect(page, '.pixel-story-node', rootSelector);
    if (chrome && node && intersects(chrome, node)) failures.push('home mobile: first node overlaps map chrome');
}

try {
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobilePage = await mobileContext.newPage();
    await checkStoryMap(mobilePage, 'mobile');
    await checkHomeMap(mobilePage);
    await mobileContext.close();

    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const desktopPage = await desktopContext.newPage();
    await checkStoryMap(desktopPage, 'desktop');
    await desktopContext.close();

    assert.deepEqual(failures, [], failures.join('; '));
    console.log(JSON.stringify({ layout: 'desktop/mobile', failures }));
} finally {
    await browser.close();
}
