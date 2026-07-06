import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const source = fs.readFileSync(path.join(repoRoot, 'js', 'math-pk.js'), 'utf8');

const robotAssetBases = [
    'robot-easy20',
    'robot-easy100',
    'robot-mul',
    'robot-mix',
    'robot-hard'
];

const robotWebpAssets = robotAssetBases.map((name) => `assets/arena/math-rivals/${name}.webp`);
const robotPngAssets = robotAssetBases.map((name) => `assets/arena/math-rivals/${name}.png`);

assert.ok(!source.includes('human-kid.png'), 'math PK should not render the old human kid avatar');
assert.ok(source.includes('getMathPkPlayerAvatar'), 'math PK should resolve the current pet avatar');
assert.ok(source.includes('MATH_PK_ROBOT_RIVALS'), 'math PK should define robot rivals by difficulty');
assert.ok(source.includes('assets/pets/poses/dog_idle.webp'), 'math PK should keep dog idle as safe fallback');

robotWebpAssets.forEach((relPath) => {
    assert.ok(source.includes(relPath), `math-pk.js should reference ${relPath}`);
});

[...robotWebpAssets, ...robotPngAssets].forEach((relPath) => {
    assert.ok(fs.existsSync(path.join(repoRoot, relPath)), `${relPath} should exist`);
});

console.log('PASS math_pk_character_assets');
