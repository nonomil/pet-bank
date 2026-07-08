import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packRoot = path.join(repoRoot, 'data/learn/packs/english-mc-hybrid-2026');
const snapshotPath = path.join(repoRoot, 'data/learn/external/mayihaoke/resources.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const manifest = readJson(path.join(packRoot, 'manifest.json'));
const story = readJson(path.join(packRoot, 'modules/mcbook56-story.json'));
const vocabPath = path.join(packRoot, 'modules/minecraft-vocab.json');
assert.ok(fs.existsSync(vocabPath), 'minecraft-vocab module file should exist');
const vocab = readJson(vocabPath);
const snapshot = readJson(snapshotPath);

assert.equal(manifest.packType, 'hybrid');
assert.equal(manifest.sourceAdapter, 'mayihaoke-reader');
assert.equal(manifest.moduleCount, manifest.modules.length, 'moduleCount should match manifest modules length');
assert.ok(
  manifest.modules.some(module => module.id === 'minecraft-vocab'),
  'manifest should expose minecraft-vocab module'
);

const quizLessons = story.lessons.filter(lesson => lesson.quiz);
assert.ok(quizLessons.length >= 3, 'first three story lessons should include quiz data');

for (const lesson of story.lessons.slice(0, 3)) {
  assert.ok(lesson.quiz, `${lesson.id} should define quiz`);
  assert.ok(Number(lesson.quiz.passScore) >= 1, `${lesson.id} should define passScore`);
  assert.ok(
    Array.isArray(lesson.quiz.questions) && lesson.quiz.questions.length >= 3,
    `${lesson.id} should define at least 3 questions`
  );
  for (const question of lesson.quiz.questions) {
    assert.ok(question.id && question.type && question.prompt, 'question should include id/type/prompt');
    assert.ok(Array.isArray(question.choices) && question.choices.length >= 3, `${question.id} should include choices`);
    assert.ok(question.choices.includes(question.answer), `${question.id} answer should be one of choices`);
    assert.ok(question.explain, `${question.id} should include explanation`);
  }
}

assert.equal(vocab.id, 'minecraft-vocab');
assert.equal(vocab.type, 'vocab');
assert.equal(vocab.sourceProvider, 'mixed');
assert.deepEqual(
  vocab.sourceProviders,
  ['mayihaoke', 'minecraft_words_apk-main'],
  'formal vocab should declare both starter and external providers'
);
assert.equal(vocab.sourceSnapshot, 'data/learn/external/mayihaoke/resources.json');
assert.ok(Array.isArray(vocab.cards) && vocab.cards.length >= 80, 'minecraft-vocab should expand to at least 80 cards');

const snapshotWords = new Set((snapshot.candidateWords || []).map(item => item.word));
for (const card of vocab.cards) {
  assert.ok(card.id && card.word && card.translation, 'card should include id/word/translation');
  assert.ok(card.example && card.exampleZh, `${card.id} should include bilingual example`);
  assert.ok(Number(card.difficulty) >= 1, `${card.id} should include difficulty`);
  assert.ok(Array.isArray(card.distractors) && card.distractors.length >= 3, `${card.id} should include distractors`);
  if (card.sourceProvider === 'mayihaoke') {
    assert.ok(snapshotWords.has(card.word), `${card.word} starter card should still come from the crawled snapshot candidate list`);
    assert.ok(card.sourceRoute || card.sourceChunk, `${card.id} starter card should keep source reference`);
  } else {
    assert.equal(card.sourceProvider, 'minecraft_words_apk-main', `${card.id} should use one of the approved providers`);
    assert.ok(card.sourceFile, `${card.id} external card should keep sourceFile`);
    assert.ok(card.category, `${card.id} external card should keep category`);
  }
}

console.log('PASS - english quiz and vocab data contract');
