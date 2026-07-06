import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const read = (relPath) => fs.readFileSync(path.join(repoRoot, relPath), 'utf8');

const reference = read('docs/数学PK游戏/宝可梦数学大乱斗.md');
const design = read('docs/PK大乱斗共通设计/README.md');
const plan = read('docs/plans/2026-07-06-pk-brawl-shared-optimization.md');
const mathPk = read('js/math-pk.js');
const cardArenaUi = read('js/card-arena-ui.js');
const app = read('js/app.js');

[
    '游戏选关',
    '选择角色',
    '输入结果',
    '血条',
    '胜利结算'
].forEach((needle) => {
    assert.ok(reference.includes(needle), `reference should include ${needle}`);
});

[
    '数学 PK',
    '卡牌对战',
    '探索故事',
    '选关',
    '角色确认',
    '出招反馈',
    'HP',
    '胜利结算',
    '不使用宝可梦原图'
].forEach((needle) => {
    assert.ok(design.includes(needle), `shared PK design should cover ${needle}`);
});

[
    '任务 3：新增跨玩法实现契约测试',
    '任务 4：数学 PK 正式对战加入出招/HP 风格反馈',
    '任务 5：卡牌对战入口加入步骤条',
    '任务 6：探索遭遇战加入故事化 PK 入口',
    'prj/pk_brawl_shared_experience_contract.test.mjs'
].forEach((needle) => {
    assert.ok(plan.includes(needle), `implementation plan should include ${needle}`);
});

assert.ok(mathPk.includes('getMathPkPlayerAvatar'), 'math PK should use the current pet as player avatar');
assert.ok(mathPk.includes('MATH_PK_ROBOT_RIVALS'), 'math PK should have difficulty-based robot rivals');
assert.ok(cardArenaUi.includes('openStages'), 'card arena should have stage selection');
assert.ok(cardArenaUi.includes('confirmTeam'), 'card arena should have team selection');
assert.ok(cardArenaUi.includes('arena-hp-line'), 'card arena should render HP lines');
assert.ok(app.includes('function showBattleModal(battle)'), 'exploration should have a battle modal');
assert.ok(app.includes("addEventListener('battle-animate'"), 'exploration battle should dispatch visual battle feedback');

console.log('PASS pk_brawl_shared_design_contract');
