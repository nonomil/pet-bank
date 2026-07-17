import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000/';
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
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
    await page.waitForSelector('#pixelStoryMapContainer .pixel-story-node', { state: 'attached', timeout: 20000 });

    const storyData = await page.evaluate(async () => {
        const manifest = await fetch('data/story-packs/05-pixel-worlds-story/manifest.json').then((r) => r.json());
        return { manifest };
    });
    assert.ok(await page.locator('#pixelStoryMapContainer .pixel-story-node').count() >= 1, 'map renders the first unlocked sci-fi node');
    assert.equal(await page.locator('.pixel-story-map-bg').evaluate((image) => image.complete && image.naturalWidth > 0), true, 'story map background loads');
    assert.ok(await page.locator('.pixel-story-node .pixel-story-node-icon[src]').count() >= 1, 'unlocked story node icons render as images');
    assert.ok(await page.locator('.pixel-story-node .pixel-story-node-icon[src]').evaluateAll((images) => images.every((image) => image.complete && image.naturalWidth > 0)), 'all v2 node icons load');
    assert.equal(storyData.manifest.levelCount, 60);
    assert.equal(storyData.manifest.bonusLevelCount, 20);
    assert.deepEqual(storyData.manifest.worlds.map((world) => world.nodes.length), [20, 20, 20]);
    assert.equal(storyData.manifest.bonusTracks[0].nodes.length, 20);

    await page.locator('#pixelStoryMapContainer .pixel-story-node').first().evaluate((node) => node.click());
    await page.waitForSelector('.pixel-story-stage', { state: 'attached' });
    await page.waitForSelector('#pixelStoryText', { state: 'visible' });
    await page.waitForFunction(() => {
        const image = document.querySelector('#pixelStoryBg');
        return image && image.complete && image.naturalWidth > 0;
    }, { timeout: 20000 });
    assert.equal(await page.locator('#pixelStoryBg').evaluate((image) => image.complete && image.naturalWidth > 0), true, 'v2 chapter background loads');
    assert.match(await page.locator('#pixelStoryText').textContent(), /星港/);

    await page.locator('#pixelStoryBox').evaluate((node) => node.click());
    await page.waitForFunction(() => document.querySelector('#pixelStoryText')?.textContent.includes('星港登船舱'));
    await page.waitForFunction(() => {
        const image = document.querySelector('#pixelStorySpriteL');
        return image && image.complete && image.naturalWidth > 0;
    }, { timeout: 20000 });
    assert.equal(await page.locator('#pixelStorySpriteL').evaluate((image) => image.complete && image.naturalWidth > 0), true, 'protagonist sprite loads');
    await page.locator('#pixelStoryBox').evaluate((node) => node.click());
    await page.locator('#pixelStoryBox').evaluate((node) => node.click());
    await page.locator('#pixelStoryBox').evaluate((node) => node.click());
    await page.waitForSelector('.pixel-story-activity-btn', { state: 'visible' });
    await page.locator('.pixel-story-activity-btn').first().click();
    await page.waitForSelector('.pixel-story-feedback.correct', { state: 'visible' });
    await page.locator('.pixel-story-continue-btn').click();
    const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('petbank_pixel_worlds_progress_v1') || '{}'));
    assert.equal(progress.storyId, 'pixel-worlds-story', 'new story progress key is used');

    await page.setViewportSize({ width: 390, height: 844 });
    const layout = await page.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
    assert.ok(layout.bodyWidth <= layout.viewportWidth, `pixel story has no mobile horizontal overflow: ${JSON.stringify(layout)}`);
    await page.screenshot({ path: 'tmp/pixel-story-browser.png', fullPage: true });
    assert.deepEqual(errors, [], 'pixel story browser flow has no page errors');
    console.log(JSON.stringify({ worlds: storyData.manifest.worlds.length, nodes: 60, detectiveNodes: 20, progress, layout, errors }));
} finally {
    await browser.close();
}
