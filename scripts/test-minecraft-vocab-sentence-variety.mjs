import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditDocument } from './audit_minecraft_vocab_quality.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');
const document = JSON.parse(fs.readFileSync(file, 'utf8'));
const report = auditDocument(document, root);

assert.ok(report.totals.cards >= 2000, 'the active Minecraft pool should contain the complete imported set');
assert.ok(report.sentenceTemplates.length >= 12, 'the pool should expose many distinct sentence patterns');
assert.ok(
    report.sentenceTemplates[0].count <= 60,
    `no sentence template should be reused more than 60 times (got ${report.sentenceTemplates[0].count})`
);

const cards = document.cards || [];
const byWord = new Map(cards.map((card) => [String(card.word || '').toLowerCase(), card]));
assert.match(byWord.get('sun')?.sentence || '', /sun|daylight/i, 'sun should be used as a scene source, not as an inventory item');
assert.doesNotMatch(byWord.get('red')?.sentenceTranslation || '', /红色色/);
assert.doesNotMatch(byWord.get('arrow of fire resistance')?.sentenceTranslation || '', /箭关/);

console.log(`minecraft vocab sentence variety: PASS (max template reuse ${report.sentenceTemplates[0].count})`);
