import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vocabPath = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');
const mediaManifestPath = path.join(repoRoot, 'assets', 'learn', 'english-vocab', 'minecraft-cards', 'manifest.json');
const narrationManifestPath = path.join(repoRoot, 'data', 'vocab', 'english-minecraft', 'narration-manifest.json');
const vocab = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
const mediaManifest = JSON.parse(fs.readFileSync(mediaManifestPath, 'utf8'));
const narrationManifest = JSON.parse(fs.readFileSync(narrationManifestPath, 'utf8'));
const cards = vocab.cards || [];
const mediaByPath = new Map((mediaManifest.assets || []).map(asset => [String(asset.path), asset]));
const narrationById = new Map((narrationManifest.entries || []).map(entry => [String(entry.cardId), entry]));
const narrationKeys = ['word', 'phrase', 'sentence', 'translation', 'phraseTranslation', 'sentenceTranslation'];

function localFile(relative, label) {
    assert.match(String(relative || ''), /^(?:assets|prj)\//, `${label} must be a local asset path`);
    const filePath = path.join(repoRoot, String(relative).replaceAll('/', path.sep));
    assert.ok(fs.existsSync(filePath), `${label} is missing: ${relative}`);
    assert.ok(fs.statSync(filePath).size > 1024, `${label} is unexpectedly small: ${relative}`);
    return filePath;
}

function assertText(value, label) {
    assert.equal(typeof value, 'string', `${label} must be text`);
    assert.ok(value.trim(), `${label} must not be empty`);
    assert.ok(!/<[^>]+>|[\u0000-\u001f]/.test(value), `${label} contains markup/control text`);
    assert.ok(!/哈基米|薯仔/i.test(value), `${label} contains decorative source text`);
}

assert.equal(cards.length, 2168);
assert.ok(mediaManifest.assets.length >= 122);
assert.equal(narrationManifest.generatedCount, cards.length);
assert.equal(narrationManifest.generatedClipCount, cards.length * narrationKeys.length);

for (const [index, card] of cards.entries()) {
    const label = `card[${index}] ${card.word}`;
    const cardId = String(card.id || `card-${String(index + 1).padStart(4, '0')}`);
    for (const [field, value] of [
        ['word', card.word],
        ['translation', card.translation],
        ['phrase', card.phrase],
        ['phraseTranslation', card.phraseTranslation],
        ['sentence', card.sentence || card.example],
        ['sentenceTranslation', card.sentenceTranslation || card.exampleTranslation || card.exampleZh]
    ]) assertText(String(value || ''), `${label}.${field}`);

    const imagePath = localFile(card.image, `${label}.image`);
    const imageBytes = fs.readFileSync(imagePath);
    assert.equal(imageBytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${label}.image must be PNG`);
    assert.equal(imageBytes.readUInt32BE(16), 512, `${label}.image width must be 512`);
    assert.equal(imageBytes.readUInt32BE(20), 512, `${label}.image height must be 512`);
    const media = mediaByPath.get(card.image);
    if (media) assert.equal(media.path, card.image, `${label}.image must match media manifest`);

    localFile(card.audio, `${label}.audio`);
    const narration = card.narrationAudio;
    const narrationEntry = narrationById.get(cardId);
    assert.ok(narration, `${label}.narrationAudio must exist`);
    assert.ok(narrationEntry, `${label} must have a narration manifest entry`);
    for (const key of narrationKeys) {
        localFile(narration[key], `${label}.narrationAudio.${key}`);
        assert.equal(narrationEntry.files[key], narration[key], `${label}.${key} must match narration manifest`);
    }
}

console.log(`minecraft vocab card completeness: PASS (${cards.length} cards, image/content/audio/UI data audited)`);
