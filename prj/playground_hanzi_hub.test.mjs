import { chromium } from 'playwright';
import { browserLaunchOpts } from '../scripts/playwright-browser.mjs';

const BASE = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765';

const results = [];
function check(name, cond, detail = '') {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

const browser = await chromium.launch(browserLaunchOpts());
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

async function waitForSection(pageName, expectedTab) {
    await page.waitForFunction(({ name, tab }) => {
        const activeTab = document.querySelector('.nav-tab.active')?.dataset.page || null;
        const activePage = document.querySelector('.page.active')?.id || '';
        const shellRoutePage = document.body.dataset.appRoutePage || '';
        return activeTab === tab && (activePage === `page-${name}` || shellRoutePage === name);
    }, { name: pageName, tab: expectedTab }, { timeout: 15000 });
}

const gamePages = ['playground', 'mathpk', 'hanzi', 'typing-defense', 'learning-arcade', 'word-memory-map', 'leaderboard'];
for (const pageName of gamePages) {
    await page.evaluate((name) => window.switchPage(name), pageName);
    await waitForSection(pageName, 'playground');
    const activeTab = await page.evaluate(() => document.querySelector('.nav-tab.active')?.dataset.page || null);
    check(`${pageName} stays under playground tab`, activeTab === 'playground', `got ${activeTab}`);
}

const managementPages = ['works', 'tools', 'settings'];
for (const pageName of managementPages) {
    await page.evaluate((name) => window.switchPage(name), pageName);
    await waitForSection(pageName, 'parent');
    const activeTab = await page.evaluate(() => document.querySelector('.nav-tab.active')?.dataset.page || null);
    check(`${pageName} stays under parent shortcut`, activeTab === 'parent', `got ${activeTab}`);
}

await page.evaluate(() => window.switchPage('playground'));
await page.click('.nav-hub[data-page="playground"] .nav-tab');
const playgroundMenu = await page.evaluate(() => ({
    text: document.querySelector('#topHubMenu')?.textContent || '',
    hidden: document.querySelector('#topHubMenu')?.hidden ?? true
}));
check('playground top menu opens', playgroundMenu.hidden === false);
check('playground top menu only exposes play entries', /数学 PK/.test(playgroundMenu.text) && /汉字游戏/.test(playgroundMenu.text) && /打字防线/.test(playgroundMenu.text) && /学习机小游戏/.test(playgroundMenu.text) && /单词记忆射击场/.test(playgroundMenu.text) && /卡牌对战/.test(playgroundMenu.text) && /排行榜/.test(playgroundMenu.text), playgroundMenu.text);
check('playground top menu hides management entries', !/成长作品|工具箱|设置/.test(playgroundMenu.text), playgroundMenu.text);

const managementShortcut = await page.evaluate(() => ({
    exists: !!document.querySelector('.nav-utility-settings[data-page="parent"]'),
    label: document.querySelector('.nav-utility-settings[data-page="parent"]')?.textContent?.trim() || ''
}));
check('top nav exposes a separate parent shortcut', managementShortcut.exists && /设置|管理|家长区/.test(managementShortcut.label), managementShortcut.label);

const playground = await page.evaluate(() => ({
    cards: Array.from(document.querySelectorAll('#page-playground .playground-grid .pg-img-card img')).map((el) => el.getAttribute('alt')?.trim()).filter(Boolean),
    featureText: document.querySelector('#page-playground .playground-feature-shell')?.innerText || ''
}));
check('playground hub shows 4 entry cards', playground.cards.length === 4, `got ${playground.cards.length}`);
check('playground hub includes Hanzi entry', playground.cards.includes('汉字游戏'));
check('playground hub exposes typing defense featured entry', /打字防线/.test(playground.featureText), playground.featureText);
check('playground hub exposes word memory map featured entry', /单词记忆射击场/.test(playground.featureText), playground.featureText);

await page.evaluate(() => window.switchPage('typing-defense'));
await page.waitForFunction(() => document.getElementById('typing-defense-frame')?.getAttribute('src')?.includes('/prj/'), { timeout: 15000 });
const typingDefense = await page.evaluate(() => ({
    status: document.getElementById('typing-defense-status')?.textContent?.trim() || '',
    hasFrame: !!document.getElementById('typing-defense-frame'),
    link: document.getElementById('typing-defense-launch')?.getAttribute('href') || '',
    summaryText: document.getElementById('typingDefenseSummary')?.textContent?.trim() || ''
}));
check('typing defense page mounts iframe container', typingDefense.hasFrame && /\/prj\//.test(typingDefense.link), JSON.stringify(typingDefense));
check('typing defense host summary panel renders', typingDefense.summaryText.length > 0, typingDefense.summaryText);
const typingFrame = page.frameLocator('#typing-defense-frame');
await typingFrame.locator('#overlayStart').click();
const hostPointsBefore = await page.evaluate(() => Number(localStorage.getItem('petbank_points') || '0'));
await typingFrame.locator('[data-enemy-badge="front"] .enemy-task-main').waitFor({ state: 'visible', timeout: 15000 });
const typingAnswer = await typingFrame.locator('[data-enemy-badge="front"] .enemy-task-main').textContent();
await typingFrame.locator('body').pressSequentially(String(typingAnswer || '').trim());
await page.waitForFunction((before) => Number(localStorage.getItem('petbank_points') || '0') > before, hostPointsBefore, { timeout: 15000 });
const hostPointsAfter = await page.evaluate(() => Number(localStorage.getItem('petbank_points') || '0'));
check('typing defense reward sync increases host points', hostPointsAfter > hostPointsBefore, `${hostPointsBefore} -> ${hostPointsAfter}`);
await page.waitForFunction(() => /最近主练|累计通关/.test(document.getElementById('typingDefenseSummary')?.innerText || ''), { timeout: 5000 });

await page.evaluate(() => window.switchPage('word-memory-map'));
await page.waitForFunction(() => document.getElementById('word-memory-map-frame')?.getAttribute('src')?.includes('/prj/'), { timeout: 15000 });
const wordMemoryMap = await page.evaluate(() => ({
    status: document.getElementById('word-memory-map-status')?.textContent?.trim() || '',
    hasFrame: !!document.getElementById('word-memory-map-frame'),
    link: document.getElementById('word-memory-map-launch')?.getAttribute('href') || '',
    pageText: document.getElementById('page-word-memory-map')?.textContent?.trim() || '',
    minHeight: window.getComputedStyle(document.getElementById('word-memory-map-frame') || document.body).minHeight || ''
}));
check('word memory map page mounts iframe container', wordMemoryMap.hasFrame && /\/prj\//.test(wordMemoryMap.link), JSON.stringify(wordMemoryMap));
check('word memory map host page exposes mode summary', /俯视地图|经典炮弹|支援道具/.test(wordMemoryMap.pageText), wordMemoryMap.pageText);
check('word memory map iframe inherits embed sizing', /760px|620px/.test(wordMemoryMap.minHeight), wordMemoryMap.minHeight);

await page.evaluate(() => {
    localStorage.removeItem('petbank_learning_arcade_progress');
    window.switchPage('learning-arcade');
});
await page.waitForFunction(() => document.getElementById('learning-arcade-frame')?.getAttribute('src')?.includes('/prj/'), { timeout: 15000 });
await page.waitForFunction(() => /已开局|最近结果/.test(document.getElementById('learningArcadeSummary')?.innerText || ''), { timeout: 5000 });
const arcadeSummaryBefore = await page.evaluate(() => document.getElementById('learningArcadeSummary')?.innerText || '');
check('learning arcade summary starts with zeroed bridge progress', /已开局\s*0 次/.test(arcadeSummaryBefore) && /已完成局数\s*0 局/.test(arcadeSummaryBefore), arcadeSummaryBefore);
const arcadeFrame = page.frameLocator('#learning-arcade-frame');
await arcadeFrame.locator('[data-game="word-shooter"]').click();
await page.waitForFunction(() => /已开局\s*1 次/.test(document.getElementById('learningArcadeSummary')?.innerText || ''), { timeout: 10000 });
const arcadeAfterStart = await page.evaluate(() => document.getElementById('learningArcadeSummary')?.innerText || '');
check('learning arcade start sync updates host summary', /已开局\s*1 次/.test(arcadeAfterStart) && /最近在玩\s*飞机大战/.test(arcadeAfterStart), arcadeAfterStart);
await arcadeFrame.locator('body').evaluate(() => {
    window.parent.postMessage({
        source: 'petbank-learning-arcade',
        kind: 'result',
        sessionId: 'learning-arcade-test',
        seq: 2,
        payload: {
            gameId: 'word-shooter',
            gameLabel: '飞机大战',
            title: '满星通关'
        }
    }, window.location.origin);
});
await page.waitForFunction(() => /已完成局数\s*1 局/.test(document.getElementById('learningArcadeSummary')?.innerText || ''), { timeout: 10000 });
const arcadeAfterResult = await page.evaluate(() => ({
    summaryText: document.getElementById('learningArcadeSummary')?.innerText || '',
    activityItems: JSON.parse(localStorage.getItem('petbank_battle_recent_activity') || '[]')
}));
check('learning arcade result sync updates host summary', /已完成局数\s*1 局/.test(arcadeAfterResult.summaryText) && /最近结果\s*满星通关/.test(arcadeAfterResult.summaryText), arcadeAfterResult.summaryText);
check('learning arcade result sync writes recent activity', Array.isArray(arcadeAfterResult.activityItems) && arcadeAfterResult.activityItems.some((item) => /飞机大战/.test(item?.title || '') && /学习机小游戏合集已回写主站记录/.test(item?.detail || '')), JSON.stringify(arcadeAfterResult.activityItems));

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
