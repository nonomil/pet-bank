import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765/';
const libraryUrl = process.env.PETBANK_LIBRARY_URL || 'http://127.0.0.1:5174/picturebook-library/';
const reportPath = path.join(process.cwd(), 'tmp', 'picturebooks-library-browser-report.json');
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(String(error?.message || error)));
page.on('console', message => {
    if (message.type() === 'error' && !/404|favicon|Failed to load resource/i.test(message.text())) errors.push(message.text());
});

async function openPortal() {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.PetBankRuntime && window.switchPage, { timeout: 20000 });
    await page.evaluate(() => {
        localStorage.removeItem('petbank_points');
        localStorage.removeItem('petbank_pet');
        sessionStorage.removeItem('petbank_picturebook_launches_v1');
        window.switchPage('picturebooks');
    });
    await page.waitForSelector('#picturebooks-portal-cards .picturebooks-portal-card', { state: 'attached', timeout: 20000 });
}

try {
    await openPortal();
    assert.equal(await page.locator('.picturebooks-portal-card').count(), 25);
    assert.equal(await page.locator('#picturebooks-portal-cards img').count(), 25);

    const libraryPagePromise = context.waitForEvent('page');
    await page.locator('.picturebooks-portal-card').filter({ hasText: '好饿的小蛇' }).getByRole('button', { name: '打开独立绘本站' }).click();
    const libraryPage = await libraryPagePromise;
    await libraryPage.waitForLoadState('domcontentloaded');
    await libraryPage.waitForSelector('.book-card', { state: 'attached', timeout: 20000 });
    assert.equal(new URL(libraryPage.url()).origin, new URL(libraryUrl).origin);
    assert.equal(await libraryPage.locator('.book-card').count(), 25);
    const shelves = await libraryPage.locator('.shelf-list button').allTextContents();
    assert.ok(shelves.some(text => text.includes('经典名作')));
    assert.ok(shelves.some(text => text.includes('我的世界')));
    assert.ok(shelves.some(text => text.includes('启蒙阅读')));
    for (const [category, expectedCount] of [['经典名作', 8], ['我的世界', 7], ['启蒙阅读', 2]]) {
        await libraryPage.locator('.shelf-list button').filter({ hasText: category }).click();
        assert.equal(await libraryPage.locator('.book-card').count(), expectedCount, `${category} count`);
    }
    await libraryPage.locator('.shelf-list button').filter({ hasText: '全部绘本' }).click();
    assert.equal(await libraryPage.locator('.book-card').count(), 25);
    assert.match(await libraryPage.locator('.library-stat').last().textContent(), /可领取成长奖励/);

    await libraryPage.getByRole('button', { name: '好饿的小蛇 封面' }).click();
    for (let pageIndex = 1; pageIndex < 7; pageIndex += 1) {
        await libraryPage.getByRole('button', { name: '下一页' }).click();
    }
    assert.equal((await libraryPage.locator('.reader-progress-line').textContent()).trim(), '第 7 / 7 页');
    await libraryPage.getByRole('button', { name: '完成阅读' }).click();
    await libraryPage.waitForFunction(() => /成长奖励已到账/.test(document.querySelector('.reader-message')?.textContent || ''), null, { timeout: 5000 });

    assert.equal(await page.evaluate(() => localStorage.getItem('petbank_points')), '8');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('petbank_pet') || '{}').exp), 4);
    assert.match(await page.locator('#picturebooks-portal-feedback').textContent(), /成长分/);

    await libraryPage.getByRole('button', { name: '完成阅读' }).click();
    await libraryPage.waitForTimeout(150);
    assert.equal(await page.evaluate(() => localStorage.getItem('petbank_points')), '8');
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('petbank_pet') || '{}').exp), 4);

    const directPage = await context.newPage();
    await directPage.goto(libraryUrl, { waitUntil: 'domcontentloaded' });
    await directPage.waitForSelector('.book-card', { state: 'attached', timeout: 20000 });
    assert.equal(await directPage.locator('.book-card').count(), 25);
    assert.match(await directPage.locator('.library-stat').last().textContent(), /自由阅读模式/);
    await directPage.getByRole('button', { name: '故事世界' }).click();
    assert.match(await directPage.locator('.library-world').textContent(), /选一条路/);
    await directPage.getByRole('button', { name: '阅读报告' }).click();
    assert.match(await directPage.locator('.library-report').textContent(), /已读绘本/);
    await directPage.setViewportSize({ width: 390, height: 844 });
    const mobile = await directPage.evaluate(() => ({ bodyWidth: document.body.scrollWidth, viewportWidth: innerWidth }));
    assert.ok(mobile.bodyWidth <= mobile.viewportWidth, `mobile overflow: ${JSON.stringify(mobile)}`);

    const report = {
        portalCards: 25,
        libraryCards: 25,
        completion: { storyId: 'hungry-snake', pages: 7, points: 8, petExp: 4 },
        duplicatePoints: 8,
        directMode: '自由阅读模式',
        mobile,
        errors
    };
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(report));
} finally {
    await browser.close();
}
