import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const read = (relPath) => fs.readFileSync(path.join(repoRoot, relPath), 'utf8');

const appJs = read('js/app.js');
const html = read('index.html');
const css = read('css/style.css');

[
    'const BATTLE_MILESTONES =',
    'math_first_star',
    'arena_first_clear',
    'explore_first_win',
    'triple_route_open',
    'claimBattleMilestoneReward',
    'renderBattleMilestoneStrip',
    'playgroundBattleMilestones',
    'reviewBattleMilestones'
].forEach((needle) => {
    assert.ok(appJs.includes(needle), `app.js should include battle milestone marker: ${needle}`);
});

[
    'reviewBattleBoard',
    'reviewBattleMomentum'
].forEach((needle) => {
    assert.ok(html.includes(needle), `index.html should include review milestone shell marker: ${needle}`);
});

[
    '.battle-milestone-strip',
    '.battle-milestone-card',
    '.battle-milestone-claim'
].forEach((needle) => {
    assert.ok(css.includes(needle), `style.css should include battle milestone style marker: ${needle}`);
});

console.log('PASS battle_milestones_contract');
