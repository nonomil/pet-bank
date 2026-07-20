import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const prototypeRoot = path.join(repoRoot, 'prj', '学习机玩法原型');
const gamePath = path.join(prototypeRoot, 'game.js');
const indexPath = path.join(prototypeRoot, 'index.html');
const contentPath = path.join(prototypeRoot, 'assets', 'generated', 'learning-games-content.json');

const gameSource = fs.readFileSync(gamePath, 'utf8');
const indexSource = fs.readFileSync(indexPath, 'utf8');
const content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
const initStart = gameSource.indexOf('async function init()');
const bridgeStart = gameSource.indexOf('\n  window.LearningArcadePrototype', initStart);
const applyHanziStart = gameSource.indexOf('function applyHanziData');
const ensureTypingStart = gameSource.indexOf('async function ensureTypingData', applyHanziStart);
assert.ok(initStart >= 0 && bridgeStart > initStart, 'learning arcade init function should be discoverable');
assert.ok(applyHanziStart >= 0 && ensureTypingStart > applyHanziStart, 'hanzi data application function should be discoverable');
const initSource = gameSource.slice(initStart, bridgeStart);
const applyHanziSource = gameSource.slice(applyHanziStart, ensureTypingStart);

assert.match(gameSource, /function ensureGameData\s*\(/, 'learning arcade should expose a per-game data loader');
assert.match(gameSource, /function loadFileFallbackScripts\s*\(/, 'file fallback scripts should be injectable on demand');
assert.match(gameSource, /function ensureHanziVoiceMap\s*\(/, 'hanzi voice index should have a cached lazy loader');
assert.doesNotMatch(initSource, /TYPING_VIEW_URL|HANZI_URL|HANZI_RUNTIME_URL|loadHanziVoiceMap\(/, 'home init must not fetch game-specific data');
assert.match(applyHanziSource, /state\.hanziPacks[\s\S]*state\.hasExplicitHanziPackChoice[\s\S]*preferredHanziPackId/, 'loaded hanzi packs should recalculate explicit saved-pack state');
assert.doesNotMatch(indexSource, /fallbackScripts|document\.write\(/, 'index.html must not inject the full file fallback pool at parse time');

assert.ok(Array.isArray(content.games) && content.games.length > 0, 'learning arcade content should define home games');
for (const game of content.games) {
  assert.match(String(game.image || ''), /\.webp$/i, `home image should use WebP: ${game.id}`);
  assert.doesNotMatch(String(game.image || ''), /\.png$/i, `home image should not use source PNG: ${game.id}`);
}

console.log('PASS learning arcade lazy data contract');
