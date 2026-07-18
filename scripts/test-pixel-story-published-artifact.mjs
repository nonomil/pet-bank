import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'tmp', `pixel-story-published-artifact-${process.pid}`);

function scheduleArtifactCleanup() {
  const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'rm';
  const args = process.platform === 'win32'
    ? ['/d', '/c', 'rmdir', '/s', '/q', outDir]
    : ['-rf', outDir];
  spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}
const result = spawnSync(process.execPath, ['scripts/assemble-pages-artifact.mjs', outDir], {
  cwd: root,
  encoding: 'utf8',
  stdio: 'pipe'
});
assert.equal(result.status, 0, result.stderr || result.stdout);

const assetRoot = path.join(outDir, 'assets', 'story', 'pixel-dialogue');
const v2AssetRoot = path.join(outDir, 'assets', 'story', 'pixel-dialogue-v2');
const worldsAssetRoot = path.join(outDir, 'assets', 'story', 'pixel-worlds-v1');
const pngs = [];
const v2Pngs = [];
const worldsPngs = [];
const worldsWebps = [];
const worldsWavs = [];
const worldsOggs = [];
const mp3s = [];
function walk(dir, pngList = pngs) {
  assert.ok(fs.existsSync(dir), `artifact asset directory exists: ${dir}`);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file, pngList);
    else if (entry.name.endsWith('.png')) pngList.push(file);
    else if (entry.name.endsWith('.webp')) worldsWebps.push(file);
    else if (entry.name.endsWith('.wav')) worldsWavs.push(file);
    else if (entry.name.endsWith('.ogg')) worldsOggs.push(file);
    else if (entry.name.endsWith('.mp3')) mp3s.push(file);
  }
}
walk(assetRoot);
walk(v2AssetRoot, v2Pngs);
walk(worldsAssetRoot, worldsPngs);
assert.equal(pngs.length, 0, `rejected story PNGs must stay out of the Pages artifact, got ${pngs.length}`);
assert.equal(v2Pngs.length, 14, `expected 14 accepted v2 story PNGs in Pages artifact, got ${v2Pngs.length}`);
assert.equal(worldsPngs.length, 0, `pixel worlds map PNGs must be converted out of the Pages artifact, got ${worldsPngs.length}`);
assert.equal(worldsWebps.length, 276, `expected 4 maps + 80 scenes + 80 props + 32 character frames + 80 route icons, got ${worldsWebps.length}`);
assert.equal(worldsWavs.length, 0, `source pixel story WAV files must stay out of the Pages artifact, got ${worldsWavs.length}`);
assert.equal(worldsOggs.length, 960, `expected 960 published pixel story OGG files, got ${worldsOggs.length}`);
assert.equal(mp3s.length, 37, `expected 37 story MP3s in Pages artifact, got ${mp3s.length}`);
assert.ok(fs.existsSync(path.join(outDir, 'data', 'story-packs', '04-pixel-dialogue-story', 'audio-manifest.json')));
assert.ok(fs.existsSync(path.join(outDir, 'data', 'story-packs', '05-pixel-worlds-story', 'manifest.json')));
const audioManifest = JSON.parse(fs.readFileSync(path.join(outDir, 'data', 'story-packs', '05-pixel-worlds-story', 'audio-manifest.json'), 'utf8'));
assert.equal(audioManifest.status, 'complete');
assert.equal(audioManifest.generatedNodes, 80);
assert.equal(audioManifest.audioFormat, 'ogg', 'published audio manifest should record the compressed format');
assert.equal(audioManifest.audioSubtype, 'opus', 'published audio manifest should record the Opus subtype');
assert.match(audioManifest.entries['sf-01'].file, /\.ogg$/, 'published audio manifest should be rewritten to OGG');
assert.ok(fs.statSync(path.join(outDir, audioManifest.entries['sf-01'].file)).size > 256);
const narrationRoot = path.join(outDir, 'assets', 'learn', 'english-vocab', 'minecraft-narration');
const narrationFiles = fs.readdirSync(narrationRoot);
assert.equal(narrationFiles.filter((file) => file.endsWith('.mp3')).length, 0, 'published Minecraft narration must not retain MP3 sources');
assert.equal(narrationFiles.filter((file) => file.endsWith('.ogg')).length, 10840, 'published Minecraft narration must contain all Opus variants');
const publishedVocab = JSON.parse(fs.readFileSync(path.join(outDir, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json'), 'utf8'));
for (const card of publishedVocab.cards || []) {
  for (const key of ['phrase', 'sentence', 'translation', 'phraseTranslation', 'sentenceTranslation']) {
    assert.match(String(card.narrationAudio?.[key] || ''), /\.ogg$/, `published narration path should use OGG: ${card.id} ${key}`);
  }
}
assert.ok(fs.existsSync(path.join(outDir, 'js', 'pixel-story-map.js')));
const publishedMapSource = fs.readFileSync(path.join(outDir, 'js', 'pixel-story-map.js'), 'utf8');
assert.match(publishedMapSource, /PixelStoryEngine\.enterChapter\(chapterId\)/, 'published map should delegate chapter audio and content to the story engine');
assert.doesNotMatch(publishedMapSource, /chapterId \+ '\.(?:ogg|wav)'/, 'published map must not own a legacy dynamic audio path');
assert.ok(fs.existsSync(path.join(outDir, 'js', 'pixel-story-engine.js')));
assert.ok(fs.existsSync(path.join(outDir, 'css', 'pixel-story.css')));
const levelDir = path.join(outDir, 'data', 'story-packs', '05-pixel-worlds-story', 'levels');
assert.equal(fs.readdirSync(levelDir).filter((file) => file.endsWith('.json')).length, 80, 'all 80 paged story levels are published');
scheduleArtifactCleanup();
console.log(`PASS pixel story published artifact: ${v2Pngs.length} v2 PNG, ${worldsOggs.length} OGG, ${mp3s.length} MP3`);
