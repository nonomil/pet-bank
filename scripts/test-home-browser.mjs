import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000/';
const homeUrl = new URL('app', baseUrl).href;
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
await page.addInitScript(() => { window.__PETBANK_TEST_MODE__ = true; });
const errors = [];
const showcaseStyleRequests = [];
const showcaseScriptRequests = [];

page.on('request', (request) => {
    if (request.url().includes('/css/showcase.css')) showcaseStyleRequests.push(request.url());
    if (request.url().includes('/js/showcase.js')) showcaseScriptRequests.push(request.url());
});

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

async function returnHome() {
    await page.evaluate(() => window.switchPage('map'));
    await assertActivePage('map');
}

try {
    await page.goto(homeUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.PetBankRuntime && window.switchPage, { timeout: 20000 });
    await page.waitForFunction(() => document.body.classList.contains('app-ready'), { timeout: 20000 });
    await assertActivePage('map');
    assert.match(await page.title(), /成长伙伴/);
    assert.equal(
        new URL(await page.url()).port,
        new URL(baseUrl).port,
        'home should be opened on the configured preview port'
    );
    await page.waitForSelector('#page-map .home-demo-workspace', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#page-map .home-demo-sidebar').count(), 1, 'home should render the demo-style left sidebar');
    assert.equal(await page.locator('#page-map .home-demo-focus-grid').count(), 1, 'home should render the demo-style main focus grid');
    assert.equal(await page.locator('#page-map .home-demo-right-rail').count(), 1, 'home should render the demo-style right progress rail');
    assert.equal(await page.locator('#page-map .home-demo-resource-card').count(), 5, 'home should render five compact common entries');

    const homeActionEntries = [
        ['#homeCommonEntries .home-demo-resource-card:nth-child(1)', 'today', '#taskGrid .task-card'],
        ['#homeCommonEntries .home-demo-resource-card:nth-child(2)', 'pet', '#petDisplayArea'],
        ['#homeCommonEntries .home-demo-resource-card:nth-child(3)', 'learn', '#learn-container .learn-shell', 'js/learn-center.js?v=7'],
        ['#homeCommonEntries .home-demo-resource-card:nth-child(4)', 'picturebooks', '#picturebooks-root .picturebooks-portal', 'js/picturebook-external-bridge.js'],
        ['#homeCommonEntries .home-demo-resource-card:nth-child(5)', 'playground', '#playgroundProgressBoard', 'js/math-pk.js?v=4'],
    ];
    for (const [selector, pageId, contentSelector] of homeActionEntries) {
        await clickUnique(selector, selector);
        await assertActivePage(pageId);
        await assertPageBinding(pageId, contentSelector);
        await returnHome();
    }

    const primaryEntries = [
        ['#childPrimaryNav [data-child-primary="map"]', 'map', '#page-map .home-demo-workspace'],
        ['#childPrimaryNav [data-child-primary="today"]', 'today', '#taskGrid .task-card'],
        ['#childPrimaryNav [data-child-primary="learn"]', 'learn', '#learn-container .learn-shell', 'js/learn-center.js?v=7'],
        ['#childPrimaryNav [data-child-primary="picturebooks"]', 'picturebooks', '#picturebooks-root .picturebooks-portal', 'js/picturebook-external-bridge.js'],
        ['#childPrimaryNav [data-child-primary="pet"]', 'pet', '#petDisplayArea'],
        ['#childPrimaryNav [data-child-primary="explore"]', 'explore', '#page-explore #pixelStoryShell', 'js/pixel-story-map.js?v=20260715-stage-fullscreen1'],
        ['#childPrimaryNav [data-child-primary="playground"]', 'playground', '#playgroundProgressBoard', 'js/math-pk.js?v=4'],
    ];
    for (const [selector, pageId, contentSelector, runtimeMarker] of primaryEntries) {
        await clickUnique(selector, pageId);
        await assertActivePage(pageId);
        await assertPageBinding(pageId, contentSelector, runtimeMarker);
        await returnHome();
    }

    await clickUnique('#childPrimarySidebar [data-child-action="parent"]', 'parent');
    await assertActivePage('parent');
    await assertPageBinding('parent', '#page-parent .parent-home-primary');
    await returnHome();

    const journeyEntries = [
        ['#childProgressRail [data-child-next="today"]', 'today'],
        ['#childProgressRail [data-child-next="learn"]', 'learn'],
    ];
    for (const [selector, pageId] of journeyEntries) {
        await clickUnique(selector, selector);
        await assertActivePage(pageId);
        if (pageId === 'today') await assertPageBinding(pageId, '#taskGrid .task-card');
        if (pageId === 'pet') await assertPageBinding(pageId, '#petDisplayArea');
        if (pageId === 'playground') await assertPageBinding(pageId, '#playgroundProgressBoard');
        await returnHome();
    }

    await page.waitForSelector('#showcaseTrack .showcase-slide', { state: 'attached', timeout: 20000 });
    assert.equal(showcaseStyleRequests.length, 1, `home should fetch the showcase stylesheet once: ${JSON.stringify(showcaseStyleRequests)}`);
    assert.equal(showcaseScriptRequests.length, 1, `home should fetch the showcase script once: ${JSON.stringify(showcaseScriptRequests)}`);
    const showcaseSlides = page.locator('#showcaseTrack .showcase-slide');
    const showcaseDots = page.locator('#showcaseDots .showcase-dot');
    assert.equal(await showcaseSlides.count(), 7, 'home showcase should expose seven clickable primary columns');
    assert.equal(await showcaseDots.count(), 7, 'home showcase should expose seven slide controls');
    const showcaseEntries = [
        ['成长总览', 'map', '#page-map .home-demo-workspace'],
        ['今日打卡', 'today', '#taskGrid .task-card'],
        ['学习中心', 'learn', '#learn-container .learn-shell', 'js/learn-center.js?v=7'],
        ['绘本书架', 'picturebooks', '#picturebooks-root .picturebooks-portal', 'js/picturebook-external-bridge.js'],
        ['宠物伙伴', 'pet', '#petDisplayArea'],
        ['故事地图', 'explore', '#page-explore #pixelStoryShell', 'js/pixel-story-map.js?v=20260715-stage-fullscreen1'],
        ['游乐场', 'playground', '#playgroundProgressBoard', 'js/math-pk.js?v=4'],
    ];
    for (let index = 0; index < showcaseEntries.length; index += 1) {
        const [title, pageId, contentSelector, runtimeMarker] = showcaseEntries[index];
        await showcaseDots.nth(index).click();
        await page.waitForFunction((expectedIndex) => document.querySelector('#showcaseTrack .showcase-slide.active')?.dataset.index === String(expectedIndex), index);
        const slide = page.locator(`#showcaseTrack .showcase-slide[aria-label="打开${title}"]`);
        assert.equal(await slide.count(), 1, `${title} showcase slide should exist`);
        await slide.click();
        await assertActivePage(pageId);
        await assertPageBinding(pageId, contentSelector, runtimeMarker);
        await returnHome();
    }
    await page.locator('#showcaseDots .showcase-dot').nth(0).click();
    await page.locator('#showcaseNext').click();
    await page.waitForFunction(() => document.querySelector('#showcaseTrack .showcase-slide.active')?.dataset.index === '1');
    await page.locator('#showcasePrev').click();
    await page.waitForFunction(() => document.querySelector('#showcaseTrack .showcase-slide.active')?.dataset.index === '0');

    await page.waitForSelector('#treasureWarehouseGrid .chest-card', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#treasureWarehouseGrid .chest-card').count(), 3, 'home should render all three reward chest entries');

    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
    assert.ok(layout.bodyWidth <= layout.viewportWidth, `home should not overflow on mobile: ${JSON.stringify(layout)}`);
    assert.deepEqual(errors, [], `home flow should have no browser errors: ${JSON.stringify(errors)}`);
    console.log(JSON.stringify({ homeUrl, primaryEntries: primaryEntries.map(([, pageId]) => pageId), layout, errors }));
} finally {
    await browser.close();
}
