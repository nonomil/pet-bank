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
const promptPath = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'minecraft-card-back-prompts.json');
const mediaRoot = path.join(repoRoot, 'assets', 'learn', 'english-vocab', 'minecraft-cards');
const mediaManifest = JSON.parse(fs.readFileSync(path.join(mediaRoot, 'manifest.json'), 'utf8'));
const mainDoc = JSON.parse(fs.readFileSync(mainPath, 'utf8'));
const referenceDoc = JSON.parse(fs.readFileSync(referencePath, 'utf8'));
const promptDoc = JSON.parse(fs.readFileSync(promptPath, 'utf8'));

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
  assert.ok(!/箭关|组组|原模|Cobble|Polished|MossyCobble/i.test(String(card.translation)), `${label}.translation contains source or OCR noise`);
  assert.ok(!/^carry\s/i.test(String(card.phrase)), `${label}.phrase must not use the generic carry fallback`);
  assert.ok(!/^携带/.test(String(card.phraseTranslation)), `${label}.phraseTranslation must not use the generic carry fallback`);
  assert.ok(!/一个有用的|一只友好的|箭关|组组|原模/.test(String(card.sentenceTranslation)), `${label}.sentenceTranslation contains a generic or semantically wrong template`);
  assert.ok(!/箭关|组组|原模|Cobble|Polished|MossyCobble/.test(String(card.exampleZh || card.exampleTranslation || '')), `${label}.exampleZh contains source or OCR noise`);
  assertCleanText(card.backImagePrompt, `${label}.backImagePrompt`);
}

const mainCards = readCards(mainDoc);
const referenceCards = readCards(referenceDoc);
assert.ok(mainCards.length >= 2000, 'main Minecraft learning pool should include the full merged vocabulary');
assert.equal(referenceCards.length, 500, 'reference snapshot should stay at 500 cards');
assert.equal(mainDoc.contentCuration, 'full-anki-reference-v1', 'main vocabulary content should use the full merged content pass');
assert.equal(mainDoc.imagePromptPolicy?.version, 'minecraft-card-back-v2', 'main vocabulary should declare the card-back image prompt policy');
assert.equal(promptDoc.cards.length, mainCards.length, 'prompt export must match the main vocabulary size');
assert.equal(promptDoc.promptPolicy.version, 'minecraft-card-back-v2', 'prompt export must declare the card-back policy');
assert.equal(mainDoc.mediaPolicy?.imageFallback, 'themed-text-card', 'merged pool should declare the themed image fallback');
assert.equal(mainDoc.mediaPolicy?.audioFallback, 'speech-synthesis-en-US', 'merged pool should declare the speech fallback');
assert.ok(mediaManifest.assets.length >= 122, 'Minecraft card media manifest should include the curated and generated card images');
mainCards.forEach((card, index) => assertCard(card, `main[${index}]`));
referenceCards.forEach((card, index) => assertCard(card, `reference[${index}]`));
const promptById = new Map(promptDoc.cards.map(card => [String(card.cardId), card]));
assert.equal(promptById.size, promptDoc.cards.length, 'prompt export card IDs must be unique');
assert.equal(new Set(mainCards.map(card => String(card.id))).size, mainCards.length, 'main vocabulary card IDs must be unique');
mainCards.forEach(card => {
  const prompt = promptById.get(String(card.id));
  assert.ok(prompt, `missing exported prompt for ${card.word}`);
  assert.equal(prompt.prompt, card.backImagePrompt, `exported prompt mismatch for ${card.word}`);
  if (card.backImage) {
    const imagePath = path.join(repoRoot, card.backImage);
    assert.ok(fs.existsSync(imagePath), `missing back image for ${card.word}`);
  }
});

assert.ok(mainCards.filter(card => card.image).length >= 1600, 'merged pool should retain Anki/local images');
assert.ok(mainCards.filter(card => card.audio).length >= 1600, 'merged pool should retain Anki/local audio');
assert.ok(mainCards.filter(card => card.imageSource === 'agnes-image-2.1-flash').length >= 26, 'generated image gap should be attached to the main pool');

for (const [index, card] of mainCards.entries()) {
  if (card.image) assert.ok(fs.existsSync(path.join(repoRoot, card.image)), `missing image for ${card.word}`);
  if (card.audio) assert.ok(fs.existsSync(path.join(repoRoot, card.audio)), `missing audio for ${card.word}`);
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
assert.equal(generated.phrase, 'spot a creeper');
assert.equal(generated.phraseTranslation, '发现一只苦力怕');
assert.match(generated.sentence, /creeper/);
assert.match(generated.sentenceTranslation, /苦力怕/);
const cow = enrichCard({ word: 'Cow', translation: '牛', category: 'item' }, { refreshGenerated: true });
assert.equal(cow.category, 'mob');
assert.equal(cow.phrase, 'spot a cow');
assert.match(cow.sentenceTranslation, /牛/);
const oreExamples = new Set([
  'diamond ore', 'iron ore', 'redstone ore', 'gold ore', 'coal ore', 'copper ore', 'quartz ore'
].map(word => enrichCard({ word, translation: '矿石', category: 'block' }).sentence));
assert.ok(oreExamples.size >= 4, 'ore examples should rotate across multiple Minecraft scenes');
assert.ok([...oreExamples].some(sentence => /doorway|base|path|sunset|chest/i.test(sentence)));

console.log('minecraft vocab content: PASS');
