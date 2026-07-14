import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765/';
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
    await page.evaluate(() => window.switchPage('explore'));
    await page.waitForSelector('#pixelStoryMapContainer .pixel-story-node', { state: 'attached', timeout: 20000 });

    assert.equal(await page.locator('#pixelStoryMapContainer .pixel-story-node').count(), 1, 'first small map page renders only the unlocked node');
    assert.equal(await page.locator('#pixelStoryMapContainer [data-map-page-label]').textContent(), '第 1/4 页', 'first page marker');
    assert.equal(await page.locator('#pixelStoryMapContainer [data-chapter="sf-02"]').count(), 0, 'locked node is not rendered as a bubble');

    await page.locator('#pixelStoryMapContainer [data-map-page-next]').click();
    await page.waitForFunction(() => document.querySelector('#pixelStoryMapContainer [data-map-page-label]')?.textContent === '第 2/4 页');
    assert.equal(await page.locator('#pixelStoryMapContainer .pixel-story-node').count(), 0, 'second small map page hides locked nodes');
    assert.equal(await page.locator('#pixelStoryMapContainer [data-chapter="sf-06"]').count(), 0, 'later locked nodes stay hidden');

    await page.locator('#pixelStoryMapContainer [data-map-page-prev]').click();
    await page.evaluate(() => {
        localStorage.setItem('petbank_pixel_worlds_progress_v1', JSON.stringify({
            schemaVersion: 1,
            storyId: 'pixel-worlds-story',
            chapters: { 'sf-01': { completed: true, completedAt: Date.now() } }
        }));
        window.PixelStoryEngine.showMap();
    });
    await page.waitForSelector('#pixelStoryMapContainer [data-chapter="sf-02"]', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#pixelStoryMapContainer .pixel-story-node').count(), 2, 'completing a node reveals only the next node');
    await page.locator('#pixelStoryMapContainer [data-chapter="sf-01"]').click();
    await page.waitForSelector('.pixel-story-scene', { state: 'attached', timeout: 20000 });
    await page.locator('.pixel-story-dialogue').click();
    await page.waitForFunction(() => {
        const scene = document.querySelector('.pixel-story-scene');
        const dialogue = document.querySelector('.pixel-story-dialogue');
        return scene && dialogue && getComputedStyle(dialogue).display !== 'none' && dialogue.getBoundingClientRect().top >= scene.getBoundingClientRect().bottom - 1;
    });
    assert.equal(await page.locator('.pixel-story-scene + .pixel-story-dialogue').count(), 1, 'dialogue is a sibling below the image scene');

    await page.setViewportSize({ width: 390, height: 844 });
    const mobileLayout = await page.evaluate(() => {
        const scene = document.querySelector('.pixel-story-scene');
        const dialogue = document.querySelector('.pixel-story-dialogue');
        return {
            bodyWidth: document.body.scrollWidth,
            viewportWidth: innerWidth,
            sceneBottom: scene?.getBoundingClientRect().bottom,
            dialogueTop: dialogue?.getBoundingClientRect().top
        };
    });
    assert.ok(mobileLayout.bodyWidth <= mobileLayout.viewportWidth, `mobile story has no horizontal overflow: ${JSON.stringify(mobileLayout)}`);
    assert.ok(mobileLayout.dialogueTop >= mobileLayout.sceneBottom - 1, 'mobile dialogue stays below the image');

    assert.deepEqual(errors, [], 'pagination flow has no page errors');
    console.log(JSON.stringify({ pages: 4, nodesPerPage: 5, mobileLayout, errors }));
} finally {
    await browser.close();
}
