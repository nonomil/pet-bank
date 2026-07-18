import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000/';
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];

page.on('pageerror', (error) => errors.push(String(error?.message || error)));
page.on('console', (message) => {
    if (message.type() === 'error' && !/404|favicon|Failed to load resource/i.test(message.text())) errors.push(message.text());
});

try {
    await page.goto(new URL('app/explore/forest', baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.PetBankRuntime && window.switchPage, { timeout: 20000 });
    await page.waitForSelector('#forestMapSceneGrid .map-scene-node', { state: 'attached', timeout: 20000 });

    await page.locator('#forestMapSceneGrid .map-scene-node').first().click();
    await page.waitForSelector('#explorationStageRoot .galgame-stage', { state: 'visible', timeout: 20000 });
    assert.equal(await page.locator('#explorationStageRoot .galgame-stage').count(), 1, 'forest dialogue has one dedicated stage');
    assert.equal(await page.locator('#page-map').count(), 1, 'home page remains mounted');
    assert.equal(await page.locator('#page-explore #pixelStoryShell').count(), 1, 'story map remains mounted');
    assert.equal(await page.locator('#page-explore #sceneGrid').count(), 0, 'forest dialogue does not create a legacy explore grid');

    await page.locator('#explorationStageRoot .galgame-back').evaluate((button) => button.click());
    await page.waitForSelector('#explorationStageRoot', { state: 'hidden', timeout: 20000 });
    await page.waitForSelector('#page-forest-map.active #forestMapSceneGrid .map-scene-node', { state: 'attached', timeout: 20000 });
    assert.equal(await page.locator('#explorationStageRoot .galgame-stage').count(), 0, 'forest stage is cleared after exit');
    assert.equal(await page.locator('#page-explore #pixelStoryShell').count(), 1, 'story map is still mounted after forest exit');
    assert.deepEqual(errors, [], 'forest return flow has no browser errors');
    console.log(JSON.stringify({ stageCleared: true, storyShellPreserved: true, errors }));
} finally {
    await browser.close();
}
