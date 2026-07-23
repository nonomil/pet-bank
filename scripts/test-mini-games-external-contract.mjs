import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const config = JSON.parse(read('data/mini-games/portal.json'));

assert.equal(config.schemaVersion, 1);
assert.equal(config.projectId, 'mini-games');
assert.equal(config.devProjectUrl, 'http://127.0.0.1:7003/');
assert.equal(config.reward.growthPoints, 3);
assert.equal(config.reward.petExp, 2);
assert.match(read('js/runtime-loader.js'), /js\/mini-games-external-bridge\.js\?v=1/);
assert.match(read('js/mini-games-external-bridge.js'), /petbank_mini_games_launches_v1/);
assert.match(read('js/mini-games-external-bridge.js'), /petbank\.bridge\.v1\.completed/);
assert.match(read('js/mini-games-external-bridge.js'), /petbank\.bridge\.v1\.reward-result/);
assert.match(read('index.html'), /MiniGamesExternalBridge\.launch\(\)/);

console.log('mini games external bridge contract passed');
