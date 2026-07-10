import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const prototypeDir = path.join(dir, '拼音块收集台原型');
const htmlPath = path.join(prototypeDir, 'index.html');
const gamePath = path.join(prototypeDir, 'game.js');
const verifyPath = path.join(prototypeDir, 'verify.mjs');
const manifestPath = path.join(prototypeDir, 'assets', 'voice', 'manifest.json');
const voiceMapPath = path.join(prototypeDir, 'assets', 'voice', 'map.json');
const hanziPath = path.join(dir, '..', 'data', 'hanzi-questions.json');

function cleanText(text) {
  return String(text || '').replace(/\s+/g, '').trim();
}

assert.ok(fs.existsSync(htmlPath), 'pinyin prototype html should exist');
assert.ok(fs.existsSync(gamePath), 'pinyin prototype game should exist');
assert.ok(fs.existsSync(verifyPath), 'pinyin prototype verify script should exist');
assert.ok(fs.existsSync(manifestPath), 'pinyin prototype should publish a local voice manifest');
assert.ok(fs.existsSync(voiceMapPath), 'pinyin prototype should publish a local voice map');

const html = fs.readFileSync(htmlPath, 'utf8');
const gameSource = fs.readFileSync(gamePath, 'utf8');
const verifySource = fs.readFileSync(verifyPath, 'utf8');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const voiceMap = JSON.parse(fs.readFileSync(voiceMapPath, 'utf8'));
const hanziData = JSON.parse(fs.readFileSync(hanziPath, 'utf8'));

const allQuestions = Object.values(hanziData.levels || {}).flat().filter(item => item?.char && item?.pinyin);
const manifestLimit = manifest.limit || 0;
const coveredQuestions = manifestLimit > 0 ? allQuestions.slice(0, manifestLimit) : allQuestions;
const requiredLines = coveredQuestions.flatMap(item => [item.char, item.pinyin, item.example]).map(cleanText);
const missingKeys = requiredLines.filter(line => !voiceMap[line]);

assert.deepEqual(
  missingKeys,
  [],
  `pinyin voice map should cover configured char, pinyin, and example lines, missing: ${missingKeys.join(', ')}`
);

const missingFiles = requiredLines.filter(line => {
  const digest = voiceMap[line];
  const file = path.join(prototypeDir, 'assets', 'voice', `${digest}.mp3`);
  return !digest || !fs.existsSync(file) || fs.statSync(file).size <= 100;
});
assert.deepEqual(
  missingFiles,
  [],
  `pinyin voice assets should exist for all configured lines, missing: ${missingFiles.join(', ')}`
);

assert.equal(manifest.prototypeId, 'pinyin-star-scout', 'voice manifest should target the pinyin star scout prototype');
assert.equal(manifest.source.kind, 'hanzi-questions', 'voice manifest should describe the hanzi questions source');
assert.match(html, /speakButton|voiceButton|朗读/, 'pinyin page should expose a replay voice button');
assert.match(gameSource, /assets\/voice\/map\.json/, 'pinyin game should load local voice assets');
assert.match(gameSource, /new Audio\(/, 'pinyin game should prefer local html audio playback');
assert.match(gameSource, /speechSynthesis|SpeechSynthesisUtterance/, 'pinyin game should keep browser speech fallback');
assert.match(gameSource, /example|pinyin|char/, 'pinyin game should be able to speak the visible task content');
assert.match(verifySource, /assets\/voice|voice manifest|voice map/i, 'verify script should cover the pinyin voice workflow');

console.log('PASS - pinyin star scout voice contract');
