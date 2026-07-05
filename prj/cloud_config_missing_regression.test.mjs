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
const page = await browser.newPage();

const consoleErrors = [];
const failedRequests = [];
page.on('console', (msg) => {
    if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
    }
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('requestfailed', (req) => {
    failedRequests.push({
        url: req.url(),
        error: req.failure()?.errorText || 'failed'
    });
});

await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 60000 });
await page.waitForFunction(() => typeof window.switchPage === 'function', { timeout: 15000 });

const probe = await page.evaluate(() => ({
    hasSwitchPage: typeof window.switchPage === 'function',
    hasCloudClient: Boolean(window.CloudClient),
    hasAuthSystem: Boolean(window.AuthSystem),
    activePage: document.querySelector('.page.active')?.id || null
}));

check('page boot still completes without local cloud config file', probe.hasSwitchPage && probe.hasCloudClient && probe.hasAuthSystem);
check('page lands on an active page', Boolean(probe.activePage), probe.activePage || 'none');
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
