import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const mathPk = fs.readFileSync(path.join(repoRoot, 'js', 'math-pk.js'), 'utf8');
const explorationDetail = fs.readFileSync(path.join(repoRoot, 'js', 'exploration-detail.js'), 'utf8');

[
    'fitFor',
    'reason',
    'buildGuidedFeedback',
    '复盘',
    '下一局',
    '适合'
].forEach((needle) => {
    assert.ok(mathPk.includes(needle), `math-pk.js should contain guided feedback marker: ${needle}`);
});

assert.ok(
    /DIFFICULTY_OPTIONS[\s\S]*fitFor[\s\S]*reason/.test(mathPk),
    'difficulty options should include fitFor and reason'
);

assert.ok(
    /result\(data\)[\s\S]*(guidedFeedback|nextStep)/.test(mathPk),
    'result view should render guided feedback'
);

assert.ok(
    /buildMathRetryHint|下一步/.test(explorationDetail),
    'exploration math feedback should expose a next-step retry hint'
);

[
    '笨',
    '太差',
    '失败了',
    '错太多'
].forEach((badWord) => {
    assert.equal(mathPk.includes(badWord), false, `math-pk.js should avoid discouraging word: ${badWord}`);
    assert.equal(explorationDetail.includes(badWord), false, `exploration-detail.js should avoid discouraging word: ${badWord}`);
});

console.log('PASS math_pk_guided_feedback_contract');
