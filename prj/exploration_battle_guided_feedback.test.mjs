import { chromium } from 'playwright';
import { browserLaunchOpts } from '../scripts/playwright-browser.mjs';

const BASE = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765';

const results = [];
function check(name, condition, detail = '') {
    const pass = Boolean(condition);
    results.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

const browser = await chromium.launch(browserLaunchOpts());
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });

const consoleErrors = [];
page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/Failed to load resource|404|ERR_ABORTED/i.test(text)) return;
    consoleErrors.push(text);
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('dialog', async (dialog) => dialog.accept());

await page.addInitScript(() => {
    localStorage.clear();
});

await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(
    () => window.PetBankRuntime && window.PetSystem && typeof window.PetBankRuntime.ensurePage === 'function',
    { timeout: 20000 }
);
await page.evaluate(async () => {
    await window.PetBankRuntime.ensurePage('explore');
});
await page.waitForFunction(
    () => window.ExplorationSystem && typeof window.showBattleModal === 'function' && typeof window.battleAction === 'function',
    { timeout: 20000 }
);

await page.evaluate(() => {
    const species = window.PetSystem.getAllSpecies();
    if (species?.[0]) window.PetSystem.chooseSpecies(species[0].id);
    const pet = window.PetSystem.getState();
    window.PetSystem.takeDamage(Math.max(0, pet.hp - 3));
    const battle = window.ExplorationSystem.startBattle(
        { id: 'forest', name: '神秘森林', danger_level: 1, rare_drops: [] },
        { id: 'snail', name: '训练蜗牛', emoji: '🐌', hp: 999, atk: 999, exp: 0, drops: [] }
    );
    window.showBattleModal(battle);
});

await page.waitForFunction(() => document.getElementById('battleModal')?.classList.contains('show'), { timeout: 10000 });
await page.evaluate(() => window.battleAction('attack'));
await page.waitForFunction(() => /回到宠物页/.test(document.getElementById('battleActions')?.innerText || ''), { timeout: 10000 });

const resultText = await page.locator('#battleActions').innerText();
check('battle loss result shows review label', resultText.includes('复盘'), resultText);
check('battle loss result shows next-step label', resultText.includes('下一步'), resultText);
check('battle loss result suggests recovery before retry', /休息|救援|宠物小屋/.test(resultText), resultText);
check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);

if (failed.length) {
    console.log('FAILURES:', failed.map((item) => item.name).join('; '));
    process.exit(1);
}
