import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
    return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

const files = {
    sfx: read('js/sfx.js'),
    explorationDetail: read('js/exploration-detail.js'),
    exploration: read('js/exploration.js'),
    app: read('js/app.js'),
    css: read('css/style.css')
};

const results = [];
function check(name, cond, detail = '') {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

function functionExportPattern(name) {
    return new RegExp(`${name}:\\s*function\\s*\\(`);
}

const semanticSfx = [
    'dialogueNext',
    'discover',
    'mathCorrect',
    'mathWrong',
    'choiceConfirm',
    'encounterWarning',
    'battleStart',
    'playerAttack',
    'enemyAttack',
    'skillCast',
    'defend',
    'itemUse',
    'battleWin',
    'battleLose'
];

for (const name of semanticSfx) {
    check(`sfx exposes ${name}()`, functionExportPattern(name).test(files.sfx));
}

check('sfx exposes play(name)', /play:\s*function\s*\(\s*name\s*\)/.test(files.sfx));
check('sfx stores muted preference', files.sfx.includes('petbank_sfx_muted'));
check('sfx declares settings ui controls', ['sfxEnabled', 'sfxVolume', 'sfxTest'].every((id) => files.sfx.includes(id)));
check('sfx tries mp3 before zzfx fallback', /_playMp3\(name,\s*vol\)[\s\S]{0,80}return[\s\S]{0,220}var inst = _instances\[name\]/.test(files.sfx));

const explorationSfxCalls = {
    dialogueNext: "playSfx('dialogueNext')",
    discover: "playSfx('discover')",
    mathCorrect: "playSfx('mathCorrect')",
    mathWrong: "playSfx('mathWrong')",
    choiceConfirm: "playSfx('choiceConfirm')",
    encounterWarning: "playSfx('encounterWarning')",
    battleStart: "playSfx('battleStart')"
};

for (const [name, needle] of Object.entries(explorationSfxCalls)) {
    check(`exploration-detail calls ${name}`, files.explorationDetail.includes(needle), needle);
}

const battleEvents = [
    'battle-start',
    'player-attack',
    'enemy-attack',
    'skill-cast',
    'defend',
    'item-use',
    'battle-win',
    'battle-lose'
];

check('exploration dispatches battle-animate custom events', /CustomEvent\('battle-animate'/.test(files.exploration));
for (const type of battleEvents) {
    check(`exploration emits ${type}`, files.exploration.includes(`'${type}'`));
    check(`app handles ${type}`, files.app.includes(`'${type}'`));
}

function sliceBetween(source, startNeedle, endNeedle) {
    const start = source.indexOf(startNeedle);
    if (start < 0) return '';
    const end = source.indexOf(endNeedle, start);
    return end < 0 ? source.slice(start) : source.slice(start, end);
}

const showBattleModalBlock = sliceBetween(files.app, 'function showBattleModal(battle)', '// 战斗深化');
const updateBattleUIBlock = sliceBetween(files.app, 'function updateBattleUI(battle)', '// 浮动伤害');
const closeBattleModalBlock = sliceBetween(files.app, 'function closeBattleModal()', '// ============ 背包页面渲染');

check('showBattleModal registers battle animation listener', !!showBattleModalBlock && showBattleModalBlock.includes("addEventListener('battle-animate'"));
check('updateBattleUI does not register one-shot battle listener', !!updateBattleUIBlock && !updateBattleUIBlock.includes("addEventListener('battle-animate'"));
check('battle animation listener is not once-only', !files.app.includes("addEventListener('battle-animate', handleBattleAnimate, { once: true })"));
check('closeBattleModal removes battle animation listener', !!closeBattleModalBlock && closeBattleModalBlock.includes("removeEventListener('battle-animate'"));
check('battle animation shows player damage from event detail', files.app.includes("showBattleDamage(e.detail.damage, 'monster')"));
check('battle animation shows enemy damage from event detail', files.app.includes("showBattleDamage(e.detail.damage, 'pet')"));
check('battleAction no longer derives only the last damage log', !files.app.includes('result.log.slice().reverse()'));

check('css includes battle cast animation class', files.css.includes('.battle-cast'));
check('css includes reduced motion override', files.css.includes('prefers-reduced-motion: reduce'));

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);

if (failed.length) {
    console.log('FAILURES:', failed.map((item) => item.name).join('; '));
    process.exit(1);
}
