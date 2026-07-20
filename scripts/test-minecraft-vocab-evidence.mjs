import assert from 'node:assert/strict';
import fs from 'node:fs';

const modulePath = new URL('../data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json', import.meta.url);
const doc = JSON.parse(fs.readFileSync(modulePath, 'utf8'));
assert.ok(doc.curriculumEvidence, 'vocabulary module should contain external evidence metadata');
assert.equal(doc.curriculumEvidence.version, 2);
assert.equal(doc.curriculumEvidence.sources.frequency.id, 'ngsl-1.2');
assert.equal(doc.curriculumEvidence.sources.cefr.id, 'oxford-3000-5000');
assert.equal(doc.curriculumEvidence.sources.cefr.exactMatchOnly, true);
assert.equal(doc.curriculumEvidence.sources.age.framework, 'cambridge-yle');
assert.ok(doc.curriculumEvidence.generatedAt);

const block = doc.cards.find(card => card.word.toLowerCase() === 'block');
assert.ok(block);
assert.equal(block.frequencyEvidence.matched, true);
assert.equal(block.frequencyEvidence.source, 'ngsl-1.2');
assert.ok(Number.isSafeInteger(block.frequencyEvidence.rank));
assert.equal(block.cefrEvidence.matched, true);
assert.equal(block.cefrEvidence.source, 'oxford-3000-5000');
assert.match(block.cefrEvidence.cefr, /^(a1|a2|b1|b2|c1)$/);
assert.equal(block.ageEvidence.band, 'early-years');
assert.equal(block.ageEvidence.matchType, 'curriculum-proxy');

const specialized = doc.cards.find(card => /arrow of fire resistance/i.test(card.word));
assert.ok(specialized, 'specialized Minecraft card should remain in the source pool');
assert.equal(specialized.ageEvidence.matched, false);
assert.equal(specialized.ageEvidence.band, 'minecraft-specialized');
assert.equal(specialized.frequencyEvidence.band, 'specialized');
assert.equal(specialized.classificationConfidence, 'low');

assert.ok(doc.curriculumEvidence.counts.frequencyMatched > 0);
assert.ok(doc.curriculumEvidence.counts.cefrMatched > 0);
assert.ok(doc.cards.every(card => card.cefrEvidence && card.cefrEvidence.source === 'oxford-3000-5000'));
assert.equal(
    doc.curriculumEvidence.counts.total,
    doc.cards.length,
    'evidence counts should account for every card'
);

console.log('minecraft vocab evidence: PASS');
