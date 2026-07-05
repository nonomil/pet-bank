import { chromium } from 'playwright';
import { browserLaunchOpts } from '../scripts/playwright-browser.mjs';

const BASE = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765';

const results = [];
function check(name, cond, detail = '') {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

const browser = await chromium.launch(browserLaunchOpts());
const page = await browser.newPage();

const consoleErrors = [];
const failedRequests = [];
const requestUrls = [];
page.on('console', (msg) => {
    if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
    }
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('request', (req) => {
    requestUrls.push(req.url());
});
page.on('requestfailed', (req) => {
    failedRequests.push({
        url: req.url(),
        error: req.failure()?.errorText || 'failed'
    });
});

await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof window.switchPage === 'function', { timeout: 15000 });

const probe = await page.evaluate(() => ({
    hasSwitchPage: typeof window.switchPage === 'function',
    hasRuntimeLoader: Boolean(window.PetBankRuntime),
    hasTreasureChest: Boolean(window.TreasureChest),
    activePage: document.querySelector('.page.active')?.id || null
}));

const initialRequestUrls = requestUrls.slice();

check('page boot still completes with runtime loader and homepage core ready', probe.hasSwitchPage && probe.hasRuntimeLoader && probe.hasTreasureChest);
check('page lands on an active page', Boolean(probe.activePage), probe.activePage || 'none');
check(
    'initial homepage boot does not request pets.json',
    initialRequestUrls.every((url) => !/\/data\/pets\.json(?:$|\?)/i.test(url)),
    initialRequestUrls.filter((url) => /\/data\/pets\.json(?:$|\?)/i.test(url)).join(' | ')
);
check(
    'initial homepage boot does not request external lucide runtime',
    initialRequestUrls.every((url) => !/unpkg\.com\/lucide/i.test(url)),
    initialRequestUrls.filter((url) => /unpkg\.com\/lucide/i.test(url)).join(' | ')
);

await page.evaluate(() => window.switchPage('settings'));
await page.waitForFunction(() => Boolean(window.AuthSystem) && Boolean(window.CloudClient), { timeout: 30000 });

const settingsProbe = await page.evaluate(() => ({
    hasCloudClient: Boolean(window.CloudClient),
    hasAuthSystem: Boolean(window.AuthSystem),
    activePage: document.querySelector('.page.active')?.id || null
}));

check(
    'settings page lazy-loads cloud suite when first opened',
    settingsProbe.hasCloudClient && settingsProbe.hasAuthSystem && settingsProbe.activePage === 'page-settings',
    JSON.stringify(settingsProbe)
);
check(
    'missing local cloud config does not emit console 404 errors',
    consoleErrors.every((text) => !/cloud-config\.local\.js|404/i.test(text)),
    consoleErrors.join(' | ')
);
check(
    'missing local cloud config does not create failed requests',
    failedRequests.every((item) => !/cloud-config\.local\.js/i.test(item.url)),
    failedRequests.map((item) => `${item.url} -> ${item.error}`).join(' | ')
);

await browser.close();

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.filter((item) => item.pass).length}/${results.length} passed`);

if (failed.length) {
    console.log('FAILURES:', failed.map((item) => item.name).join('; '));
    process.exit(1);
}

process.exit(0);
