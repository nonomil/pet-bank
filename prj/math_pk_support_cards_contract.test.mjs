import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = process.cwd();
const mathPkPath = path.join(repoRoot, 'js', 'math-pk.js');
const source = fs.readFileSync(mathPkPath, 'utf8');

assert.ok(source.includes('MATH_PK_SUPPORT_CARDS'), 'Math PK should define a support-card catalog');
assert.ok(source.includes('show_array'), 'Math PK should include the show_array support card');
assert.ok(source.includes('slow_robot'), 'Math PK should include the slow_robot support card');
assert.ok(source.includes('retry_once'), 'Math PK should include the retry_once support card');
assert.ok(source.includes('math-pk-support-chooser'), 'Math PK should render a support-card chooser');
assert.ok(source.includes('estimateRewardStars'), 'Math PK should expose reward star estimation');
assert.ok(source.includes('本局获得'), 'Math PK results should show earned stars');
assert.ok(source.includes('累计星轨'), 'Math PK results should show cumulative star track');
assert.ok(source.includes('解锁'), 'Math PK reward messaging should show unlock hints');

function createMathPkSandbox() {
    const storage = new Map();
    const documentStub = {
        addEventListener() {},
        getElementById() { return null; }
    };
    const windowStub = {};

    const sandbox = {
        console,
        Math,
        Date,
        Promise,
        setTimeout,
        clearTimeout,
        fetch: async () => ({ json: async () => ({ grades: {} }) }),
        localStorage: {
            getItem(key) { return storage.has(key) ? storage.get(key) : null; },
            setItem(key, value) { storage.set(key, String(value)); },
            removeItem(key) { storage.delete(key); }
        },
        document: documentStub,
        window: windowStub
    };
    windowStub.localStorage = sandbox.localStorage;
    windowStub.document = documentStub;
    windowStub.fetch = sandbox.fetch;

    vm.createContext(sandbox);
    new vm.Script(source, { filename: 'math-pk.js' }).runInContext(sandbox);
    return sandbox;
}

const sandbox = createMathPkSandbox();
const game = sandbox.window.MathPKGame;
assert.ok(game, 'MathPKGame should be exposed on window');
assert.equal(typeof game.getSupportCards, 'function', 'MathPKGame should expose getSupportCards');
assert.equal(typeof game.getUnlockedSupportCardIds, 'function', 'MathPKGame should expose getUnlockedSupportCardIds');
assert.equal(typeof game.estimateRewardStars, 'function', 'MathPKGame should expose estimateRewardStars');

const supportCards = game.getSupportCards();
assert.ok(supportCards.show_array, 'support catalog should expose show_array');
assert.ok(supportCards.slow_robot, 'support catalog should expose slow_robot');
assert.ok(supportCards.retry_once, 'support catalog should expose retry_once');

const baseThink = game.estimateRobotThinkMs({ text: '3 × 4', answer: 12, op: '*' }, 'medium_mul');
sandbox.localStorage.setItem('petbank_math_support_selected', 'slow_robot');
const slowedThink = game.estimateRobotThinkMs({ text: '3 × 4', answer: 12, op: '*' }, 'medium_mul');
assert.ok(slowedThink >= baseThink + 2000, `slow_robot should add robot think time: base=${baseThink}, slowed=${slowedThink}`);

const mulStars = game.estimateRewardStars({
    difficulty: 'medium_mul',
    completed: true,
    correctCount: 3,
    multiplicationCorrectCount: 1,
    win: false,
    total: 5,
    maxCombo: 1
});
assert.equal(mulStars, 3, 'medium_mul should award up to 3 support stars');

console.log('PASS math_pk_support_cards_contract');
