import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('js/runtime-loader.js', 'utf8');

assert.match(source, /script\.onerror[\s\S]*scriptPromises\.delete\(src\)/, 'failed scripts should be evicted for retry');
assert.match(source, /link\.onerror[\s\S]*stylePromises\.delete\(href\)/, 'failed styles should be evicted for retry');
assert.match(source, /function once[\s\S]*catch[\s\S]*featurePromises\.delete\(key\)/, 'failed feature bundles should be evicted for retry');

console.log('PASS runtime loader retry contract');
