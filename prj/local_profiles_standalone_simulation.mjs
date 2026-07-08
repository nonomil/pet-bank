import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { browserLaunchOpts } from '../scripts/playwright-browser.mjs';

const BASE = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765';
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'docs', '参考', 'img', 'local-profiles-standalone-sim-2026-07-08');

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
page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/Failed to load resource|404|ERR_ABORTED/i.test(text)) return;
    consoleErrors.push(text);
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

async function shot(name) {
    await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true });
}

await page.addInitScript(() => {
    if (!sessionStorage.getItem('__petbank_local_profiles_sim_booted')) {
        localStorage.clear();
        sessionStorage.setItem('__petbank_local_profiles_sim_booted', '1');
    }
    window.__testPromptQueue = [];
    window.__testConfirmQueue = [];
    window.prompt = function (_message, defaultValue) {
        if (window.__testPromptQueue.length) return window.__testPromptQueue.shift();
        return defaultValue == null ? '' : defaultValue;
    };
    window.confirm = function () {
        if (window.__testConfirmQueue.length) return !!window.__testConfirmQueue.shift();
        return true;
    };
});

async function waitBoot() {
    await page.waitForFunction(() => window.PetBankRuntime && window.PetSystem && window.ProfileManager && typeof window.switchPage === 'function', { timeout: 20000 });
}

await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await waitBoot();

await page.evaluate(async () => {
    await window.PetBankRuntime.ensurePage('settings');
    window.PetSystem.chooseSpecies('dog');
    if (typeof window.addGrowthPoints === 'function') window.addGrowthPoints(88);
    window.switchPage('settings', { settingsSection: 'account' });
});
await page.waitForFunction(() => document.getElementById('page-settings')?.classList.contains('active') && document.getElementById('settings-account-list')?.innerText, { timeout: 10000 });

const initialProbe = await page.evaluate(() => ({
    activeName: document.getElementById('profileCurName')?.textContent || '',
    profiles: window.ProfileManager.list().map((p) => p.name),
    activeId: window.ProfileManager.getActiveId(),
    points: Number(window.totalPoints || 0),
    species: window.PetSystem.getState().species || ''
}));
check('默认本地孩子档案存在并带着当前业务数据', initialProbe.profiles.length === 1 && /默认孩子/.test(initialProbe.activeName) && initialProbe.points === 88 && initialProbe.species === 'dog', JSON.stringify(initialProbe));
await shot('01-settings-default-profile.png');

await page.evaluate(() => {
    window.__testPromptQueue.push('小红');
    window.__testConfirmQueue.push(false);
});
await page.locator('#settings-account-list button', { hasText: '新建孩子' }).click();
await page.waitForFunction(() => window.ProfileManager.list().length === 2, { timeout: 5000 });

const createdProbe = await page.evaluate(() => ({
    profiles: window.ProfileManager.list().map((p) => ({ id: p.id, name: p.name })),
    activeName: document.getElementById('profileCurName')?.textContent || '',
    settingsText: document.getElementById('settings-account-list')?.innerText || ''
}));
const secondProfileId = createdProbe.profiles.find((p) => p.name === '小红')?.id || '';
check('设置页可以新建第二个本地孩子档案', createdProbe.profiles.some((p) => p.name === '小红') && /小红/.test(createdProbe.settingsText) && /默认孩子/.test(createdProbe.activeName), JSON.stringify(createdProbe));
await shot('02-settings-second-profile-created.png');

await page.click('#profileSwitcher');
await page.waitForSelector('.profile-panel', { timeout: 5000 });
await page.evaluate((profileId) => window.ProfileManager._swapTo(profileId, false), secondProfileId);
await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await waitBoot();
await page.waitForFunction(() => (window.ProfileManager.getActive()?.name || '').includes('小红'), { timeout: 10000 });

const switchedProbe = await page.evaluate(() => ({
    activeName: window.ProfileManager.getActive()?.name || '',
    activeId: window.ProfileManager.getActiveId(),
    points: Number(window.totalPoints || 0),
    species: window.PetSystem.getState().species || '',
    metaCount: window.ProfileManager.list().length
}));
check('右上角切换器可以切到第二个孩子，并切出一套独立数据', /小红/.test(switchedProbe.activeName) && switchedProbe.points === 0 && !switchedProbe.species && switchedProbe.metaCount === 2, JSON.stringify(switchedProbe));

await page.evaluate(() => {
    window.PetSystem.chooseSpecies('cat');
    if (typeof window.addGrowthPoints === 'function') window.addGrowthPoints(21);
});
const secondProfileState = await page.evaluate(() => ({
    points: Number(window.totalPoints || 0),
    species: window.PetSystem.getState().species || ''
}));
check('第二个孩子可以拥有自己的宠物和积分状态', secondProfileState.points === 21 && secondProfileState.species === 'cat', JSON.stringify(secondProfileState));
await shot('03-switched-to-second-profile.png');

await page.click('#profileSwitcher');
await page.waitForSelector('.profile-panel', { timeout: 5000 });
await page.evaluate(() => {
    const target = window.ProfileManager.list().find((p) => p.name === '默认孩子');
    if (target) window.ProfileManager._swapTo(target.id, false);
});
await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await waitBoot();
await page.waitForFunction(() => (window.ProfileManager.getActive()?.name || '').includes('默认孩子'), { timeout: 10000 });

const restoredProbe = await page.evaluate(() => ({
    activeName: window.ProfileManager.getActive()?.name || '',
    points: Number(window.totalPoints || 0),
    species: window.PetSystem.getState().species || '',
    snapshotKeys: window.ProfileManager.list().map((p) => ({
        name: p.name,
        hasSnapshot: !!localStorage.getItem(window.ProfileManager.getSnapshotKey(p.id))
    }))
}));
check('切回默认孩子后，会恢复原来的宠物和积分快照', /默认孩子/.test(restoredProbe.activeName) && restoredProbe.points === 88 && restoredProbe.species === 'dog' && restoredProbe.snapshotKeys.every((item) => item.hasSnapshot), JSON.stringify(restoredProbe));

await page.evaluate(() => window.switchPage('settings', { settingsSection: 'account' }));
await page.waitForFunction(() => document.getElementById('page-settings')?.classList.contains('active'), { timeout: 5000 });
await page.evaluate(() => {
    window.__testPromptQueue.push('小红改');
});
await page.locator('#settings-account-list > div', { hasText: '小红' }).locator('button[title="改名"]').click();
await page.waitForFunction(() => /小红改/.test(document.getElementById('settings-account-list')?.innerText || ''), { timeout: 5000 });

const renamedProbe = await page.evaluate(() => ({
    names: window.ProfileManager.list().map((p) => p.name),
    settingsText: document.getElementById('settings-account-list')?.innerText || ''
}));
check('设置页可以给非当前孩子改名', renamedProbe.names.includes('小红改') && /小红改/.test(renamedProbe.settingsText), JSON.stringify(renamedProbe));

await page.evaluate(() => {
    window.__testConfirmQueue.push(true);
});
await page.locator('#settings-account-list > div', { hasText: '小红改' }).locator('button[title="删除"]').click();
await page.waitForFunction(() => window.ProfileManager.list().length === 1, { timeout: 5000 });

const removedProbe = await page.evaluate(() => ({
    names: window.ProfileManager.list().map((p) => p.name),
    activeName: window.ProfileManager.getActive()?.name || '',
    activeId: window.ProfileManager.getActiveId(),
    removedSnapshotStillThere: Object.keys(localStorage).some((key) => key.includes('小红改'))
}));
check('设置页可以删除非当前孩子档案并保持当前孩子不受影响', removedProbe.names.length === 1 && removedProbe.names[0] === '默认孩子' && /默认孩子/.test(removedProbe.activeName) && !removedProbe.removedSnapshotStillThere, JSON.stringify(removedProbe));
await shot('04-settings-after-rename-delete.png');

check('本地多孩子 standalone 模拟过程中无新的页面错误', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
    console.log('FAILURES:', failed.map((item) => item.name).join('; '));
    process.exit(1);
}
