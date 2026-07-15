import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { readCards, enrichCard } = require('./enrich_minecraft_vocab.cjs');

const mainPath = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');
const referencePath = path.join(repoRoot, 'data', 'learn', 'external', 'mayihaoke', 'word-cards.json');
const mediaRoot = path.join(repoRoot, 'assets', 'learn', 'english-vocab', 'minecraft-cards');
const mediaManifest = JSON.parse(fs.readFileSync(path.join(mediaRoot, 'manifest.json'), 'utf8'));
const mainDoc = JSON.parse(fs.readFileSync(mainPath, 'utf8'));
const referenceDoc = JSON.parse(fs.readFileSync(referencePath, 'utf8'));

function assertCleanText(value, label) {
  assert.equal(typeof value, 'string', `${label} must be a string`);
  assert.ok(value.trim(), `${label} must not be empty`);
  assert.ok(!/<[^>]+>|[\u0000-\u001f]/.test(value), `${label} must not contain HTML/control text`);
}

function assertCard(card, label) {
  assertCleanText(card.word, `${label}.word`);
  assertCleanText(card.translation ?? card.chinese, `${label}.translation`);
  assertCleanText(card.phrase, `${label}.phrase`);
  assertCleanText(card.phraseTranslation, `${label}.phraseTranslation`);
  assertCleanText(card.sentence ?? card.example, `${label}.sentence`);
  assertCleanText(card.sentenceTranslation ?? card.exampleTranslation ?? card.exampleZh, `${label}.sentenceTranslation`);
  assert.ok(!/哈基米|薯仔/i.test(JSON.stringify(card)), `${label} contains decorative source text`);
}

const mainCards = readCards(mainDoc);
const referenceCards = readCards(referenceDoc);
assert.equal(mainCards.length, 96, 'main Minecraft learning pool should stay at 96 cards');
assert.equal(referenceCards.length, 500, 'reference snapshot should stay at 500 cards');
assert.equal(mainDoc.contentCuration, 'curated-v1', 'main vocabulary content should use the curated content pass');
assert.equal(mediaManifest.assets.length, 96, 'Minecraft card media manifest should cover all main cards');
mainCards.forEach((card, index) => assertCard(card, `main[${index}]`));
referenceCards.forEach((card, index) => assertCard(card, `reference[${index}]`));

for (const [index, card] of mainCards.entries()) {
  assert.match(card.image || '', /^assets\/learn\/english-vocab\/minecraft-cards\/card-/,
    `main[${index}] must use a local extracted image`);
  assert.equal(card.contentQuality, 'curated-v1', `main[${index}] should use curated content`);
  assert.ok(fs.existsSync(path.join(repoRoot, card.image)), `missing image for ${card.word}`);
  assert.ok(['anki-extracted', 'gpt-generated'].includes(card.imageType));
  assert.ok(card.imageSourceFile, `missing Anki source for ${card.word}`);
  assert.ok(['anki-matched', 'anki-approximate', 'gpt-generated'].includes(card.imageSourceQuality));
}

for (const [label, cards] of [['main', mainCards], ['reference', referenceCards]]) {
  const words = new Set();
  for (const [index, card] of cards.entries()) {
    const key = String(card.word || card.chinese).trim().toLocaleLowerCase();
    assert.ok(!words.has(key), `duplicate word in ${label}: ${key} at ${index}`);
    words.add(key);
  }
}

const generated = enrichCard({ word: 'creeper', translation: '苦力怕', category: 'mob' });
assert.equal(generated.phrase, 'a friendly creeper');
assert.equal(generated.phraseTranslation, '一只友好的苦力怕');
assert.equal(generated.sentence, 'A creeper is near the village.');
assert.equal(generated.sentenceTranslation, '一只苦力怕在村庄附近。');

console.log('minecraft vocab content: PASS');
