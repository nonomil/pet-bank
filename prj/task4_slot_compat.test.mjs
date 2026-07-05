// Task 4 smoke check: slot compatibility + replacement semantics + unplaced tray
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

// Fresh state: own the default 2 + give cozy_rug + soft_cushion (both floor) for placement tests
await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('petbank_home_furniture', JSON.stringify(['food_bowl', 'bath_tub', 'wall_frame', 'cozy_rug', 'soft_cushion']));
    // center_left starts empty so we can test placement
    localStorage.setItem('petbank_home_state', JSON.stringify({
        slots: { center_left: null, center_right: null, corner_left: 'bath_tub', back: null, corner_right: null },
        theme: 'cozy_night'
    }));
});

await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.HomeSystem && window.HomeSystem.getFurnitureCatalog().length >= 8, { timeout: 8000 });

// Test 1: incompatible placement rejected (wall_frame=backdrop into center_left=floor)
const r1 = await page.evaluate(() => {
    const ok = window.HomeSystem.placeFurniture('wall_frame', 'center_left');
    const state = JSON.parse(localStorage.getItem('petbank_home_state'));
    return { placed: ok, slotValue: state.slots.center_left };
});
check('placeFurniture(wall_frame, center_left) rejected', r1.placed === false);
check('center_left still null after rejected placement', r1.slotValue === null);

// Test 2: compatible placement succeeds
const r2 = await page.evaluate(() => {
    const ok = window.HomeSystem.placeFurniture('cozy_rug', 'center_left');
    const state = JSON.parse(localStorage.getItem('petbank_home_state'));
    return { placed: ok, slotValue: state.slots.center_left };
});
check('placeFurniture(cozy_rug, center_left) succeeds', r2.placed === true);
check('center_left now cozy_rug', r2.slotValue === 'cozy_rug');

// Test 3: same-slot replacement - soft_cushion replaces cozy_rug, cozy_rug stays owned
const r3 = await page.evaluate(() => {
    const ok = window.HomeSystem.placeFurniture('soft_cushion', 'center_left');
    const state = JSON.parse(localStorage.getItem('petbank_home_state'));
    const owned = JSON.parse(localStorage.getItem('petbank_home_furniture'));
    const unplaced = window.HomeSystem.getUnplacedFurniture();
    return {
        placed: ok,
        slotValue: state.slots.center_left,
        cozyStillOwned: owned.includes('cozy_rug'),
        cozyInUnplaced: unplaced.includes('cozy_rug')
    };
});
check('replacement soft_cushion into center_left succeeds', r3.placed === true);
check('center_left now soft_cushion', r3.slotValue === 'soft_cushion');
check('replaced cozy_rug stays owned', r3.cozyStillOwned === true);
check('replaced cozy_rug appears in unplaced tray', r3.cozyInUnplaced === true);

// Test 4: canPlace() correctness
const r4 = await page.evaluate(() => ({
    floorFloor: window.HomeSystem.canPlace('cozy_rug', 'center_left'),     // floor->floor true
    backdropFloor: window.HomeSystem.canPlace('wall_frame', 'center_left'), // backdrop->floor false
    backdropBack: window.HomeSystem.canPlace('wall_frame', 'back'),         // backdrop->backdrop true
    cornerCorner: window.HomeSystem.canPlace('night_lamp', 'corner_left'),  // corner->corner true (owned? canPlace does not check ownership)
    floorCorner: window.HomeSystem.canPlace('cozy_rug', 'corner_left')      // floor->corner false
}));
check('canPlace floor->floor true', r4.floorFloor === true);
check('canPlace backdrop->floor false', r4.backdropFloor === false);
check('canPlace backdrop->backdrop true', r4.backdropBack === true);
check('canPlace corner->corner true', r4.cornerCorner === true);
check('canPlace floor->corner false', r4.floorCorner === false);

// Test 5: unplaced tray renders in home UI
await page.evaluate(() => window.switchPage('home'));
await page.waitForTimeout(300);
const uiCheck = await page.evaluate(() => {
    const el = document.getElementById('home-container');
    if (!el) return { hasTray: false, trayItems: 0 };
    const tray = el.querySelector('.home-tray');
    return {
        hasTray: !!tray,
        trayItems: tray ? tray.querySelectorAll('.home-tray-item').length : 0
    };
});
check('home UI shows unplaced tray', uiCheck.hasTray);
check('tray shows unplaced furniture (>=1)', uiCheck.trayItems >= 1);

check('no new console errors', consoleErrors.length === 0);

await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.filter(r => r.pass).length}/${results.length} passed`);
if (failed.length) {
    console.log('FAILURES:', failed.map(f => f.name).join('; '));
    process.exit(1);
}
process.exit(0);
