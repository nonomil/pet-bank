import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const vocabPath = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');
const manifestPath = path.join(repoRoot, 'data', 'vocab', 'english-minecraft', 'narration-manifest.json');

assert.ok(fs.existsSync(manifestPath), 'narration manifest must exist');
const vocab = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const cards = vocab.cards || [];

assert.equal(manifest.status, 'complete', 'narration manifest must be complete');
assert.equal(manifest.totalCards, cards.length, 'narration manifest must cover the vocabulary pool');
assert.equal(manifest.generatedCount, cards.length, 'narration manifest must contain every card');
assert.equal(manifest.clipsPerCard, 6, 'each card must provide English and Chinese clips');
assert.equal(manifest.entries.length, cards.length, 'manifest must list every card');

const expectedKeys = ['word', 'phrase', 'sentence', 'translation', 'phraseTranslation', 'sentenceTranslation'];
const entryIds = new Set();
for (const entry of manifest.entries) {
    assert.ok(!entryIds.has(entry.cardId), `duplicate narration card id: ${entry.cardId}`);
    entryIds.add(entry.cardId);
    for (const key of expectedKeys) {
        const file = String(entry.files?.[key] || '');
        if (key === 'word') {
            assert.match(file, /^(?:assets\/learn\/english-vocab\/(?:audio|minecraft-audio|minecraft-narration)\/|prj\/anki-minecraft-vocab\/assets\/media\/)[^/]+\.(?:mp3|wav)$/);
        } else {
            assert.match(file, /^assets\/learn\/english-vocab\/minecraft-narration\/[^/]+\.(?:mp3|wav)$/);
        }
        const filePath = path.join(repoRoot, file);
        assert.ok(fs.existsSync(filePath), `missing ${key} narration: ${entry.cardId}`);
        assert.ok(fs.statSync(filePath).size > 1024, `${key} narration is unexpectedly small: ${entry.cardId}`);
    }
}

for (const [index, card] of cards.entries()) {
    assert.ok(card.narrationAudio, `card ${index} must expose narration audio`);
    for (const key of expectedKeys) {
        const file = String(card.narrationAudio[key] || '');
        assert.ok(file, `card ${index} is missing narrationAudio.${key}`);
        assert.ok(fs.existsSync(path.join(repoRoot, file)), `card ${index} points to missing ${key} narration`);
    }
}

console.log(`minecraft vocab narration: PASS (${cards.length} cards, ${cards.length * 6} clips)`);
