import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const BASE = process.env.MMWG_E2E_BASE_URL || 'http://127.0.0.1:7000';
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error?.message || error)));
page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
});

try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => typeof window.switchPage === 'function', { timeout: 15000 });
    await page.evaluate(() => {
        Object.keys(localStorage).filter(key => key.includes('minecraft_vocab')).forEach(key => localStorage.removeItem(key));
        localStorage.removeItem('petbank_game_reward_receipts_v1');
        localStorage.removeItem('petbank_core_reward_receipts_v1');
        localStorage.setItem('petbank_points', '0');
        window.switchPage('minecraft-vocab');
    });
    await page.waitForSelector('#minecraft-vocab-root [data-minecraft-vocab-page]', { timeout: 15000 });
    await page.waitForSelector('#minecraft-vocab-root [data-mv-region="grassland-trail"]', { timeout: 15000 });

    const home = await page.evaluate(() => ({
        regions: [...document.querySelectorAll('[data-mv-region]')].map(node => ({ id: node.dataset.mvRegion, className: node.className })),
        collection: document.querySelector('.mv-collection-strip')?.textContent || '',
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    }));
    assert.equal(home.regions.length, 3);
    assert.match(home.regions[0].className, /is-available/);
    assert.match(home.regions[1].className, /is-locked/);
    assert.match(home.collection, /收藏册/);
    assert.equal(home.overflow, false);

    await page.click('[data-mv-region="grassland-trail"]');
    await page.waitForSelector('#minecraft-vocab-root [data-mv-session]', { timeout: 10000 });
    const mission = await page.evaluate(() => ({
        text: document.querySelector('#minecraft-vocab-root')?.innerText || '',
        taskLabel: document.querySelector('.mv-session-meta')?.textContent || '',
        cardImage: document.querySelector('[data-mv-card-image]')?.getAttribute('src') || '',
        audioButtons: document.querySelectorAll('[data-mv-listen]').length,
        flipCard: !!document.querySelector('[data-mv-flip-card]')
    }));
    assert.match(mission.text, /第 1 \/ 4|1 \/ 4/);
    assert.match(mission.taskLabel, /1 \/ 4|1\/4/);
    assert.match(mission.cardImage, /assets\/learn\/english-vocab\/minecraft-cards\/normalized\/card-/);
    assert.equal(mission.audioButtons >= 1, true);
    assert.equal(mission.flipCard, true);

    for (let index = 0; index < 4; index += 1) {
        const known = page.locator('[data-mv-self-assess="known"]');
        if (await known.count()) await known.click();
        else await page.locator('[data-mv-choice]').first().click();
        await page.waitForTimeout(100);
    }
    await page.waitForSelector('#minecraft-vocab-root [data-mv-complete]', { timeout: 10000 });
    assert.match(await page.locator('[data-mv-return-camp]').textContent(), /回到营地地图/);
    await page.click('[data-mv-return-camp]');
    await page.waitForSelector('#minecraft-vocab-root [data-mv-region="grassland-trail"].is-cleared', { timeout: 10000 });
    const unlocked = await page.evaluate(() => ({
        first: document.querySelector('[data-mv-region="grassland-trail"]')?.className || '',
        second: document.querySelector('[data-mv-region="mineshaft-entrance"]')?.className || '',
        points: Number(localStorage.getItem('petbank_points') || 0)
    }));
    assert.match(unlocked.first, /is-cleared/);
    assert.match(unlocked.second, /is-available/);
    assert.equal(unlocked.points, 3);

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        nodes: document.querySelectorAll('[data-mv-region]').length,
        routeColumns: getComputedStyle(document.querySelector('.mv-region-route')).gridTemplateColumns
    }));
    assert.equal(mobile.overflow, false);
    assert.equal(mobile.nodes, 3);
    assert.match(mobile.routeColumns, /^\d+px$/);
    assert.deepEqual(errors, []);
    console.log('minecraft expedition browser: PASS');
} finally {
    await browser.close();
}
