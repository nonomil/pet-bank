import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765/';
const chapters = [
    ['sci-fi', 'sf-01', 'moon-station.png'],
    ['forest', 'forest-01', 'forest.webp'],
    ['block', 'block-01', 'cave.webp'],
    ['detective', 'detective-01', 'moon-station.png']
];
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
    await page.evaluate(() => window.switchPage('explore'));
    await page.waitForSelector('#pixelStoryMapContainer .pixel-story-node', { state: 'attached', timeout: 20000 });

    for (let index = 0; index < chapters.length; index += 1) {
        const [trackId, chapterId, backgroundName] = chapters[index];
        await page.locator(`#pixelStoryMapContainer [data-world="${trackId}"]`).click();
        await page.waitForSelector(`#pixelStoryMapContainer .pixel-story-node[data-chapter="${chapterId}"]`, { state: 'attached', timeout: 20000 });
        await page.waitForFunction(() => {
            const image = document.querySelector('#pixelStoryMapContainer .pixel-story-map-bg');
            return Boolean(image && image.complete && image.naturalWidth > 0);
        }, { timeout: 20000 });
        const mapState = await page.locator('#pixelStoryMapContainer .pixel-story-map-bg').evaluate((image) => ({ src: image.src, width: image.naturalWidth, height: image.naturalHeight }));
        assert.match(mapState.src, new RegExp(`pixel-worlds-v1/maps/${trackId}\\.png`), `${trackId}: generated map background is active`);
        assert.ok(mapState.width > 0 && mapState.height > 0, `${trackId}: generated map background has pixels`);
        await page.locator(`#pixelStoryMapContainer .pixel-story-node[data-chapter="${chapterId}"]`).click();
        await page.waitForSelector('.pixel-story-stage', { state: 'attached', timeout: 20000 });
        await page.waitForFunction(() => {
            const image = document.getElementById('pixelStoryBg');
            return Boolean(image && image.complete && image.naturalWidth > 0);
        }, { timeout: 20000 });
        const state = await page.locator('#pixelStoryBg').evaluate((image) => ({ src: image.src, width: image.naturalWidth, height: image.naturalHeight }));
        assert.match(state.src, new RegExp(backgroundName.replace('.', '\\.') ), `${chapterId}: expected background is active`);
        assert.ok(state.width > 0 && state.height > 0, `${chapterId}: background has pixels`);
        await page.screenshot({ path: `tmp/pixel-story-${index + 1}-${chapterId}.png`, fullPage: true });
        await page.locator('#pixelStoryBack').click();
        await page.waitForSelector('#pixelStoryMapContainer .pixel-story-node', { state: 'attached', timeout: 20000 });
    }

    assert.deepEqual(errors, [], 'all story chapter screens have no page errors');
    console.log(JSON.stringify({ chapters: chapters.map(([, id]) => id), errors }));
} finally {
    await browser.close();
}
