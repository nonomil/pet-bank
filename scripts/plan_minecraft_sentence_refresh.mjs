import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { enrichCard } from './enrich_minecraft_vocab.cjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inputPath = path.join(root, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');
const manifestPath = path.join(root, 'data', 'vocab', 'english-minecraft', 'narration-manifest.json');
const defaultOutputPath = path.join(root, 'tmp', 'minecraft-sentence-refresh-plan.json');

function clean(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function cardAudio(card, key) {
    return clean(card?.narrationAudio?.[key]);
}

export function buildPlan(document, manifest = {}, limit = 0) {
    const cards = Array.isArray(document?.cards) ? document.cards : [];
    const manifestEntries = new Map((manifest?.entries || []).map((entry) => [clean(entry.cardId), entry]));
    const changes = [];
    for (const [index, card] of cards.entries()) {
        const next = enrichCard(card, { refreshGenerated: true });
        const cardId = clean(card.id) || `card-${String(index + 1).padStart(4, '0')}`;
        const previous = manifestEntries.get(cardId);
        const previousTexts = previous?.texts || {};
        const sentenceChanged = clean(previousTexts.sentence) !== clean(next.sentence);
        const translationChanged = clean(previousTexts.sentenceTranslation) !== clean(next.sentenceTranslation);
        if (!sentenceChanged && !translationChanged) continue;
        changes.push({
            index,
            cardId,
            word: clean(card.word),
            category: clean(next.category),
            oldSentence: clean(previousTexts.sentence || card.sentence || card.example),
            newSentence: clean(next.sentence),
            oldSentenceTranslation: clean(previousTexts.sentenceTranslation || card.sentenceTranslation || card.exampleTranslation || card.exampleZh),
            newSentenceTranslation: clean(next.sentenceTranslation),
            sentenceAudio: clean(previous?.files?.sentence || cardAudio(card, 'sentence')),
            sentenceTranslationAudio: clean(previous?.files?.sentenceTranslation || cardAudio(card, 'sentenceTranslation')),
            fieldsToRefresh: [
                ...(sentenceChanged ? ['sentence'] : []),
                ...(translationChanged ? ['sentenceTranslation'] : [])
            ]
        });
    }
    const selected = limit > 0 ? changes.slice(0, limit) : changes;
    return {
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        source: path.relative(root, inputPath).replaceAll('\\', '/'),
        totalCards: cards.length,
        changedCards: changes.length,
        selectedCards: selected.length,
        sentenceClipsToRefresh: selected.filter((entry) => entry.fieldsToRefresh.includes('sentence')).length,
        sentenceTranslationClipsToRefresh: selected.filter((entry) => entry.fieldsToRefresh.includes('sentenceTranslation')).length,
        changes: selected
    };
}

function parseLimit(argv) {
    const index = argv.indexOf('--limit');
    if (index === -1) return 0;
    const value = Number(argv[index + 1]);
    if (!Number.isInteger(value) || value < 0) throw new Error('--limit must be a non-negative integer');
    return value;
}

function main() {
    const limit = parseLimit(process.argv.slice(2));
    const outputIndex = process.argv.indexOf('--output');
    const outputPath = outputIndex === -1 ? defaultOutputPath : path.resolve(process.argv[outputIndex + 1]);
    const document = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
    const plan = buildPlan(document, manifest, limit);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ output: path.relative(root, outputPath).replaceAll('\\', '/'), ...plan }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
