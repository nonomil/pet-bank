import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const repoRoot = process.cwd();
const learningArcadeHtml = path.join(repoRoot, 'prj', '学习机玩法原型', 'index.html');
const wordMemoryHtml = path.join(repoRoot, 'prj', '单词记忆射击场原型', 'index.html');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('learning arcade loads vocabulary fallback scripts only for file protocol', () => {
  const source = read(learningArcadeHtml);

  assert.match(source, /loadFileFallbackScripts/);
  assert.match(source, /location\.protocol\s*!==\s*['"]file:/);
  assert.match(source, /document\.write/);
  assert.match(source, /minecraft-typing-expanded\.js/);
  assert.match(source, /english-typing-unified\.js/);
  assert.doesNotMatch(source, /<script\s+src=["']\.\/assets\/generated\/(?:minecraft-typing-expanded|english-typing-unified)\.js/i);
  assert.doesNotMatch(source, /<script\s+src=["']\.\.\/\.\.\/data\/vocab\/单词库_分级\/[^"']+\.js/i);
});

test('word memory loads only the selected file protocol fallback deck', () => {
  const source = read(wordMemoryHtml);

  assert.match(source, /loadFileFallbackScripts/);
  assert.match(source, /location\.protocol\s*!==\s*['"]file:/);
  assert.match(source, /document\.write/);
  assert.match(source, /word-memory-cards\.js/);
  assert.match(source, /word-memory-core-cards\.js/);
  assert.match(source, /word-memory-extension-cards\.js/);
  assert.match(source, /vocab.*extension/s);
  assert.match(source, /vocab.*all/s);
  assert.doesNotMatch(source, /<script\s+src=["']\.\/assets\/word-memory-(?:cards|core-cards|extension-cards)\.js/i);
  assert.doesNotMatch(source, /<script\s+src=["']\.\/assets\/voice\/map\.js/i);
});
