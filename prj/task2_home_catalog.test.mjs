// Task 2 smoke check: home.js loadCatalog + ownership normalization
import { chromium } from 'playwright';
import { browserLaunchOpts } from '../scripts/playwright-browser.mjs';

const BASE = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:4173';

const results = [];
function check(name, cond) {
    results.push({ name, pass: !!cond });
    console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}`);
}

const browser = await chromium.launch(browserLaunchOpts());
const page = await browser.newPage();

const consoleErrors = [];
page.on('console', msg => {
    if (msg.type() === 'error') {
        const t = msg.text();
        // Ignore resource 404s (pre-existing, e.g. missing pet images) - not caused by furniture work
        if (/Failed to load resource|404|net::ERR/i.test(t)) return;
        consoleErrors.push(t);
    }
});
page.on('pageerror', err => consoleErrors.push(String(err)));

// Clear home state to test normalization forces defaults
await page.addInitScript(() => {
    localStorage.clear();
});

await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.PetBankRuntime && typeof window.PetBankRuntime.ensurePage === 'function', { timeout: 15000 });
await page.evaluate(async () => {
    await window.PetBankRuntime.ensurePage('home');
});
await page.waitForFunction(() => window.HomeSystem && typeof window.HomeSystem.getFurnitureCatalog === 'function', { timeout: 15000 });
await page.waitForFunction(() => window.HomeSystem.getFurnitureCatalog().length >= 8, { timeout: 15000 }).catch(() => {});

// Run the plan's smoke assertions
const probe = await page.evaluate(async () => {
    await window.HomeSystem.loadCatalog();
    return {
        catalogLen: window.HomeSystem.getFurnitureCatalog().length,
        owned: window.HomeSystem.getFurniture(),
    };
});

check('catalog length includes baseline furniture set', probe.catalogLen >= 8);
check('default food_bowl owned', probe.owned.includes('food_bowl'));
check('default bath_tub owned', probe.owned.includes('bath_tub'));

// ownership normalization: even if localStorage had nothing, defaults must be present
check('console no new errors', consoleErrors.length === 0);

await browser.close();

const failed = results.filter(r => !r.pass);
console.log(`\n${results.filter(r => r.pass).length}/${results.length} passed`);
if (failed.length) {
    console.log('FAILURES:', failed.map(f => f.name).join('; '));
    process.exit(1);
}
process.exit(0);
