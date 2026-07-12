import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = (process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8776').replace(/\/$/, '');
const basePath = new URL(baseUrl).pathname.replace(/\/$/, '');
const cases = [
    { route: '/app/playground', page: 'playground', shell: 'home' },
    { route: '/parent/tools', page: 'tools', shell: 'parent' },
    { route: '/settings/family', page: 'settings', shell: 'parent', settings: 'family' },
    { route: '/settings/account', page: 'settings', shell: 'parent', settings: 'family' },
];

let browser;
try {
    browser = await chromium.launch(browserLaunchOpts());
    const page = await browser.newPage();

    for (const testCase of cases) {
        await page.goto(`${baseUrl}${testCase.route}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForSelector(`#page-${testCase.page}.active`, { timeout: 15000 });
        const actual = await page.evaluate(() => ({
            path: window.location.pathname,
            shell: document.body.dataset.routeShell,
            settings: document.querySelector('#page-settings .settings-subpage-panel.is-active')?.dataset.settingsSection || null,
        }));

        const expectedPath = `${basePath}${testCase.route}` || '/';
        if (actual.path !== expectedPath || actual.shell !== testCase.shell || (testCase.settings && actual.settings !== testCase.settings)) {
            throw new Error(`${testCase.route}: expected page=${testCase.page}, shell=${testCase.shell}, settings=${testCase.settings || '-'}; got path=${actual.path}, shell=${actual.shell}, settings=${actual.settings || '-'}`);
        }
        console.log(`PASS ${testCase.route} -> ${testCase.page} (${testCase.shell})`);
    }
} finally {
    await browser?.close();
}

console.log(`PASS static route browser smoke: ${cases.length} routes`);
