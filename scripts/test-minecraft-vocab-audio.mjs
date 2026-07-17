import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vocabPath = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');
const manifestPath = path.join(repoRoot, 'data', 'vocab', 'english-minecraft', 'audio-manifest.json');
const vocab = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const cards = vocab.cards || [];

assert.equal(manifest.engine, 'edge-tts', 'Minecraft audio manifest must use the recorded Edge-TTS engine');
assert.equal(manifest.voice, 'en-US-AnaNeural', 'Minecraft audio must record the Edge-TTS voice');
assert.equal(manifest.status, 'complete', 'Minecraft audio manifest must be complete');
assert.equal(manifest.generatedCount, 258, 'only the previously missing 258 cards should be generated');
assert.equal(manifest.entries.length, 258, 'manifest must list every generated card');

const generatedIds = new Set(manifest.entries.map((entry) => entry.cardId));
assert.equal(generatedIds.size, 258, 'generated audio entries must have unique card ids');
for (const entry of manifest.entries) {
    assert.equal(entry.engine, 'edge-tts');
    assert.equal(entry.voice, 'en-US-AnaNeural');
    assert.match(entry.file, /^assets\/learn\/english-vocab\/minecraft-audio\/[^/]+\.mp3$/);
    const filePath = path.join(repoRoot, entry.file);
    assert.ok(fs.existsSync(filePath), `missing generated audio: ${entry.cardId}`);
    const bytes = fs.readFileSync(filePath);
    assert.ok(bytes.subarray(0, 3).toString('ascii') === 'ID3' || bytes.length > 3, `${entry.cardId} should be an MP3 file`);
    assert.ok(bytes.length > 1024, `${entry.cardId} audio is unexpectedly small`);
}

const missing = cards.filter((card) => {
    const audio = String(card.audio || '');
    return !audio || !fs.existsSync(path.join(repoRoot, audio.replaceAll('/', path.sep)));
});
assert.deepEqual(missing, [], 'every Minecraft learning card must have a local audio file');
assert.equal(cards.filter((card) => card.audioSource === 'edge-tts').length, 258);

console.log(`minecraft vocab audio: PASS (${cards.length}/${cards.length}, Edge-TTS generated ${manifest.generatedCount})`);
