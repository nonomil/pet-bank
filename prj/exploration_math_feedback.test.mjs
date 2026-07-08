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

await page.goto(`${BASE}/index.html`);
await page.waitForFunction(() => window.PetBankRuntime && typeof window.PetBankRuntime.ensurePage === 'function', { timeout: 15000 });
await page.evaluate(async () => {
    await window.PetBankRuntime.ensurePage('explore');
});
await page.waitForFunction(
    () => window.ExplorationDetail && typeof window.ExplorationDetail.show === 'function',
    { timeout: 15000 }
);

async function openForestMath() {
    await page.evaluate(async () => {
        await window.ExplorationDetail.show('forest');
        window.ExplorationDetail.next();
        window.ExplorationDetail.next();
    });
    await page.waitForFunction(
        () => document.querySelectorAll('#galgameChoices .galgame-choice').length === 4,
        { timeout: 8000 }
    );
}

await openForestMath();

const promptText = await page.locator('#galgameText').innerText();
check('math prompt shows skill label', promptText.includes('能力点'), promptText);
check('math prompt shows forest skill name', promptText.includes('数量比较'), promptText);

await page.locator('#galgameChoices .galgame-choice').filter({ hasText: '1' }).click();
await page.waitForTimeout(150);
const wrongText = await page.locator('#galgameText').innerText();
check('wrong answer shows observation hint', wrongText.includes('先找出两处脚印数量，再用多的减去少的'), wrongText);

await openForestMath();
await page.locator('#galgameChoices .galgame-choice').filter({ hasText: '2' }).click();
await page.waitForTimeout(150);
const correctText = await page.locator('#galgameText').innerText();
check('correct answer keeps reward message', correctText.includes('脚印记录补齐，树根小路亮起来了'), correctText);
check('correct answer shows explanation', correctText.includes('5 - 3 = 2'), correctText);

check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.filter((item) => item.pass).length}/${results.length} passed`);

if (failed.length) {
    console.log('FAILURES:', failed.map((item) => item.name).join('; '));
    process.exit(1);
}

process.exit(0);
