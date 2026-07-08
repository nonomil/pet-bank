import { chromium } from 'playwright';
import { browserLaunchOpts } from '../scripts/playwright-browser.mjs';

const BASE = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765';

const browser = await chromium.launch(browserLaunchOpts());
const page = await browser.newPage();
const failedUrls = [];

page.on('requestfailed', (request) => {
    failedUrls.push({
        url: request.url(),
        error: request.failure()?.errorText || ''
    });
});

try {
    await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => window.PetBankRuntime && typeof window.switchPage === 'function', { timeout: 20000 });

    await page.evaluate(async () => {
        await window.PetBankRuntime.ensurePage('playground');
        window.switchPage('mathpk');
    });

    if (!/\/playground\/math-pk$/.test(new URL(page.url()).pathname)) {
        throw new Error(`expected math pk route, got ${page.url()}`);
    }

    await page.evaluate(async () => {
        await window.PetBankRuntime.ensureCardArenaFeature();
    });

    const badNestedAssets = failedUrls.filter((item) => /\/playground\/(?:css|js)\//.test(item.url));
    if (badNestedAssets.length) {
        throw new Error(`runtime-loader requested nested route assets: ${JSON.stringify(badNestedAssets)}`);
    }

    console.log('PASS runtime loader route base contract');
} finally {
    await browser.close();
}
