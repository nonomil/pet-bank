import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const repoRoot = process.cwd();
const mathPkPath = path.join(repoRoot, 'js', 'math-pk.js');
const source = fs.readFileSync(mathPkPath, 'utf8');

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

function extractNumbers(text) {
    return (String(text).match(/\d+/g) || []).map((value) => Number(value));
}

async function collectQuestions(game, localStorage, difficulty, rounds = 40) {
    localStorage.setItem('petbank_math_difficulty', difficulty);
    const questions = [];
    for (let i = 0; i < rounds; i++) {
        const payload = await game.buildAsyncQuestionSet();
        questions.push(...payload.questions);
    }
    return questions;
}

const sandbox = createMathPkSandbox();
const game = sandbox.window.MathPKGame;
assert.ok(game, 'MathPKGame should be exposed on window');

const easy20Summary = game.describeAsyncQuestionSet({ difficulty: 'easy20', totalRounds: 5 });
assert.equal(easy20Summary.difficultyLabel, '加减起步');

const easy100Summary = game.describeAsyncQuestionSet({ difficulty: 'easy100', totalRounds: 5 });
assert.equal(easy100Summary.difficultyLabel, '加减进阶');

const easy20Questions = await collectQuestions(game, sandbox.localStorage, 'easy20');
assert.ok(easy20Questions.length > 0, 'easy20 should generate questions');
easy20Questions.forEach((question) => {
    assert.ok(!/[×÷]/.test(question.text), `easy20 should not include multiplication or division: ${question.text}`);
    const nums = extractNumbers(question.text);
    assert.ok(nums.length >= 2, `easy20 should be an arithmetic expression: ${question.text}`);
    assert.ok(nums.every((value) => value <= 20), `easy20 numbers should stay within 20: ${question.text}`);
});

const easy100Questions = await collectQuestions(game, sandbox.localStorage, 'easy100');
assert.ok(easy100Questions.length > 0, 'easy100 should generate questions');
easy100Questions.forEach((question) => {
    assert.ok(!/[×÷]/.test(question.text), `easy100 should not include multiplication or division: ${question.text}`);
    const nums = extractNumbers(question.text);
    assert.ok(nums.length >= 2, `easy100 should be an arithmetic expression: ${question.text}`);
    assert.ok(nums.every((value) => value <= 100), `easy100 numbers should stay within 100: ${question.text}`);
});

const mediumMulQuestions = await collectQuestions(game, sandbox.localStorage, 'medium_mul', 8);
assert.ok(
    mediumMulQuestions.some((question) => /×/.test(question.text)),
    'medium_mul should still include multiplication questions'
);

console.log('PASS math_pk_difficulty_levels');
