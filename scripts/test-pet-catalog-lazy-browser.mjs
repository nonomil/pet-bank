import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000/';
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
const requests = [];
page.on('request', (request) => {
    if (request.url().includes('/data/pets.json') || request.url().includes('/data/pets-runtime-index.json')) {
        requests.push(request.url());
    }
});

try {
    await page.goto(new URL('app', baseUrl).href, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.PetBankRuntime && window.switchPage, { timeout: 20000 });
    await page.waitForSelector('#page-map.active', { state: 'attached', timeout: 20000 });
    assert.equal(requests.filter((url) => url.endsWith('/data/pets.json')).length, 0,
        `home map should not fetch the full pet catalog: ${JSON.stringify(requests)}`);
    assert.equal(requests.filter((url) => url.endsWith('/data/pets-runtime-index.json')).length, 0,
        `home map should not fetch the exploration runtime index: ${JSON.stringify(requests)}`);

    await page.evaluate(() => window.switchPage('pet', { skipAccessGate: true }));
    await page.waitForSelector('#page-pet.active #petDisplayArea', { state: 'attached', timeout: 20000 });
    assert.equal(requests.filter((url) => url.endsWith('/data/pets.json')).length, 1,
        `pet page should load the full catalog on demand: ${JSON.stringify(requests)}`);
    console.log(JSON.stringify({ runtimeIndexRequests: 1, fullCatalogRequests: 1 }));
} finally {
    await browser.close();
}
