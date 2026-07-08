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

await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(
    () => window.PetSystem && typeof window.switchPage === 'function',
    { timeout: 10000 }
);

await page.evaluate(() => window.switchPage('card'));
await page.waitForFunction(
    () => window.CardCollection && typeof window.CardCollection.setView === 'function',
    { timeout: 30000 }
);
await page.waitForFunction(
    () => document.querySelectorAll('.card-gallery-card').length >= 4,
    { timeout: 10000 }
);

const coverProbe = await page.evaluate(() => ({
    galleryCovers: Array.from(document.querySelectorAll('.card-gallery-cover-image')).map((img) => img.getAttribute('src') || '')
}));

check(
    'gallery cover images use webp assets',
    coverProbe.galleryCovers.length >= 4 && coverProbe.galleryCovers.every((src) => /\.webp(?:$|\?)/i.test(src)),
    coverProbe.galleryCovers.join(', ')
);

await page.evaluate(() => window.CardCollection.setView('gallery', 'adventure'));
await page.waitForFunction(
    () => document.querySelectorAll('.card-item.card-composed-v2').length > 0,
    { timeout: 10000 }
);

const gridProbe = await page.evaluate(() => ({
    hallCover: document.querySelector('.card-hall-cover-image')?.getAttribute('src') || '',
    cardCount: document.querySelectorAll('.card-item.card-composed-v2').length,
    composedCount: document.querySelectorAll('.card-composed-v2-img').length,
    fallbackPortraitCount: document.querySelectorAll('.card-composed-v2-fallback img').length
}));

check(
    'hall cover image uses webp asset',
    /\.webp(?:$|\?)/i.test(gridProbe.hallCover),
    gridProbe.hallCover
);
check(
    'card grid does not eagerly load portrait fallback images',
    gridProbe.fallbackPortraitCount === 0,
    `fallback portrait imgs: ${gridProbe.fallbackPortraitCount}, cards: ${gridProbe.cardCount}, composed: ${gridProbe.composedCount}`
);
check('no new console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.filter((item) => item.pass).length}/${results.length} passed`);

if (failed.length) {
    console.log('FAILURES:', failed.map((item) => item.name).join('; '));
    process.exit(1);
}

process.exit(0);
