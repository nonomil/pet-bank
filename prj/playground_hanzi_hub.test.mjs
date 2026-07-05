import { chromium } from 'playwright';

const BASE = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765';

const results = [];
function check(name, cond, detail = '') {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME || undefined
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

const consoleErrors = [];
page.on('console', (msg) => {
    if (msg.type() === 'error') {
        const text = msg.text();
        if (/Failed to load resource|404|net::ERR/i.test(text)) return;
        consoleErrors.push(text);
    }
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => typeof window.switchPage === 'function', { timeout: 8000 });

const routedPages = ['playground', 'works', 'tools', 'settings', 'hanzi', 'leaderboard'];
for (const pageName of routedPages) {
    await page.evaluate((name) => window.switchPage(name), pageName);
    const activeTab = await page.evaluate(() => document.querySelector('.nav-tab.active')?.dataset.page || null);
    check(`${pageName} stays under playground tab`, activeTab === 'playground', `got ${activeTab}`);
}

await page.evaluate(() => window.switchPage('playground'));
const playground = await page.evaluate(() => ({
    cards: Array.from(document.querySelectorAll('#page-playground .playground-grid .pg-img-card img')).map((el) => el.getAttribute('alt')?.trim()).filter(Boolean)
}));
check('playground hub shows 4 entry cards', playground.cards.length === 4, `got ${playground.cards.length}`);
check('playground hub includes Hanzi entry', playground.cards.includes('汉字游戏'));

await page.evaluate(() => window.switchPage('hanzi'));
await page.waitForFunction(() => document.querySelectorAll('#page-hanzi .hz-level-card').length >= 4, { timeout: 15000 });
const hanzi = await page.evaluate(() => ({
    levelCount: document.querySelectorAll('#page-hanzi .hz-level-card').length,
    hasHsk1: Array.from(document.querySelectorAll('#page-hanzi .hz-level-card')).some((el) => el.textContent?.includes('HSK 1')),
    startText: document.querySelector('#page-hanzi .hz-start-btn')?.textContent?.trim() || ''
}));
check('hanzi lobby renders 4 level cards', hanzi.levelCount === 4, `got ${hanzi.levelCount}`);
check('hanzi lobby exposes HSK 1 entry', hanzi.hasHsk1);
check('hanzi lobby start button renders', /开始挑战/.test(hanzi.startText), hanzi.startText);

await page.evaluate(() => window.switchPage('leaderboard'));
const leaderboard = await page.evaluate(() => ({
    tabs: Array.from(document.querySelectorAll('#page-leaderboard .hz-lb-tab')).map((el) => el.textContent?.trim()),
    title: document.querySelector('#leaderboard-container h2')?.textContent?.trim() || ''
}));
check('leaderboard renders mathpk and hanzi tabs', leaderboard.tabs.length === 2 && leaderboard.tabs.some((text) => text.includes('汉字挑战')));
check('leaderboard renders a title', leaderboard.title.length > 0, leaderboard.title);
check('no new console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.filter((item) => item.pass).length}/${results.length} passed`);

if (failed.length) {
    console.log('FAILURES:', failed.map((item) => item.name).join('; '));
    process.exit(1);
}

process.exit(0);
