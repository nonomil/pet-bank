import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arcadeDir = path.join(root, 'prj', '学习机玩法原型');
const pinyinVoiceDir = path.join(root, 'prj', '拼音块收集台原型', 'assets', 'voice');
const gamePath = path.join(arcadeDir, 'game.js');
const verifyPath = path.join(arcadeDir, 'verify.mjs');
const readmePath = path.join(arcadeDir, 'README.md');
const sharedVoiceMapPath = path.join(pinyinVoiceDir, 'map.json');
const sharedVoiceManifestPath = path.join(pinyinVoiceDir, 'manifest.json');

assert.ok(fs.existsSync(gamePath), 'learning arcade game should exist');
assert.ok(fs.existsSync(verifyPath), 'learning arcade verify should exist');
assert.ok(fs.existsSync(readmePath), 'learning arcade readme should exist');
assert.ok(fs.existsSync(sharedVoiceMapPath), 'shared hanzi voice map should exist in pinyin prototype');
assert.ok(fs.existsSync(sharedVoiceManifestPath), 'shared hanzi voice manifest should exist in pinyin prototype');

const gameSource = fs.readFileSync(gamePath, 'utf8');
const verifySource = fs.readFileSync(verifyPath, 'utf8');
const readme = fs.readFileSync(readmePath, 'utf8');
const voiceMap = JSON.parse(fs.readFileSync(sharedVoiceMapPath, 'utf8'));
const voiceManifest = JSON.parse(fs.readFileSync(sharedVoiceManifestPath, 'utf8'));

assert.equal(voiceManifest.prototypeId, 'pinyin-star-scout', 'learning arcade should reuse the pinyin prototype hanzi voice bundle');
assert.match(gameSource, /拼音块收集台原型\/assets\/voice|pinyin-star-scout|VOICE_MAP_URL/, 'learning arcade should point hanzi voice playback at the shared pinyin prototype voice bundle');
assert.match(gameSource, /new Audio\(/, 'learning arcade should prefer local audio playback for hanzi prompts');
assert.match(gameSource, /speechSynthesis|SpeechSynthesisUtterance/, 'learning arcade should keep speech fallback');
assert.match(gameSource, /announceHanziTarget|catchHanziBubble|speakHanziTask|speakCurrentHanziTarget/, 'learning arcade should expose a dedicated hanzi task voice path');
assert.match(verifySource, /拼音块收集台原型|assets\/voice|hanzi voice/i, 'verify script should cover hanzi voice reuse');
assert.match(readme, /拼音块收集台原型|本地语音|汉字跳台/i, 'README should explain hanzi voice reuse');

const sampleKeys = ['山', 'shān', '我们一起去爬**山**。', '水', 'shuǐ', '小鱼在**水**里游。'];
sampleKeys.forEach(key => {
  assert.ok(voiceMap[key], `shared voice map should contain ${key}`);
  const file = path.join(pinyinVoiceDir, `${voiceMap[key]}.mp3`);
  assert.ok(fs.existsSync(file) && fs.statSync(file).size > 100, `shared voice audio should exist for ${key}`);
});

console.log('PASS - 学习机玩法原型汉字语音复用契约');
