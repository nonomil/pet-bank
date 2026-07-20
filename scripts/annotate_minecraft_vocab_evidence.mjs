import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modulePath = path.join(root, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');
const frequencyPath = path.join(root, 'docs', 'minecraft-vocab-evidence', 'raw', 'NGSL_12_stats.csv');
const cefrPath = path.join(root, 'docs', 'minecraft-vocab-evidence', 'raw', 'OXFORD_3000_5000_CEFR.csv');
const sourceSpecs = [
    ['kindergarten', path.join(root, 'data', 'vocab', '单词库_分级', '01_幼儿园', '幼儿园完整词库.js'), 'MERGED_KINDERGARTEN_VOCAB'],
    ['lower-grade', path.join(root, 'data', 'vocab', '单词库_分级', '03_小学_高年级', '小学低年级基础.js'), 'STAGE_ELEMENTARY_LOWER'],
    ['bridge', path.join(root, 'data', 'vocab', '单词库_分级', '04_我的世界', 'minecraft_basic.js'), 'VOCAB_1_MINECRAFT____BASIC']
];
const SOURCE_SNAPSHOT_DATE = '2026-07-20';

function normalizeWord(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[’']/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function normalizeLemma(value) {
    return normalizeWord(value).replace(/ /g, '');
}

function parseCsvLine(line) {
    const cells = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        if (char === '"' && line[index + 1] === '"' && quoted) {
            cell += '"';
            index += 1;
        } else if (char === '"') {
            quoted = !quoted;
        } else if (char === ',' && !quoted) {
            cells.push(cell);
            cell = '';
        } else {
            cell += char;
        }
    }
    cells.push(cell);
    return cells;
}

function readVocabulary(filePath, variableName) {
    const context = {};
    const source = fs.readFileSync(filePath, 'utf8');
    vm.runInNewContext(`${source}\n;globalThis.__vocabResult = ${variableName};`, context, { filename: filePath });
    return Array.isArray(context.__vocabResult) ? context.__vocabResult : [];
}

function readAgeSets() {
    return Object.fromEntries(sourceSpecs.map(([level, filePath, variableName]) => [
        level,
        new Set(readVocabulary(filePath, variableName)
            .map(item => normalizeLemma(item.word || item.standardized))
            .filter(Boolean))
    ]));
}

function readFrequencyMap() {
    if (!fs.existsSync(frequencyPath)) {
        throw new Error(`missing external frequency snapshot: ${frequencyPath}`);
    }
    const raw = fs.readFileSync(frequencyPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'));
    const header = parseCsvLine(lines.shift()).map(value => value.trim());
    const lemmaIndex = header.indexOf('Lemma');
    const rankIndex = header.indexOf('SFI Rank');
    if (lemmaIndex < 0 || rankIndex < 0) throw new Error('NGSL CSV columns not found');
    const map = new Map();
    lines.forEach(line => {
        const cells = parseCsvLine(line);
        const lemma = normalizeLemma(cells[lemmaIndex]);
        const rank = Number(cells[rankIndex]);
        if (lemma && Number.isSafeInteger(rank) && !map.has(lemma)) map.set(lemma, rank);
    });
    return { map, raw };
}

function readCefrMap() {
    if (!fs.existsSync(cefrPath)) throw new Error(`missing Oxford CEFR snapshot: ${cefrPath}`);
    const raw = fs.readFileSync(cefrPath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(line => line.trim() && !line.startsWith('#'));
    const header = parseCsvLine(lines.shift()).map(value => value.trim());
    const wordIndex = header.indexOf('word');
    const cefrIndex = header.indexOf('cefr');
    if (wordIndex < 0 || cefrIndex < 0) throw new Error('Oxford CEFR CSV columns not found');
    const map = new Map();
    lines.forEach(line => {
        const cells = parseCsvLine(line);
        const word = normalizeWord(cells[wordIndex]);
        const cefr = String(cells[cefrIndex] || '').toLowerCase();
        if (word && /^(a1|a2|b1|b2|c1)$/.test(cefr) && !map.has(word)) map.set(word, { cefr });
    });
    return { map, raw };
}

function sha256(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
}

function ageEvidence(level) {
    const stages = {
        kindergarten: {
            band: 'early-years',
            stage: 'pre-a1-starters',
            matchType: 'curriculum-proxy',
            matched: true,
            confidence: 'medium'
        },
        bridge: {
            band: 'early-primary',
            stage: 'a1-movers',
            matchType: 'curriculum-proxy',
            matched: true,
            confidence: 'medium'
        },
        'lower-grade': {
            band: 'lower-primary',
            stage: 'a2-flyers',
            matchType: 'curriculum-proxy',
            matched: true,
            confidence: 'medium'
        }
    };
    const result = stages[level];
    if (result) return { ...result, framework: 'cambridge-yle' };
    return {
        band: 'minecraft-specialized',
        stage: '',
        matchType: 'unvalidated-specialized',
        matched: false,
        confidence: 'low',
        framework: 'cambridge-yle'
    };
}

function frequencyEvidence(word, frequencyMap) {
    const normalized = normalizeWord(word);
    const lemma = normalizeLemma(normalized);
    const minecraftMechanicPhrase = /\b(?:arrow of|fire resistance|night vision|jump boost|instant damage|slow falling|status effect|music disc|spawn egg|horse armor|boat with|minecart with)\b/i.test(normalized);
    const exactRank = frequencyMap.get(lemma);
    if (Number.isSafeInteger(exactRank)) {
        return {
            source: 'ngsl-1.2',
            matched: true,
            matchType: 'lemma',
            rank: exactRank,
            band: exactRank <= 1000 ? 'common' : exactRank <= 2000 ? 'familiar' : 'extended'
        };
    }
    const components = normalized.split(' ').filter(Boolean).map(token => ({
        lemma: normalizeLemma(token),
        rank: frequencyMap.get(normalizeLemma(token)) || null
    }));
    const ranked = components.filter(item => Number.isSafeInteger(item.rank));
    if (ranked.length > 0) {
        const averageRank = Math.round(ranked.reduce((sum, item) => sum + item.rank, 0) / ranked.length);
        return {
            source: 'ngsl-1.2',
            matched: false,
            matchType: 'components',
            componentRanks: components,
            rank: averageRank,
            band: minecraftMechanicPhrase
                ? 'specialized'
                : averageRank <= 1000 ? 'common-components' : averageRank <= 2000 ? 'familiar-components' : 'extended-components'
        };
    }
    return {
        source: 'ngsl-1.2',
        matched: false,
        matchType: 'not-found',
        band: 'specialized'
    };
}

function cefrEvidence(word, cefrMap) {
    const normalized = normalizeWord(word);
    const match = cefrMap.get(normalized);
    if (match) {
        return {
            source: 'oxford-3000-5000',
            matched: true,
            matchType: 'exact-wordlist',
            cefr: match.cefr
        };
    }
    return {
        source: 'oxford-3000-5000',
        matched: false,
        matchType: 'not-found',
        cefr: ''
    };
}

function classificationConfidence(age, frequency, cefr) {
    if (age.band === 'minecraft-specialized') return 'low';
    if (cefr.matched && frequency.matched && age.matchType === 'curriculum-proxy') return 'high';
    if (frequency.matched && age.matchType === 'curriculum-proxy') return 'high';
    return 'medium';
}

function main() {
    const doc = JSON.parse(fs.readFileSync(modulePath, 'utf8'));
    const { map: frequencyMap, raw: frequencyRaw } = readFrequencyMap();
    const { map: cefrMap, raw: cefrRaw } = readCefrMap();
    const ageSets = readAgeSets();
    const counts = {
        total: doc.cards.length,
        frequencyMatched: 0,
        cefrMatched: 0,
        frequencyBands: {},
        ageBands: {},
        confidence: {}
    };
    const cards = doc.cards.map(card => {
        const curriculumLevel = String(card.curriculumLevel || 'minecraft');
        const age = ageEvidence(curriculumLevel);
        const normalized = normalizeLemma(card.word);
        if (curriculumLevel === 'minecraft') {
            age.matched = false;
        } else if (ageSets[curriculumLevel] && !ageSets[curriculumLevel].has(normalized)) {
            age.matchType = 'curriculum-proxy';
            age.matched = false;
            age.confidence = 'low';
        }
        const frequency = frequencyEvidence(card.word, frequencyMap);
        const cefr = cefrEvidence(card.word, cefrMap);
        if (frequency.matched) counts.frequencyMatched += 1;
        if (cefr.matched) counts.cefrMatched += 1;
        counts.frequencyBands[frequency.band] = (counts.frequencyBands[frequency.band] || 0) + 1;
        counts.ageBands[age.band] = (counts.ageBands[age.band] || 0) + 1;
        const confidence = classificationConfidence(age, frequency, cefr);
        counts.confidence[confidence] = (counts.confidence[confidence] || 0) + 1;
        return {
            ...card,
            ageEvidence: age,
            frequencyEvidence: frequency,
            cefrEvidence: cefr,
            classificationConfidence: confidence
        };
    });
    doc.cards = cards;
    doc.curriculumEvidence = {
        version: 2,
        generatedAt: SOURCE_SNAPSHOT_DATE,
        methodology: 'Frequency uses exact NGSL lemma rank when available; Oxford 3000/5000 exact CEFR matches are stored separately; multi-word cards expose component ranks. Age uses the project curriculum list as a proxy anchored to Cambridge YLE stages; Minecraft-specialized cards are explicitly unvalidated by age.',
        sources: {
            frequency: {
                id: 'ngsl-1.2',
                title: 'New General Service List 1.2',
                url: 'https://www.newgeneralservicelist.com/new-general-service-list',
                dataUrl: 'https://www.newgeneralservicelist.com/s/NGSL_12_stats.csv',
                snapshot: 'docs/minecraft-vocab-evidence/raw/NGSL_12_stats.csv',
                sha256: sha256(frequencyRaw),
                retrievedAt: SOURCE_SNAPSHOT_DATE,
                wordCount: frequencyMap.size
            },
            cefr: {
                id: 'oxford-3000-5000',
                title: 'Oxford 3000 and Oxford 5000',
                url: 'https://www.oxfordlearnersdictionaries.com/wordlists/oxford3000-5000',
                snapshot: 'docs/minecraft-vocab-evidence/raw/OXFORD_3000_5000_CEFR.csv',
                sha256: sha256(cefrRaw),
                retrievedAt: SOURCE_SNAPSHOT_DATE,
                wordCount: cefrMap.size,
                exactMatchOnly: true
            },
            age: {
                id: 'cambridge-yle',
                framework: 'cambridge-yle',
                sources: [
                    { id: 'pre-a1-starters', title: 'Pre A1 Starters', url: 'https://www.cambridgeenglish.org/exams-and-tests/starters/' },
                    { id: 'a1-movers', title: 'A1 Movers', url: 'https://www.cambridgeenglish.org/exams-and-tests/movers/' },
                    { id: 'a2-flyers', title: 'A2 Flyers', url: 'https://www.cambridgeenglish.org/exams-and-tests/flyers/' }
                ],
                retrievedAt: SOURCE_SNAPSHOT_DATE,
                perWordListAvailable: false,
                evidenceMode: 'stage-anchor-plus-project-curriculum-proxy',
                externalCefrValidation: 'oxford-3000-5000-exact-match'
            }
        },
        counts
    };
    fs.writeFileSync(modulePath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ output: path.relative(root, modulePath).replace(/\\/g, '/'), counts }, null, 2));
}

main();
