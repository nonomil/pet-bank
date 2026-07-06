import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const read = (relPath) => fs.readFileSync(path.join(repoRoot, relPath), 'utf8');

const design = read('docs/PK大乱斗共通设计/README.md');
const mathPk = read('js/math-pk.js');
const cardArenaUi = read('js/card-arena-ui.js');
const app = read('js/app.js');
const arenaCss = read('css/arena.css');
const styleCss = read('css/style.css');

[
    '数学 PK',
    '卡牌对战',
    '探索故事',
    '选关',
    '角色确认',
    '出招反馈',
    'HP',
    '胜利结算'
].forEach((needle) => {
    assert.ok(design.includes(needle), `shared design should keep ${needle}`);
});

[
    'math-pk-hp-track',
    'math-pk-attack-cue',
    '宠物出招',
    '机器人反击'
].forEach((needle) => {
    assert.ok(mathPk.includes(needle), `math PK should expose ${needle}`);
});

[
    'arena-flow-steps',
    'arena-current-actor',
    '选关',
    '选队',
    '对战',
    '奖励'
].forEach((needle) => {
    assert.ok(cardArenaUi.includes(needle) || arenaCss.includes(needle), `card arena should expose ${needle}`);
});

[
    'battle-encounter-intro',
    'battle-hp-name',
    'battle-action-hint',
    '继续探索'
].forEach((needle) => {
    assert.ok(app.includes(needle) || styleCss.includes(needle), `exploration battle should expose ${needle}`);
});

assert.ok(app.includes("addEventListener('battle-animate'"), 'exploration battle should keep BattleFx hook');
assert.ok(cardArenaUi.includes('arena-hp-line'), 'card arena should keep HP bars');
assert.ok(mathPk.includes('getMathPkPlayerAvatar'), 'math PK should keep current pet avatar');

console.log('PASS pk_brawl_shared_experience_contract');
