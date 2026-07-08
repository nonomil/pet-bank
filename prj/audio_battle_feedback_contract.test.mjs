import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
    return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

const files = {
    sfx: read('js/sfx.js'),
    mathPk: read('js/math-pk.js'),
    cardArenaUi: read('js/card-arena-ui.js'),
    explorationDetail: read('js/exploration-detail.js'),
    exploration: read('js/exploration.js'),
    shop: read('js/shop.js'),
    learnCenter: read('js/learn-center.js'),
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
    'battleLose',
    'uiOpen',
    'uiClose',
    'mathRoundStart',
    'mathKeyTap',
    'comboUp',
    'supportReady',
    'supportUse',
    'rewardStar',
    'battleImpact',
    'healPulse',
    'countdownTick',
    'countdownUrgent',
    'dashWhoosh',
    'roundWinCue',
    'roundLoseCue',
    'questionReveal',
    'answerSubmit',
    'inputErase',
    'robotCharge',
    'challengeStart',
    'trainingUnlock',
    'teamSelect',
    'teamDeselect',
    'duelReady',
    'resultStamp',
    'spotlightPulse',
    'attackHop',
    'attackSpin',
    'shieldSpark',
    'faintDrop',
    'rewardFanfare',
    'cardFlip',
    'switchPoof',
    'stunPop',
    'victoryBurst',
    'purchaseConfirm',
    'rewardClaim',
    'chestOpen',
    'itemInspect'
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
check('battle animation plays impact on damage', files.app.includes("play('battleImpact')"));
check('battle animation plays heal pulse for healing item use', files.app.includes("if (e.detail.heal) play('healPulse')"));
check('battle animation plays shield spark for defend and item use', files.app.includes("play('shieldSpark')"));
check('battle animation plays dash whoosh on attack actions', files.app.includes("play('dashWhoosh')"));
check('battle animation plays round cues on battle end', files.app.includes("play('roundWinCue')") && files.app.includes("play('roundLoseCue')"));
check('battle animation plays reward fanfare and faint drop on battle end', files.app.includes("play('rewardFanfare')") && files.app.includes("play('faintDrop')"));
check('battleAction no longer derives only the last damage log', !files.app.includes('result.log.slice().reverse()'));

check('math pk uses keypad tap sfx', files.mathPk.includes("playSfx('mathKeyTap')"));
check('math pk uses support ready sound', files.mathPk.includes("playSfx('supportReady')"));
check('math pk uses support use sound', files.mathPk.includes("playSfx('supportUse')"));
check('math pk uses comboUp sound', files.mathPk.includes("playSfx('comboUp')"));
check('math pk uses rewardStar sound', files.mathPk.includes("playSfx('rewardStar')"));
check('math pk uses countdown cues for robot timer', files.mathPk.includes("playSfxLater('countdownTick'") && files.mathPk.includes("playSfxLater('countdownUrgent'"));
check('math pk uses dash and round cues', files.mathPk.includes("playSfx('dashWhoosh')") && files.mathPk.includes("playSfx('roundWinCue')") && files.mathPk.includes("playSfx('roundLoseCue')"));
check('math pk uses question reveal and submit sounds', files.mathPk.includes("playSfx('questionReveal')") && files.mathPk.includes("playSfx('answerSubmit')"));
check('math pk uses erase and robot charge sounds', files.mathPk.includes("playSfx('inputErase')") && files.mathPk.includes("playSfx('robotCharge')"));
check('math pk uses challenge start and training unlock sounds', files.mathPk.includes("playSfx('challengeStart')") && files.mathPk.includes("playSfx('trainingUnlock')"));
check('math pk uses spotlight, duel ready and result stamp sounds', files.mathPk.includes("playSfx('spotlightPulse')") && files.mathPk.includes("playSfx('duelReady')") && files.mathPk.includes("playSfx('resultStamp')"));
check('math pk varies attack/result sounds with hop spin fanfare faint', files.mathPk.includes("playSfx('attackHop')") && files.mathPk.includes("playSfx('attackSpin')") && files.mathPk.includes("playSfx('rewardFanfare')") && files.mathPk.includes("playSfx('faintDrop')"));
check('math pk uses extra stun and victory burst sounds', files.mathPk.includes("playSfx('stunPop')") && files.mathPk.includes("playSfx('victoryBurst')"));
check('card arena uses battle/audio feedback', files.cardArenaUi.includes('_playArenaSfx(newEvents, st)'));
check('card arena plays battle impact or heal pulse', files.cardArenaUi.includes("playSfx('battleImpact')") && files.cardArenaUi.includes("playSfx('healPulse')"));
check('card arena plays dash and round cues', files.cardArenaUi.includes("playSfx('dashWhoosh')") && files.cardArenaUi.includes("roundWinCue") && files.cardArenaUi.includes("roundLoseCue"));
check('card arena uses extra ui open/close sounds around flow', files.cardArenaUi.includes("playSfx('challengeStart')") && files.cardArenaUi.includes("playSfx('trainingUnlock')"));
check('card arena uses team pick, duel ready, result stamp and spotlight sounds', files.cardArenaUi.includes("playSfx('teamSelect')") && files.cardArenaUi.includes("playSfx('teamDeselect')") && files.cardArenaUi.includes("playSfx('duelReady')") && files.cardArenaUi.includes("playSfx('resultStamp')") && files.cardArenaUi.includes("playSfx('spotlightPulse')"));
check('card arena uses shield spark, faint drop and reward fanfare', files.cardArenaUi.includes("playSfx('shieldSpark')") && files.cardArenaUi.includes("playSfx('faintDrop')") && files.cardArenaUi.includes("playSfx('rewardFanfare')"));
check('card arena uses card flip, switch poof and victory burst', files.cardArenaUi.includes("playSfx('cardFlip')") && files.cardArenaUi.includes("playSfx('switchPoof')") && files.cardArenaUi.includes("playSfx('victoryBurst')"));
check('battle animation uses stun and victory burst sounds', files.app.includes("play('stunPop')") && files.app.includes("play('victoryBurst')"));
check('shop uses purchase confirm, chest open and reward claim sounds', files.shop.includes("playSfx('purchaseConfirm')") && files.shop.includes("playSfx('chestOpen')") && files.shop.includes("playSfx('rewardClaim')"));
check('inventory detail uses inspect sound', files.app.includes("playGlobalSfx('itemInspect')"));
check('level up wrapper uses level up sound', files.app.includes("playGlobalSfx('levelup')"));
check('learn center completion uses reward claim sound', files.learnCenter.includes("window.sfx.rewardClaim"));

check('css includes battle cast animation class', files.css.includes('.battle-cast'));
check('css includes reduced motion override', files.css.includes('prefers-reduced-motion: reduce'));

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);

if (failed.length) {
    console.log('FAILURES:', failed.map((item) => item.name).join('; '));
    process.exit(1);
}
