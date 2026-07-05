// Regression: verify P1 features + existing shop/blindbox still work after Task 1-4
import { chromium } from 'playwright';

const BASE = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:4173';
const results = [];
function check(name, cond) {
    results.push({ name, pass: !!cond });
    console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}`);
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROME || undefined });
const page = await browser.newPage();

const consoleErrors = [];
page.on('console', msg => {
    if (msg.type() === 'error') {
        const t = msg.text();
        if (/Failed to load resource|404|net::ERR/i.test(t)) return;
        consoleErrors.push(t);
    }
});
page.on('pageerror', err => consoleErrors.push(String(err)));

await page.addInitScript(() => { localStorage.clear(); });
await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });

// Wait for full init
await page.waitForFunction(() => window.HomeSystem && window.ShopSystem && window.PetSystem, { timeout: 8000 });
await page.waitForFunction(() => window.HomeSystem.getFurnitureCatalog().length >= 8, { timeout: 8000 });

// P1: home renders with 4 interaction buttons, speech bubble api, bg api
await page.evaluate(() => window.switchPage('home'));
await page.waitForTimeout(300);
const homeUi = await page.evaluate(() => {
    const el = document.getElementById('home-container');
    const txt = el ? el.textContent : '';
    const btns = el ? el.querySelectorAll('.home-btn').length : 0;
    return {
        rendered: !!el && el.innerHTML.length > 100,
        has4Buttons: btns === 4,
        hasFeedBtn: txt.includes('喂食'),
        hasPlayBtn: txt.includes('玩耍'),
        hasBathBtn: txt.includes('洗澡'),
        hasRestBtn: txt.includes('治疗'),
        hasBg: !!el.querySelector('.home-bg'),
        hasPetWrap: !!el.querySelector('.home-pet-wrap')
    };
});
check('home renders', homeUi.rendered);
check('home has 4 interaction buttons', homeUi.has4Buttons);
check('home feed/play/bath/rest labels present', homeUi.hasFeedBtn && homeUi.hasPlayBtn && homeUi.hasBathBtn && homeUi.hasRestBtn);
check('home bg layer present (P1)', homeUi.hasBg);
check('home pet wrap present (P1 click speech)', homeUi.hasPetWrap);

// API surface preserved
const api = await page.evaluate(() => ({
    onPetClick: typeof window.HomeSystem.onPetClick === 'function',
    setHomeBg: typeof window.HomeSystem.setHomeBg === 'function',
    onRescue: typeof window.HomeSystem.onRescue === 'function',
    onFeed: typeof window.HomeSystem.onFeed === 'function',
    markExit: typeof window.HomeSystem.markExit === 'function'
}));
check('P1 APIs intact (onPetClick/setHomeBg/onRescue/onFeed/markExit)',
    api.onPetClick && api.setHomeBg && api.onRescue && api.onFeed && api.markExit);

// Shop: existing buy + openBox + new buyFurniture all present; blindbox + rewards render
await page.evaluate(() => window.switchPage('shop'));
await page.waitForTimeout(300);
const shopUi = await page.evaluate(() => {
    const el = document.getElementById('shop-ui');
    const txt = el ? el.textContent : '';
    return {
        rendered: !!el && el.innerHTML.length > 100,
        hasBlindbox: txt.includes('盲盒惊喜'),
        hasRewards: txt.includes('奖励兑换'),
        hasFurniture: txt.includes('家园装饰'),
        hasHistory: txt.includes('最近动态'),
        buyFn: typeof window.ShopSystem.buy === 'function',
        openBoxFn: typeof window.ShopSystem.openBox === 'function',
        buyFurnitureFn: typeof window.ShopSystem.buyFurniture === 'function'
    };
});
check('shop renders (blindbox+rewards+furniture+history)', shopUi.rendered && shopUi.hasBlindbox && shopUi.hasRewards && shopUi.hasFurniture && shopUi.hasHistory);
check('shop API intact (buy/openBox) + new buyFurniture', shopUi.buyFn && shopUi.openBoxFn && shopUi.buyFurnitureFn);

// Furniture count in shop should match runtime catalog minus default owned furniture
const furnCount = await page.evaluate(() => {
    const cards = document.querySelectorAll('#shop-ui .shop-grid');
    // The 家园装饰 grid is the 2nd grid (after rewards). Count cards in last grid.
    const last = cards[cards.length - 1];
    const rendered = last ? last.querySelectorAll('.shop-card').length : -1;
    const expected = Math.max(0, window.HomeSystem.getFurnitureCatalog().length - window.HomeSystem.getFurniture().length);
    return { rendered, expected };
});
check('shop 家园装饰 count matches runtime purchasable furniture', furnCount.rendered === furnCount.expected);

check('no new console errors', consoleErrors.length === 0);

await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.filter(r => r.pass).length}/${results.length} passed`);
if (failed.length) {
    console.log('FAILURES:', failed.map(f => f.name).join('; '));
    process.exit(1);
}
process.exit(0);
