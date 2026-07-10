import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const prototypeDir = path.join(dir, '单词记忆射击场原型');
const cardsPath = path.join(prototypeDir, 'assets', 'word-memory-cards.json');
const voiceMapPath = path.join(prototypeDir, 'assets', 'voice', 'map.json');
const gamePath = path.join(prototypeDir, 'game.js');

function cleanText(text) {
  return String(text || '').replace(/\s+/g, '').trim();
}

assert.ok(fs.existsSync(cardsPath), 'word card data should exist');
assert.ok(fs.existsSync(gamePath), 'prototype game script should exist');
assert.ok(fs.existsSync(voiceMapPath), 'prototype should publish a local voice map for offline word playback');

const cards = JSON.parse(fs.readFileSync(cardsPath, 'utf8')).cards || [];
const voiceMap = JSON.parse(fs.readFileSync(voiceMapPath, 'utf8'));
const gameSource = fs.readFileSync(gamePath, 'utf8');

const requiredPhrases = cards.flatMap(card => [card.word, card.translation]).map(cleanText);
const coveredPhrases = requiredPhrases.filter(phrase => voiceMap[phrase]);
assert.ok(
  coveredPhrases.length >= 190,
  `prototype voice map should keep the curated local mp3 set, got ${coveredPhrases.length} covered phrases`
);

const missingVoiceFiles = Object.entries(voiceMap).filter(([, digest]) => {
  const audioPath = path.join(prototypeDir, 'assets', 'voice', `${digest}.mp3`);
  return !fs.existsSync(audioPath) || fs.statSync(audioPath).size <= 100;
}).map(([phrase]) => phrase);
assert.deepEqual(
  missingVoiceFiles,
  [],
  `prototype should ship playable local mp3 files for every published voice key, missing: ${missingVoiceFiles.join(', ')}`
);

assert.match(gameSource, /assets\/voice\/map\.json/, 'game should load a local prototype voice map');
assert.match(gameSource, /new Audio\(/, 'game should attempt local html audio playback first');
assert.match(gameSource, /speechSynthesis|SpeechSynthesisUtterance/, 'game should keep browser speech as a fallback');
assert.match(gameSource, /translation|word/, 'game should speak both Chinese pickup prompts and English answers');

console.log('PASS - word memory map voice contract');
