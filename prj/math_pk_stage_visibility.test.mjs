import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const source = fs.readFileSync(path.join(repoRoot, 'js', 'math-pk.js'), 'utf8');

assert.ok(
    source.includes("url('assets/arena/arena-bg.webp')"),
    'math PK should keep the original arena background'
);
assert.ok(!source.includes('math-pk-stage-bg.webp'), 'math PK should not use the rejected full-screen bright background');

const sideGlowAssets = [
    'assets/arena/math-pk-left-glow.webp',
    'assets/arena/math-pk-right-glow.webp'
];

sideGlowAssets.forEach((relPath) => {
    assert.ok(source.includes(relPath), `math-pk.js should reference side glow asset ${relPath}`);
    assert.ok(fs.existsSync(path.join(repoRoot, relPath)), `${relPath} should exist`);
});

assert.ok(
    source.includes('.arena-side::before') && source.includes('.arena-side.robot::before'),
    'math PK should render separate glow images behind both side characters'
);
assert.ok(!source.includes('arena-podium-breathe'), 'math PK should not add moving podium effects for this scoped visibility fix');

console.log('PASS math_pk_stage_visibility');
