import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RUNNER = path.join(ROOT, 'scripts', 'run-full-regression.mjs');

assert.ok(fs.existsSync(RUNNER), 'scripts/run-full-regression.mjs should exist');

const source = fs.readFileSync(RUNNER, 'utf8');

assert.match(source, /PETBANK_BASE_URL/, 'runner should provide PETBANK_BASE_URL support');
assert.match(source, /gameplay_core_flows_simulation\.mjs/, 'runner should include core gameplay simulation');
assert.match(source, /full_game_loop_simulation\.mjs/, 'runner should include full game loop simulation');
assert.match(source, /cloud_family_social_pk_simulation\.mjs/, 'runner should include cloud family/social simulation');
assert.match(source, /edge_states_standalone_simulation\.mjs/, 'runner should include edge states simulation');
assert.match(source, /leaderboard_standalone_simulation\.mjs/, 'runner should include leaderboard simulation');
assert.match(source, /audio_battle_feedback_contract\.test\.mjs/, 'runner should include audio contract test');

console.log('PASS regression runner contract');
