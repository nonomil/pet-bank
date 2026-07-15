import assert from 'node:assert/strict';
import fs from 'node:fs';

const snapshot = JSON.parse(fs.readFileSync('data/learn/external/mayihaoke/word-map.json', 'utf8'));
assert.equal(snapshot.scope, 'general-english-word-map');
assert.equal(snapshot.groupCount, 6);
assert.ok(snapshot.totalRenderedEntries >= 3700);
assert.ok(snapshot.uniqueWords >= 3000);
assert.equal(new Set(snapshot.words).size, snapshot.words.length);
assert.equal(snapshot.note.includes('不并入 Minecraft'), true);
console.log(`mayihaoke word map: PASS (${snapshot.uniqueWords} unique words)`);
