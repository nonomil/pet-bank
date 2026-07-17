import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

assert.match(read('scripts/local-server.mjs'), /process\.env\.PETBANK_PORT \|\| 7000/, 'local server should default to port 7000');
assert.match(read('启动服务.bat'), /http:\/\/127\.0\.0\.1:7000\//, 'Windows launcher should open port 7000');
assert.match(read('scripts/test-home-browser.mjs'), /127\.0\.0\.1:7000/, 'home browser test should target port 7000 by default');
assert.doesNotMatch(read('scripts/run-full-regression.mjs'), /127\.0\.0\.1:8765/, 'regression runner should not default to the old port');
assert.match(read('ops/hermes.yaml'), /localServeCommand: node scripts\/local-server\.mjs/, 'Hermes main-site preview should use the project local server');
assert.match(read('ops/hermes.yaml'), /localBaseUrl: http:\/\/127\.0\.0\.1:7000/, 'Hermes main-site preview should use port 7000');
assert.match(read('prj/anki-minecraft-vocab/hermes.yaml'), /localServeCommand: python -m http\.server 7001 --bind 127\.0\.0\.1/, 'standalone vocabulary preview should use port 7001');
assert.doesNotMatch(read('prj/anki-minecraft-vocab/hermes.yaml'), /8766/, 'standalone vocabulary config should not use the old port');
assert.doesNotMatch(read('docs_project/runbooks/self-hosted/ANKI-MINECRAFT-VOCAB-HERMES.md'), /127\.0\.0\.1:8766/, 'standalone vocabulary runbook should not use the old port');

console.log('PASS local preview port contract');
