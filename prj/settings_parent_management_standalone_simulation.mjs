import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { browserLaunchOpts } from '../scripts/playwright-browser.mjs';

const BASE = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765';
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'docs', '参考', 'img', 'settings-parent-management-standalone-sim-2026-07-08');

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
    if (!sessionStorage.getItem('__petbank_settings_parent_sim_booted')) {
        localStorage.clear();
        sessionStorage.setItem('__petbank_settings_parent_sim_booted', '1');
    }
    window.APP_FAMILY_SOCIAL_SCOPE = 'full';
    window.supabase = {
        createClient() {
            return {
                auth: {
                    async getSession() {
                        return { data: { session: null }, error: null };
                    },
                    onAuthStateChange() {
                        return {
                            data: {
                                subscription: {
                                    unsubscribe() {}
                                }
                            }
                        };
                    }
                },
                functions: {
                    async invoke() {
                        return { data: { invites: [] }, error: null };
                    }
                },
                from() {
                    return {
                        upsert() { return Promise.resolve({ data: [], error: null }); },
                        select() { return this; },
                        order() { return Promise.resolve({ data: [], error: null }); },
                        eq() { return this; },
                        limit() { return Promise.resolve({ data: [], error: null }); }
                    };
                },
                rpc() {
                    return Promise.resolve({ data: [], error: null });
                }
            };
        }
    };
});

await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.PetBankRuntime && window.PetSystem && typeof window.switchPage === 'function', { timeout: 20000 });

await page.evaluate(async () => {
    window.PetSystem.chooseSpecies('dog');
    await window.PetBankRuntime.ensurePage('settings');
    await window.PetBankRuntime.ensurePage('learning-sheet');
    await window.PetBankRuntime.ensurePage('playground');
    window.switchPage('settings');
});
await page.waitForFunction(() => window.LearnCenter && window.MathPKGame && window.CloudClient, { timeout: 15000 });

await page.waitForFunction(() => {
    const settings = document.getElementById('page-settings');
    return settings && settings.classList.contains('active') && document.getElementById('settings-account-list')?.innerText;
}, { timeout: 15000 });

const settingsOpenProbe = await page.evaluate(() => ({
    active: document.getElementById('page-settings')?.classList.contains('active') || false,
    sections: Array.from(document.querySelectorAll('#page-settings .parent-settings-section h3')).map((el) => el.textContent.trim()),
    authCopy: document.getElementById('auth-root')?.innerText || '',
    mathDiffVisible: !!document.querySelector('#settings-math-diff [data-diff]')
}));
check(
    '设置页可独立打开并显示主要管理分区',
    settingsOpenProbe.active
        && settingsOpenProbe.sections.includes('账号与孩子')
        && settingsOpenProbe.sections.includes('家庭云端')
        && settingsOpenProbe.sections.includes('学习与题目')
        && settingsOpenProbe.sections.includes('高级与危险操作')
        && settingsOpenProbe.mathDiffVisible,
    JSON.stringify(settingsOpenProbe)
);
await shot('01-settings-open.png');

await page.evaluate(() => window.switchPage('settings', { settingsSection: 'learning' }));
await page.waitForFunction(() => document.querySelector('[data-learning-mode-advanced-toggle="1"]') && document.querySelector('[data-learning-mode-advanced-toggle="1"]').offsetParent !== null, { timeout: 5000 });
const advancedToggle = page.locator('[data-learning-mode-advanced-toggle="1"]');
await advancedToggle.click();
await page.waitForFunction(() => document.querySelector('[data-learning-mode-advanced-panel="1"]')?.classList.contains('is-open') || false, { timeout: 5000 });
const learningPanelProbe = await page.evaluate(() => ({
    expanded: document.querySelector('[data-learning-mode-advanced-panel="1"]')?.classList.contains('is-open') || false,
    text: document.getElementById('settings-learning-mode')?.innerText || ''
}));
check('学习单模式支持展开进阶模板', learningPanelProbe.expanded && /错题加强版/.test(learningPanelProbe.text) && /轻量标准版/.test(learningPanelProbe.text), JSON.stringify(learningPanelProbe));

await page.locator('[data-learning-sheet-mode="template-c"]').click();
await page.waitForFunction(() => window.LearnCenter.getDailySheetMode() === 'template-c', { timeout: 5000 });
const learningModeState = await page.evaluate(() => ({
    mode: window.LearnCenter.getDailySheetMode(),
    stored: JSON.parse(localStorage.getItem('petbank_learning_sheet_mode') || 'null'),
    activeText: document.querySelector('[data-learning-sheet-mode="template-c"] strong')?.textContent || ''
}));
check('设置页切换学习单模式会写入本地设置', learningModeState.mode === 'template-c' && learningModeState.stored === 'template-c', JSON.stringify(learningModeState));

await page.evaluate(() => window.switchPage('learning-sheet'));
await page.waitForFunction(() => document.getElementById('page-learning-sheet')?.classList.contains('active') && document.getElementById('points-learning-sheet-container')?.innerText, { timeout: 15000 });
const learningSheetProbe = await page.evaluate(() => ({
    text: document.getElementById('points-learning-sheet-container')?.innerText || ''
}));
check('学习单页面会按新模式显示错题加强版内容', /错题/.test(learningSheetProbe.text) && /最顺/.test(learningSheetProbe.text) && /明天先做什么/.test(learningSheetProbe.text), learningSheetProbe.text.slice(0, 180));
await shot('02-learning-sheet-template-c.png');

await page.evaluate(() => window.switchPage('settings', { settingsSection: 'learning' }));
await page.waitForFunction(() => document.getElementById('page-settings')?.classList.contains('active'), { timeout: 5000 });
await page.locator('#settings-math-diff [data-diff="hard"]').click();
await page.waitForFunction(() => window.MathPKGame && window.MathPKGame.getDifficulty() === 'hard', { timeout: 5000 });
const mathDiffProbe = await page.evaluate(() => ({
    diff: window.MathPKGame.getDifficulty(),
    stored: localStorage.getItem('petbank_math_difficulty') || '',
    activeLabel: document.querySelector('#settings-math-diff [data-diff="hard"] div')?.textContent || ''
}));
check('设置页切换数学 PK 难度会持久化', mathDiffProbe.diff === 'hard' && mathDiffProbe.stored === 'hard', JSON.stringify(mathDiffProbe));

await page.evaluate(() => window.switchPage('mathpk'));
await page.waitForFunction(() => document.getElementById('math-pk-container')?.innerText, { timeout: 15000 });
const mathPkProbe = await page.evaluate(() => ({
    text: document.getElementById('math-pk-container')?.innerText || '',
    robotName: document.getElementById('arena-robot-name')?.textContent || ''
}));
check('数学 PK 页面会吃到设置页刚改过的难度', /乘除挑战/.test(mathPkProbe.text) && /冠军计算机/.test(mathPkProbe.robotName), JSON.stringify(mathPkProbe));
await shot('03-mathpk-hard-difficulty.png');

await page.evaluate(() => window.switchPage('settings', { settingsSection: 'family' }));
await page.waitForFunction(() => document.getElementById('page-settings')?.classList.contains('active'), { timeout: 5000 });

await page.locator('#auth-root form.auth-config-form button[type="submit"]').click();
await page.waitForFunction(() => /请至少填写 Supabase URL 和 anon key/.test(document.getElementById('auth-root')?.innerText || ''), { timeout: 5000 });
const validationProbe = await page.evaluate(() => document.getElementById('auth-root')?.innerText || '');
check('云端配置表单在缺字段时会给出校验错误', /请至少填写 Supabase URL 和 anon key/.test(validationProbe), validationProbe.slice(0, 160));

await page.locator('#auth-root input[name="supabaseUrl"]').fill('https://fake.supabase.local');
await page.locator('#auth-root input[name="supabaseAnonKey"]').fill('fake-anon-key');
await page.locator('#auth-root input[name="siteUrl"]').fill('http://127.0.0.1:8765');
await page.locator('#auth-root form.auth-config-form button[type="submit"]').click();
await page.waitForFunction(() => {
    return window.CloudClient.getStatus().enabled
        && window.CloudClient.getStatus().configSource === 'persisted-localstorage'
        && /云端配置已保存/.test(document.getElementById('auth-root')?.innerText || '');
}, { timeout: 10000 });

const savedConfigProbe = await page.evaluate(() => ({
    status: window.CloudClient.getStatus(),
    stored: JSON.parse(localStorage.getItem('petbank_cloud_config') || 'null'),
    text: document.getElementById('auth-root')?.innerText || ''
}));
check(
    '云端配置保存后会写入本地并切到已配置状态',
    savedConfigProbe.status.enabled
        && savedConfigProbe.status.configSource === 'persisted-localstorage'
        && savedConfigProbe.stored.supabaseUrl === 'https://fake.supabase.local'
        && /云端已配置|云端已就绪/.test(savedConfigProbe.text),
    JSON.stringify(savedConfigProbe.status)
);

await page.locator('#auth-root button', { hasText: '清空云端配置' }).click();
await page.waitForFunction(() => !localStorage.getItem('petbank_cloud_config') && /本地模式/.test(document.getElementById('auth-root')?.innerText || ''), { timeout: 10000 });
const clearedConfigProbe = await page.evaluate(() => ({
    status: window.CloudClient.getStatus(),
    stored: localStorage.getItem('petbank_cloud_config'),
    text: document.getElementById('auth-root')?.innerText || ''
}));
check('清空云端配置后会回到本地模式', !clearedConfigProbe.stored && !clearedConfigProbe.status.enabled && /本地模式/.test(clearedConfigProbe.text), JSON.stringify(clearedConfigProbe.status));
await shot('04-auth-config-cleared.png');

check('设置页 standalone 模拟过程中无新的页面错误', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
    console.log('FAILURES:', failed.map((item) => item.name).join('; '));
    process.exit(1);
}
