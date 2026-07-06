import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
    const full = path.join(ROOT, relPath);
    return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function exists(relPath) {
    return fs.existsSync(path.join(ROOT, relPath));
}

const files = {
    html: read('index.html'),
    app: read('js/app.js'),
    battleFx: read('js/battle-fx.js'),
    css: read('css/style.css')
};

const results = [];
function check(name, cond, detail = '') {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

const battleFxScript = files.html.indexOf('js/battle-fx.js');
const appScript = files.html.indexOf('js/app.js');
check('index loads battle-fx before app.js', battleFxScript >= 0 && appScript >= 0 && battleFxScript < appScript);
check('app forwards battle animation events to BattleFx', files.app.includes('BattleFx.show(type, e.detail)'));

check('BattleFx module exists', files.battleFx.length > 0);
check('BattleFx exposes window.BattleFx', files.battleFx.includes('window.BattleFx'));
check('BattleFx exposes show()', /show:\s*function\s*\(/.test(files.battleFx));
check('BattleFx exposes getEffectSpec()', /getEffectSpec:\s*getEffectSpec/.test(files.battleFx));

for (const token of [
    'player-attack',
    'enemy-attack',
    'skill-cast',
    'power_strike',
    'defend',
    'ultimate',
    'battle-win',
    'battle-lose'
]) {
    check(`BattleFx maps ${token}`, files.battleFx.includes(token));
}

for (const cls of [
    '.battle-fx-layer',
    '.battle-fx',
    '.battle-fx-slash',
    '.battle-fx-enemy-claw',
    '.battle-fx-power-strike',
    '.battle-fx-shield',
    '.battle-fx-ultimate',
    '.battle-fx-victory'
]) {
    check(`css includes ${cls}`, files.css.includes(cls));
}
check('css reduces Battle FX motion', files.css.includes('prefers-reduced-motion: reduce') && files.css.includes('.battle-fx'));

const lottieFiles = [
    'assets/battle-fx/lottie/slash.json',
    'assets/battle-fx/lottie/power-strike.json',
    'assets/battle-fx/lottie/shield.json',
    'assets/battle-fx/lottie/ultimate.json'
];

for (const relPath of lottieFiles) {
    check(`lottie asset exists ${relPath}`, exists(relPath));
    if (!exists(relPath)) continue;
    let parsed = null;
    try {
        parsed = JSON.parse(read(relPath));
    } catch (err) {
        check(`lottie asset parses ${relPath}`, false, err.message);
        continue;
    }
    check(`lottie asset parses ${relPath}`, true);
    for (const key of ['v', 'fr', 'ip', 'op', 'w', 'h', 'nm', 'assets', 'layers']) {
        check(`lottie asset ${relPath} has ${key}`, Object.prototype.hasOwnProperty.call(parsed, key));
    }
    check(`lottie asset ${relPath} is transparent overlay`, Array.isArray(parsed.layers) && !JSON.stringify(parsed.layers).includes('Battle FX Background'));
}

const playerScenes = [
    'prj/GPT生图--Lottie动画/player/public/projects/petbank-battle-fx/scene-1/lottie.json',
    'prj/GPT生图--Lottie动画/player/public/projects/petbank-battle-fx/scene-2/lottie.json',
    'prj/GPT生图--Lottie动画/player/public/projects/petbank-battle-fx/scene-3/lottie.json',
    'prj/GPT生图--Lottie动画/player/public/projects/petbank-battle-fx/scene-4/lottie.json'
];

for (const relPath of playerScenes) {
    check(`Skottie preview scene exists ${relPath}`, exists(relPath));
}

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);

if (failed.length) {
    console.log('FAILURES:', failed.map((item) => item.name).join('; '));
    process.exit(1);
}
