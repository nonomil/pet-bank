// Task 3 smoke check: shop buyFurniture + home ownership linkage + duplicate block
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

// Fresh state + 200 points
await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('petbank_points', '200');
});

await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.ShopSystem && typeof window.ShopSystem.buyFurniture === 'function', { timeout: 8000 });
// Wait for catalog to be loaded
await page.waitForFunction(() => window.HomeSystem && window.HomeSystem.getFurnitureCatalog().length >= 8, { timeout: 8000 });

// Test 1: purchase reaches home ownership
const r1 = await page.evaluate(() => {
    const ok = window.ShopSystem.buyFurniture('cozy_rug');
    const owned = JSON.parse(localStorage.getItem('petbank_home_furniture') || '[]');
    return { buyReturned: ok, ownedIncludes: owned.includes('cozy_rug') };
});
check('buyFurniture(cozy_rug) returns true', r1.buyReturned === true);
check('petbank_home_furniture contains cozy_rug', r1.ownedIncludes === true);

// Test 2: duplicate purchase is blocked (no double-charge, no duplicate)
const r2 = await page.evaluate(() => {
    const pointsBefore = parseInt(localStorage.getItem('petbank_points') || '0', 10);
    const ownedBefore = JSON.parse(localStorage.getItem('petbank_home_furniture') || '[]');
    const ok = window.ShopSystem.buyFurniture('cozy_rug');
    const pointsAfter = parseInt(localStorage.getItem('petbank_points') || '0', 10);
    const ownedAfter = JSON.parse(localStorage.getItem('petbank_home_furniture') || '[]');
    return {
        secondBuyBlocked: ok === false,
        pointsUnchanged: pointsAfter === pointsBefore,
        noDuplicate: ownedAfter.filter(x => x === 'cozy_rug').length === 1,
        ownedCountUnchanged: ownedAfter.length === ownedBefore.length
    };
});
check('duplicate buyFurniture blocked (returns false)', r2.secondBuyBlocked === true);
check('points not decremented on blocked buy', r2.pointsUnchanged === true);
check('no duplicate cozy_rug in ownership', r2.noDuplicate === true);
check('ownership count unchanged after blocked buy', r2.ownedCountUnchanged === true);

// Test 3: points were actually decremented by 35 for the successful purchase
const r3 = await page.evaluate(() => parseInt(localStorage.getItem('petbank_points') || '0', 10));
check('points decremented by 35 (200 -> 165)', r3 === 165);

// Test 4: 家园装饰 section renders in shop UI with slot badge
await page.evaluate(() => window.switchPage('shop'));
await page.waitForTimeout(300);
const uiCheck = await page.evaluate(() => {
    const shopEl = document.getElementById('shop-ui');
    if (!shopEl) return { hasSection: false, hasBadge: false, hasOwnedBtn: false };
    const txt = shopEl.textContent;
    return {
        hasSection: txt.includes('家园装饰'),
        hasBadge: txt.includes('地面') || txt.includes('角落') || txt.includes('背景'),
        hasOwnedBtn: txt.includes('已拥有')
    };
});
check('shop UI shows 家园装饰 section', uiCheck.hasSection);
check('shop UI shows slot badge label', uiCheck.hasBadge);
check('shop UI shows 已拥有 button for owned cozy_rug', uiCheck.hasOwnedBtn);

check('no new console errors', consoleErrors.length === 0);

await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.filter(r => r.pass).length}/${results.length} passed`);
if (failed.length) {
    console.log('FAILURES:', failed.map(f => f.name).join('; '));
    process.exit(1);
}
process.exit(0);
