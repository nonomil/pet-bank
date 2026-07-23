import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const config = JSON.parse(read('data/learning-center/portal.json'));

assert.equal(config.schemaVersion, 1);
assert.equal(config.projectId, 'learning-center');
assert.equal(config.devProjectUrl, 'http://127.0.0.1:7001/');
assert.equal(config.reward.growthPoints, 2);
assert.equal(config.reward.petExp, 1);
assert.match(read('js/runtime-loader.js'), /js\/learning-center-external-bridge\.js\?v=1/);
assert.match(read('js/learning-center-external-bridge.js'), /petbank_learning_center_launches_v1/);
assert.match(read('js/learning-center-external-bridge.js'), /petbank\.bridge\.v1\.completed/);
assert.match(read('js/learning-center-external-bridge.js'), /petbank\.bridge\.v1\.reward-result/);
assert.match(read('js/learn-center.js'), /LearningCenterExternalBridge/);

console.log('learning center external bridge contract passed');
