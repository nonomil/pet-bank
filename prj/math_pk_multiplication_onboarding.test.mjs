import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = process.cwd();
const source = fs.readFileSync(path.join(repoRoot, 'js', 'math-pk.js'), 'utf8');

function createElementStub(id) {
    return {
        id,
        innerHTML: '',
        textContent: '',
        style: {},
        classList: { add() {}, remove() {} },
        querySelector() {
            return { style: {}, offsetWidth: 0 };
        }
    };
}

function createSandbox() {
    const storage = new Map();
    const elements = new Map();
    const documentStub = {
        addEventListener() {},
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, createElementStub(id));
            return elements.get(id);
        }
    };
    const windowStub = {};
    const sandbox = {
        console,
        Math,
        Date,
        Promise,
        setTimeout(fn) { fn(); return 0; },
        clearTimeout() {},
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
    return { sandbox, elements };
}

function answerFromTrainingHtml(html) {
    const match = html.match(/(\d+(?: \+ \d+)*) = \?/);
    assert.ok(match, 'training html should show repeated addition');
    return match[1].split(' + ').reduce((sum, value) => sum + Number(value), 0);
}

function submitNumber(game, value) {
    String(value).split('').forEach((digit) => game._inputDigit(Number(digit)));
    game._submitAnswer();
}

const { sandbox, elements } = createSandbox();
const game = sandbox.window.MathPKGame;
assert.ok(game, 'MathPKGame should be exposed');

sandbox.localStorage.setItem('petbank_math_difficulty', 'medium_mul');
game.renderUI('math-pk-container');

const centerHtml = elements.get('arena-center').innerHTML;
assert.match(centerHtml, /练习场/, 'medium_mul lobby should default to practice mode');
assert.match(centerHtml, /开始练习/, 'medium_mul lobby should offer practice start');
assert.match(centerHtml, /开始对战/, 'medium_mul lobby should still expose PK entry');

game.startTraining();
const trainingHtml = elements.get('arena-center').innerHTML;
assert.match(trainingHtml, /每组/, 'training question should explain groups');
assert.match(trainingHtml, /[+]/, 'training question should show repeated addition');
assert.match(trainingHtml, /×/, 'training question should show multiplication notation');
assert.match(trainingHtml, /math-array-row/, 'training question should render visual rows');

submitNumber(game, answerFromTrainingHtml(trainingHtml));
const oneStreakHtml = elements.get('arena-center').innerHTML;
assert.match(oneStreakHtml, /连对 1\/5/, 'correct training answer should advance streak meter');

const nextAnswer = answerFromTrainingHtml(oneStreakHtml);
submitNumber(game, nextAnswer + 1);
const resetStreakHtml = elements.get('arena-center').innerHTML;
assert.match(resetStreakHtml, /连对 0\/5/, 'wrong training answer should reset visible streak meter immediately');
assert.match(elements.get('mul-feedback').innerHTML, /再看一眼/, 'wrong answer should keep an explanation visible');

console.log('PASS math_pk_multiplication_onboarding');
