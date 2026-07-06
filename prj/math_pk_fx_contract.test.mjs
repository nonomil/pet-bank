import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const source = fs.readFileSync(path.join(repoRoot, 'js', 'math-pk.js'), 'utf8');

[
    '.mul-streak-meter',
    '.mul-streak-cell',
    '.math-array-row.fx-reveal',
    '.math-array-dot',
    '.math-fx-burst',
    '.math-answer-correct',
    '.math-answer-wrong',
    '@media (prefers-reduced-motion: reduce)',
    'math-row-reveal',
    'math-correct-spark'
].forEach((needle) => {
    assert.ok(source.includes(needle), `math-pk.js should contain Math FX marker: ${needle}`);
});

assert.ok(!/window\.lottie|lottie\.loadAnimation/.test(source), 'P1 Math FX should not depend on Lottie runtime');

console.log('PASS math_pk_fx_contract');
