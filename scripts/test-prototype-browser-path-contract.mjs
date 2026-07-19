import assert from 'node:assert/strict';
import fs from 'node:fs';

const smokePath = 'prj/学习机玩法原型/scripts/test-full-prototype-smoke.mjs';
const source = fs.readFileSync(smokePath, 'utf8');

assert.match(source, /PLAYWRIGHT_BROWSER(?:_PATH)?/, 'prototype smoke should honor the shared Playwright browser path override');
console.log('prototype browser path contract: PASS');
