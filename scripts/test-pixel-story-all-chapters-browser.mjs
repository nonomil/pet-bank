import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000/';
const chapters = [
    ['sci-fi', 'sf-01', 'sf-01.webp'],
    ['forest', 'forest-01', 'forest-01.webp'],
    ['block', 'block-01', 'block-01.webp'],
    ['detective', 'detective-01', 'detective-01.webp']
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
    await page.evaluate(async () => {
        await window.switchPage('explore');
    });
    await page.waitForSelector('#pixelStoryMapContainer .pixel-story-node', { state: 'attached', timeout: 20000 });

    for (let index = 0; index < chapters.length; index += 1) {
        const [trackId, chapterId, backgroundName] = chapters[index];
        const trackButton = page.locator(`#pixelStoryMapContainer [data-world="${trackId}"]`);
        if (trackId === 'detective') await page.locator('#pixelStoryMapContainer [data-detective-bonus]').click();
        else await trackButton.click();
        await page.waitForSelector(`#pixelStoryMapContainer .pixel-story-node[data-chapter="${chapterId}"]`, { state: 'attached', timeout: 20000 });
        await page.waitForFunction(() => {
            const image = document.querySelector('#pixelStoryMapContainer .pixel-story-map-bg');
            return Boolean(image && image.complete && image.naturalWidth > 0);
        }, { timeout: 20000 });
        const mapState = await page.locator('#pixelStoryMapContainer .pixel-story-map-bg').evaluate((image) => ({ src: image.src, width: image.naturalWidth, height: image.naturalHeight }));
        assert.match(mapState.src, new RegExp(`pixel-worlds-v1/maps/${trackId}\\.webp`), `${trackId}: optimized map background is active`);
        assert.ok(mapState.width > 0 && mapState.height > 0, `${trackId}: generated map background has pixels`);
        const nodeIconState = await page.locator(`#pixelStoryMapContainer .pixel-story-node[data-chapter="${chapterId}"] .pixel-story-node-icon`).evaluate((image) => ({ src: image.src, width: image.naturalWidth, height: image.naturalHeight }));
        assert.match(nodeIconState.src, new RegExp(`pixel-worlds-v1/icons/${trackId}/`), `${trackId}: route-specific node icon is active`);
        assert.ok(nodeIconState.width > 0 && nodeIconState.height > 0, `${chapterId}: route-specific node icon has pixels`);
        await page.locator(`#pixelStoryMapContainer .pixel-story-node[data-chapter="${chapterId}"]`).click();
        if (trackId === 'block') {
            await page.waitForSelector('#page-minecraft-vocab.active [data-mv-story]', { state: 'attached', timeout: 20000 });
            await page.waitForFunction(() => {
                const image = document.querySelector('[data-mv-story-image]');
                return Boolean(image && image.complete && image.naturalWidth > 0);
            }, { timeout: 20000 });
            const expeditionState = await page.locator('#minecraft-vocab-root').evaluate((root) => ({
                region: window.MinecraftVocabExplorationBridge?.getReturnContext?.()?.regionId || '',
                imageWidth: root.querySelector('[data-mv-story-image]')?.naturalWidth || 0,
                text: root.innerText
            }));
            assert.equal(expeditionState.region, 'grassland-trail', 'block story node should open the matching vocabulary expedition');
            assert.ok(expeditionState.imageWidth > 0, 'vocabulary expedition story image has pixels');
            assert.match(expeditionState.text, /草原小径|Grassland Trail/, 'vocabulary expedition story keeps its region title');
            await page.locator('[data-mv-back]').click();
            await page.waitForSelector('#pixelStoryMapContainer .pixel-story-node', { state: 'attached', timeout: 20000 });
            await page.evaluate((id) => window.PixelStoryEngine.enterChapter(id), chapterId);
        }
        await page.waitForSelector('.pixel-story-stage', { state: 'attached', timeout: 20000 });
        await page.waitForFunction(() => {
            const image = document.getElementById('pixelStoryBg');
            return Boolean(image && image.complete && image.naturalWidth > 0);
        }, { timeout: 20000 });
        const state = await page.locator('#pixelStoryBg').evaluate((image) => ({ src: image.src, width: image.naturalWidth, height: image.naturalHeight }));
        assert.match(state.src, new RegExp(backgroundName.replace('.', '\\.') ), `${chapterId}: expected background is active`);
        assert.ok(state.width > 0 && state.height > 0, `${chapterId}: background has pixels`);
        await page.locator('.pixel-story-dialogue').click();
        await page.waitForFunction(() => {
            const image = document.getElementById('pixelStoryProp');
            return Boolean(image && image.complete && image.naturalWidth > 0);
        }, { timeout: 20000 });
        const propState = await page.locator('#pixelStoryProp').evaluate((image) => ({ src: image.src, width: image.naturalWidth, height: image.naturalHeight }));
        assert.ok(propState.width > 0 && propState.height > 0, `${chapterId}: node prop has pixels`);
        await page.screenshot({ path: `tmp/pixel-story-${index + 1}-${chapterId}.png`, fullPage: true });
        await page.locator('#pixelStoryBack').click();
        await page.waitForSelector('#pixelStoryMapContainer .pixel-story-node', { state: 'attached', timeout: 20000 });
    }

    assert.deepEqual(errors, [], 'all story chapter screens have no page errors');
    console.log(JSON.stringify({ chapters: chapters.map(([, id]) => id), errors }));
} finally {
    await browser.close();
}
