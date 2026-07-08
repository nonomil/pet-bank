import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { browserLaunchOpts } from '../scripts/playwright-browser.mjs';

const BASE = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765';
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'docs', '参考', 'img', 'edge-states-standalone-sim-2026-07-08');

fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
function check(name, condition, detail = '') {
    const pass = Boolean(condition);
    results.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

const browser = await chromium.launch(browserLaunchOpts());
const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });

const consoleErrors = [];
const dialogs = [];
page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/Failed to load resource|404|ERR_ABORTED/i.test(text)) return;
    consoleErrors.push(text);
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
});

async function shot(name) {
    const target = path.join(OUT_DIR, name);
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            if (fs.existsSync(target)) fs.unlinkSync(target);
            await page.screenshot({ path: target, fullPage: true });
            return;
        } catch (error) {
            if (attempt === 2) throw error;
            await new Promise((resolve) => setTimeout(resolve, 200));
        }
    }
}

await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.confirm = () => true;
});

await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.PetBankRuntime && window.PetSystem && window.InventorySystem && typeof window.switchPage === 'function', { timeout: 20000 });

await page.evaluate(async () => {
    await window.InventorySystem.loadItemsData();
    await window.PetBankRuntime.ensurePage('pet');
    await window.PetBankRuntime.ensurePage('walk');
    await window.PetBankRuntime.ensurePage('inventory');
    await window.PetBankRuntime.ensurePage('shop');
    await window.PetBankRuntime.ensurePage('settings');
});

await page.evaluate(() => window.switchPage('pet'));
await page.waitForFunction(() => document.getElementById('page-pet')?.classList.contains('active'), { timeout: 10000 });
const petEmptyProbe = await page.evaluate(() => ({
    active: document.getElementById('page-pet')?.classList.contains('active') || false,
    title: document.querySelector('#page-pet h2')?.textContent || '',
    preview: document.getElementById('petNextStagePreview')?.innerText || '',
    roadmap: document.getElementById('petGrowthRoadmap')?.innerText || '',
    cta: document.querySelector('#petSpeciesCard .btn-primary')?.textContent || ''
}));
check(
    '未认养时成长档案会显示清晰空态和认养入口',
    petEmptyProbe.active && /成长档案/.test(petEmptyProbe.title) && /认养宠物后/.test(`${petEmptyProbe.preview} ${petEmptyProbe.roadmap}`) && /认养宠物/.test(petEmptyProbe.cta),
    JSON.stringify(petEmptyProbe)
);
await shot('01-pet-empty-state.png');

await page.evaluate(() => window.switchPage('walk'));
await page.waitForFunction(() => document.getElementById('page-walk')?.classList.contains('active'), { timeout: 10000 });
const walkEmptyProbe = await page.evaluate(() => ({
    active: document.getElementById('page-walk')?.classList.contains('active') || false,
    body: document.getElementById('walk-page-root')?.innerText || ''
}));
check(
    '无宠物时遛弯页会拦截并引导先认养宠物',
    walkEmptyProbe.active && /遛弯还没开始/.test(walkEmptyProbe.body) && /先去认养宠物/.test(walkEmptyProbe.body),
    walkEmptyProbe.body
);
await shot('02-walk-no-pet.png');

await page.evaluate(() => window.switchPage('inventory'));
await page.waitForFunction(() => document.getElementById('page-inventory')?.classList.contains('active'), { timeout: 10000 });
const inventoryEmptyProbe = await page.evaluate(() => ({
    active: document.getElementById('page-inventory')?.classList.contains('active') || false,
    body: document.getElementById('inventoryGrid')?.innerText || ''
}));
check(
    '空背包会显示明确空态文案',
    inventoryEmptyProbe.active && /背包是空的/.test(inventoryEmptyProbe.body) && /去探索场景获得道具吧/.test(inventoryEmptyProbe.body),
    inventoryEmptyProbe.body
);
await shot('03-inventory-empty.png');

await page.evaluate(() => {
    window.PetSystem.chooseSpecies('dog');
    window.totalPoints = 0;
    if (typeof window.saveAppState === 'function') window.saveAppState();
    if (typeof window.updateStats === 'function') window.updateStats();
    window.switchPage('shop');
});
await page.waitForFunction(() => document.getElementById('page-shop')?.classList.contains('active') && document.getElementById('shop-ui')?.innerText.includes('训练营道具'), { timeout: 15000 });

const beforeShopAttempt = await page.evaluate(() => ({
    points: Number(window.totalPoints || 0),
    count: window.InventorySystem.getCount('battle_heal_potion'),
    history: JSON.parse(localStorage.getItem('petbank_shop_history') || '[]').length
}));
await page.locator('#shop-ui article', { hasText: '回血药' }).locator('button', { hasText: '购买' }).click();
await page.waitForTimeout(300);
const afterShopAttempt = await page.evaluate(() => ({
    points: Number(window.totalPoints || 0),
    count: window.InventorySystem.getCount('battle_heal_potion'),
    history: JSON.parse(localStorage.getItem('petbank_shop_history') || '[]').length
}));
check(
    '积分不足时商店购买会被拦截且不写入背包',
    beforeShopAttempt.points === 0 &&
        afterShopAttempt.points === beforeShopAttempt.points &&
        afterShopAttempt.count === beforeShopAttempt.count &&
        afterShopAttempt.history === beforeShopAttempt.history &&
        dialogs.some((text) => /成长分不足/.test(text)),
    JSON.stringify({ beforeShopAttempt, afterShopAttempt, dialogs })
);
await shot('04-shop-insufficient-points.png');

await page.evaluate(() => window.switchPage('settings', { settingsSection: 'family' }));
await page.waitForFunction(() => document.getElementById('page-settings')?.classList.contains('active'), { timeout: 10000 });
await page.waitForTimeout(500);
const settingsCloudProbe = await page.evaluate(() => ({
    active: document.getElementById('page-settings')?.classList.contains('active') || false,
    body: document.getElementById('page-settings')?.innerText || ''
}));
check(
    '未连接云端时设置页会提示先登录并配置云端社交',
    settingsCloudProbe.active &&
        /本地模式|云端配置/.test(settingsCloudProbe.body) &&
        /登录家长账号/.test(settingsCloudProbe.body),
    settingsCloudProbe.body
);
await shot('05-settings-cloud-empty.png');

await page.evaluate(() => window.switchPage('walk'));
await page.waitForFunction(() => document.getElementById('page-walk')?.classList.contains('active'), { timeout: 10000 });
const walkCloudProbe = await page.evaluate(() => ({
    body: document.getElementById('walk-page-root')?.innerText || ''
}));
check(
    '未连接云端时好友遛弯区会显示连接账号引导',
    /去设置连接账号/.test(walkCloudProbe.body) && /好友遛弯列表才会亮起来/.test(walkCloudProbe.body),
    walkCloudProbe.body
);
await shot('06-walk-cloud-empty.png');

check('异常态 standalone 模拟过程中无新的页面错误', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
    console.log('FAILURES:', failed.map((item) => item.name).join('; '));
    process.exit(1);
}
