import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditDocument } from './audit_minecraft_vocab_quality.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');
const document = JSON.parse(fs.readFileSync(file, 'utf8'));
const report = auditDocument(document, root);

assert.equal(report.totals.cards, 2168);
assert.equal(report.totals.missingImage, 0);
assert.equal(report.totals.missingAudio, 0);
assert.equal(report.totals.missingNarration, 0);
assert.equal(report.totals.duplicateWords, 0);
assert.equal(report.totals.duplicateSentences, 0);
assert.equal(report.totals.contentErrors, 0);
assert.equal(report.levels.kindergarten, 87);
assert.equal(report.levels.bridge, 39);
assert.ok(report.sentenceTemplates.length >= 5);
assert.ok(report.sentenceTemplates[0].count >= report.sentenceTemplates.at(-1).count);
assert.ok(report.sentenceTemplates[0].count <= 60, 'sentence template reuse must stay within the child-friendly variety threshold');

console.log('minecraft vocab quality audit: PASS');
