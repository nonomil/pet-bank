import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const snapshotPath = path.join(repoRoot, 'data/learn/external/mayihaoke/resources.json');

assert.ok(fs.existsSync(snapshotPath), 'mayihaoke resource snapshot should exist');

const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));

assert.equal(snapshot.provider, 'mayihaoke');
assert.equal(snapshot.baseUrl, 'https://mayihaoke.com');
assert.ok(snapshot.generatedAt, 'snapshot should include generatedAt');
assert.ok(snapshot.entryScript?.startsWith('/assets/'), 'snapshot should include Vite entry script');

const routePaths = (snapshot.routes || []).map(route => route.path);
assert.ok(routePaths.includes('/mcbook56/read/:chapter?'), 'snapshot should include mcbook56 reader route');
assert.ok(routePaths.includes('/mcbookstarters/read/:chapter?'), 'snapshot should include starters reader route');
assert.ok(routePaths.includes('/minewords'), 'snapshot should include minewords route');
assert.ok(routePaths.includes('/cambridge-vocab'), 'snapshot should include cambridge vocab route');

assert.ok(Array.isArray(snapshot.chunks) && snapshot.chunks.length >= 10, 'snapshot should include JS chunks');
assert.ok(
  snapshot.chunks.some(chunk => /Chapter1[-\w]*\.js$/.test(chunk.path)),
  'snapshot should include Chapter1 chunk'
);

assert.ok(Array.isArray(snapshot.assets), 'snapshot should include asset list');
assert.ok(Array.isArray(snapshot.candidateWords), 'snapshot should include candidate words');
assert.ok(snapshot.candidateWords.length >= 20, 'snapshot should include at least 20 candidate words');

for (const word of snapshot.candidateWords.slice(0, 20)) {
  assert.ok(word.word && /^[a-z][a-z -]*$/i.test(word.word), `candidate word should include English word: ${word.word}`);
  assert.ok(word.translation, `${word.word} should include translation`);
  assert.ok(word.sourceRoute || word.sourceChunk, `${word.word} should include source reference`);
}

console.log('PASS - mayihaoke resource snapshot contract');
