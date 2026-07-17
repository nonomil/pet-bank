import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000';
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(String(error?.message || error)));
page.on('console', (message) => {
    if (message.type() === 'error' && !/404|favicon|Failed to load resource/i.test(message.text())) {
        errors.push(message.text());
    }
});

try {
    await page.goto(`${baseUrl}/app/explore`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.PetBankRuntime && window.switchPage, { timeout: 20000 });
    await page.evaluate(() => localStorage.removeItem('petbank_pixel_worlds_progress_v1'));
    await page.waitForSelector('#pixelStoryMapContainer .pixel-story-node', { state: 'attached', timeout: 20000 });

    await page.locator('#pixelStoryMapContainer .pixel-story-node').first().evaluate((node) => node.click());
    await page.waitForSelector('.pixel-story-stage', { state: 'visible', timeout: 20000 });
    await page.waitForFunction(() => {
        const image = document.querySelector('#pixelStoryBg');
        return image && image.complete && image.naturalWidth > 0;
    }, { timeout: 20000 });

    const stageState = await page.evaluate(() => {
        const shell = document.querySelector('#pixelStoryShell');
        const stage = document.querySelector('.pixel-story-stage');
        const image = document.querySelector('#pixelStoryBg');
        const overview = document.querySelector('.pixel-story-overview');
        const modebar = document.querySelector('.pixel-story-modebar');
        const shellStyle = shell ? getComputedStyle(shell) : null;
        return {
            stageActive: shell?.dataset.view === 'stage',
            overviewHidden: !overview || getComputedStyle(overview).display === 'none',
            modebarHidden: !modebar || getComputedStyle(modebar).display === 'none',
            shellWidth: shell?.getBoundingClientRect().width || 0,
            viewportWidth: innerWidth,
            shellPadding: shellStyle?.padding || '',
            shellBorderWidth: shellStyle?.borderWidth || '',
            stageHeight: stage?.getBoundingClientRect().height || 0,
            viewportHeight: innerHeight,
            imageWidth: image?.naturalWidth || 0,
            imageRect: image ? { width: image.getBoundingClientRect().width, height: image.getBoundingClientRect().height } : null
        };
    });

    assert.equal(stageState.stageActive, true, 'entering a chapter marks the story shell as stage view');
    assert.equal(stageState.overviewHidden, true, 'story overview is hidden in stage view');
    assert.equal(stageState.modebarHidden, true, 'story mode switcher is hidden in stage view');
    assert.ok(stageState.shellWidth >= stageState.viewportWidth - 2, `story shell fills viewport: ${JSON.stringify(stageState)}`);
    assert.match(stageState.shellPadding, /^0(px)?$/, 'stage shell has no outer padding');
    assert.match(stageState.shellBorderWidth, /^0(px)?$/, 'stage shell has no outer border');
    assert.ok(stageState.stageHeight >= stageState.viewportHeight - 2, `story stage fills viewport: ${JSON.stringify(stageState)}`);
    assert.ok(stageState.imageWidth > 0 && stageState.imageRect.width > 0 && stageState.imageRect.height > 0, 'story background is visible');

    await page.locator('#pixelStoryBack').click();
    await page.waitForSelector('#pixelStoryMapContainer .pixel-story-node', { state: 'attached', timeout: 20000 });
    const mapState = await page.evaluate(() => ({
        view: document.querySelector('#pixelStoryShell')?.dataset.view || '',
        overview: document.querySelector('.pixel-story-overview'),
        modebar: document.querySelector('.pixel-story-modebar'),
        worldTabs: document.querySelectorAll('#pixelStoryMapContainer [data-world]').length
    }));
    assert.equal(mapState.view, 'map', 'returning from a chapter restores map view');
    assert.equal(mapState.overview, null, 'story overview is removed from the map shell');
    assert.equal(mapState.modebar, null, 'top-level mode switcher is removed from the map shell');
    assert.equal(mapState.worldTabs, 3, 'map keeps all three world switches');
    assert.deepEqual(errors, [], 'stage shell browser flow has no page errors');
    console.log(JSON.stringify({ stageState, mapState, errors }));
} finally {
    await browser.close();
}
