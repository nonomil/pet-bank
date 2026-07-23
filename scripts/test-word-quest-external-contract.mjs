import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const config = JSON.parse(read('data/word-quest/portal.json'));

assert.equal(config.schemaVersion, 1);
assert.equal(config.projectId, 'word-quest');
assert.equal(config.devProjectUrl, 'http://127.0.0.1:7002/');
assert.ok(Number.isInteger(config.sessionTtlMs) && config.sessionTtlMs > 0);
assert.equal(config.reward.growthPoints, 10);
assert.equal(config.reward.petExp, 5);

const runtime = read('js/runtime-loader.js');
assert.match(runtime, /js\/word-quest-external-bridge\.js\?v=1/);
const page = read('js/minecraft-vocab-page.js');
assert.match(page, /data-mv-open-wordquest/);
assert.match(page, /WordQuestExternalBridge/);
const bridge = read('js/word-quest-external-bridge.js');
assert.match(bridge, /petbank_word_quest_launches_v1/);
assert.match(bridge, /petbank\.bridge\.v1\.completed/);
assert.match(bridge, /petbank\.bridge\.v1\.reward-result/);
assert.match(bridge, /profileRef/);
assert.match(bridge, /sourceId: 'word-quest'/);
assert.match(bridge, /growth_points/);
assert.match(bridge, /pet_exp/);

console.log('word quest external bridge contract passed');
