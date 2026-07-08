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
    '.math-pk-rush-trail',
    '.math-pk-battle-caption',
    '.math-pk-caster',
    '.math-pk-target-hit',
    '_playAttackFx',
    '_pickAttackStyle',
    'getMathPkPlayerAttackArchetype',
    'getMathPkRobotAttackArchetype',
    '.math-answer-correct',
    '.math-answer-wrong',
    '@media (prefers-reduced-motion: reduce)',
    'math-row-reveal',
    'math-correct-spark',
    'math-pk-rush-dash-human',
    'math-pk-rush-dash-robot',
    'math-pk-rush-hop-human',
    'math-pk-rush-hop-robot',
    'math-pk-rush-spin-human',
    'math-pk-rush-spin-robot',
    'math-pk-trail-dash-human',
    'math-pk-trail-dash-robot',
    'math-pk-target-hit-from-human',
    'math-pk-target-hit-from-robot',
    'math-pk-impact-burst',
    'from-human',
    'from-robot',
    '飞扑突击',
    '腾空一击',
    '旋风撞击'
].forEach((needle) => {
    assert.ok(source.includes(needle), `math-pk.js should contain Math FX marker: ${needle}`);
});

assert.ok(!/window\.lottie|lottie\.loadAnimation/.test(source), 'P1 Math FX should not depend on Lottie runtime');
assert.ok(
    !source.includes('linear-gradient(135deg,#10b981,#22d3ee)'),
    'math PK battle feedback should not use a high-saturation center toast'
);
assert.ok(
    source.includes('grid-template-columns:repeat(3,64px)'),
    'desktop Math PK keypad should keep a larger 3-column nine-key layout'
);

console.log('PASS math_pk_fx_contract');
