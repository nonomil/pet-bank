import path from 'node:path';
import { chromium, devices } from 'playwright';

const BASE = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765';
const CAPTURE_DIR = process.env.PETBANK_CAPTURE_DIR || '';

const results = [];
function check(name, cond, detail = '') {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROME || undefined
});
const page = await browser.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
    if (msg.type() === 'error') {
        const text = msg.text();
        if (/Failed to load resource|404|net::ERR/i.test(text)) return;
        consoleErrors.push(text);
    }
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

await page.addInitScript(() => {
    localStorage.clear();
});

await page.goto(`${BASE}/index.html`);
await page.waitForFunction(
    () => window.ExplorationSystem && typeof window.ExplorationSystem.getMapLayout === 'function',
    { timeout: 8000 }
);
await page.waitForFunction(() => typeof window.switchPage === 'function', { timeout: 8000 });
await page.evaluate(() => window.switchPage('map'));
await page.waitForFunction(
    () => document.querySelectorAll('#treasureWarehouseGrid .chest-card').length >= 3,
    { timeout: 8000 }
);

const homeProbe = await page.evaluate(() => ({
    hasHomeMapBoard: !!document.getElementById('sceneGridMap'),
    hasTreasureWarehouse: !!document.getElementById('treasureWarehouseCard'),
    chestCount: document.querySelectorAll('#treasureWarehouseGrid .chest-card').length
}));

check('home dashboard removes route map board', homeProbe.hasHomeMapBoard === false);
check('home dashboard keeps treasure warehouse card', homeProbe.hasTreasureWarehouse);
check('home dashboard treasure warehouse still renders chests', homeProbe.chestCount >= 3, `got ${homeProbe.chestCount}`);

await page.evaluate(() => window.switchPage('explore'));
await page.waitForFunction(
    () => document.querySelectorAll('#sceneGrid .map-scene-node').length === 12,
    { timeout: 8000 }
);

const probe = await page.evaluate(() => {
    const layout = window.ExplorationSystem.getMapLayout();
    const board = document.getElementById('sceneGrid');
    const nodeEls = board ? Array.from(board.querySelectorAll('.map-scene-node')) : [];
    const blankEls = board ? Array.from(board.querySelectorAll('.map-blank-node')) : [];
    const ringGuideEls = board ? Array.from(board.querySelectorAll('.map-ring-guide')) : [];

    return {
        layoutLen: layout.length,
        ringValues: layout.map((node) => node.ring ?? null),
        uniqueRings: [...new Set(layout.map((node) => node.ring).filter(Boolean))],
        nodeCount: nodeEls.length,
        nodeRingClassCount: nodeEls.filter((el) => /\bring-\d+\b/.test(el.className)).length,
        ringGuideCount: ringGuideEls.length,
        blanksAreDecorative: blankEls.every((el) => (
            !el.hasAttribute('onclick') &&
            !el.hasAttribute('tabindex') &&
            el.getAttribute('aria-hidden') === 'true'
        ))
    };
});

check('layout keeps 12 scenes', probe.layoutLen === 12, `got ${probe.layoutLen}`);
check('layout defines at least 3 ring levels', probe.uniqueRings.length >= 3, `got ${probe.uniqueRings.length}`);
check('every scene has ring metadata', probe.ringValues.every(Boolean), JSON.stringify(probe.ringValues));
check('explore map renders 12 scene nodes', probe.nodeCount === 12, `got ${probe.nodeCount}`);
check('explore map nodes expose ring classes', probe.nodeRingClassCount === 12, `got ${probe.nodeRingClassCount}`);
check('explore map renders ring guide overlays', probe.ringGuideCount >= 3, `got ${probe.ringGuideCount}`);
check('blank cells stay decorative only', probe.blanksAreDecorative);
check('no new console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

if (CAPTURE_DIR) {
    await page.screenshot({ path: path.join(CAPTURE_DIR, 'map-desktop.png'), fullPage: true });
    await page.evaluate(() => window.switchPage('explore'));
    await page.waitForFunction(
        () => document.querySelectorAll('#sceneGrid .map-scene-node').length === 12,
        { timeout: 8000 }
    );
    await page.screenshot({ path: path.join(CAPTURE_DIR, 'explore-desktop.png'), fullPage: true });
}

await browser.close();

if (CAPTURE_DIR) {
    const mobileBrowser = await chromium.launch({
        executablePath: process.env.PW_CHROME || undefined
    });
    const mobileContext = await mobileBrowser.newContext({
        ...devices['iPhone 13']
    });
    const mobilePage = await mobileContext.newPage();
    await mobilePage.addInitScript(() => {
        localStorage.clear();
    });
    await mobilePage.goto(`${BASE}/index.html`);
    await mobilePage.waitForFunction(
        () => window.ExplorationSystem && typeof window.switchPage === 'function',
        { timeout: 8000 }
    );
    await mobilePage.evaluate(() => window.switchPage('map'));
    await mobilePage.waitForFunction(
        () => document.querySelectorAll('#treasureWarehouseGrid .chest-card').length >= 3,
        { timeout: 8000 }
    );
    await mobilePage.screenshot({ path: path.join(CAPTURE_DIR, 'map-mobile.png'), fullPage: true });
    await mobilePage.evaluate(() => window.switchPage('explore'));
    await mobilePage.waitForFunction(
        () => document.querySelectorAll('#sceneGrid .map-scene-node').length === 12,
        { timeout: 8000 }
    );
    await mobilePage.screenshot({ path: path.join(CAPTURE_DIR, 'explore-mobile.png'), fullPage: true });
    await mobileBrowser.close();
}

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.filter((item) => item.pass).length}/${results.length} passed`);

if (failed.length) {
    console.log('FAILURES:', failed.map((item) => item.name).join('; '));
    process.exit(1);
}

process.exit(0);
