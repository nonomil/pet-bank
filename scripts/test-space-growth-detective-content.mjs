import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = path.join(root, 'data', 'story-packs', '03-space-growth-detective');
const manifest = JSON.parse(fs.readFileSync(path.join(pack, 'manifest.json'), 'utf8'));
const allowedSources = new Set(['pet.hunger', 'pet.hp', 'pet.happiness', 'pet.cleanliness', 'pet.intimacy', 'pet.level', 'pet.stage']);
const allowedActions = new Set(['feed', 'play', 'rest', 'bath']);

assert.equal(manifest.id, 'space-growth-detective');
assert.equal(manifest.active, true, 'integrated story pack is active');
assert.deepEqual(manifest.caseIds, ['energy-stardust', 'cloud-code', 'star-dust-footprints', 'companion-link', 'home-star-map']);

for (const caseId of manifest.caseIds) {
  const story = JSON.parse(fs.readFileSync(path.join(pack, 'cases', `${caseId}.json`), 'utf8'));
  assert.equal(story.id, caseId, `${caseId}: id mismatch`);
  assert.ok(typeof story.title === 'string' && story.title.length >= 3 && story.title.length <= 12, `${caseId}: child title`);
  assert.ok(typeof story.message?.text === 'string' && story.message.text.length >= 8 && story.message.text.length <= 70, `${caseId}: message length`);
  assert.ok(allowedSources.has(story.clue?.source), `${caseId}: clue source must be whitelisted`);
  assert.ok(Array.isArray(story.clue?.presentation?.bands) && story.clue.presentation.bands.length >= 2, `${caseId}: clue bands`);
  assert.ok(Array.isArray(story.question?.answers) && story.question.answers.length >= 2 && story.question.answers.length <= 3, `${caseId}: choices`);
  assert.equal(story.question.answers.filter((answer) => answer.isCorrect === true).length, 1, `${caseId}: exactly one answer`);
  assert.ok(typeof story.reply?.careAction === 'string' && story.reply.careAction.length >= 6, `${caseId}: care reply`);
  assert.ok(typeof story.reply?.fallback === 'string' && story.reply.fallback.length >= 6, `${caseId}: fallback reply`);
  if (story.careAction) {
    assert.ok(allowedActions.has(story.careAction.id), `${caseId}: care action id`);
    assert.equal(story.careAction.invoke, story.careAction.id, `${caseId}: care action invoke`);
  }
}

console.log(`PASS space growth detective content: ${manifest.caseIds.length} cases`);
