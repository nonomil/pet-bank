import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAIN_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');
const BAD_TRANSLATION = /箭关|组组|原模|哈基米|薯仔|^携带|一个有用的|一只友好的/i;

function clean(value) {
    return String(value ?? '').trim();
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function existingAsset(root, value) {
    return Boolean(clean(value)) && fs.existsSync(path.resolve(root, clean(value)));
}

function countBy(cards, field) {
    return cards.reduce((result, card) => {
        const key = clean(card?.[field]) || '';
        result[key] = (result[key] || 0) + 1;
        return result;
    }, {});
}

function duplicateCount(values) {
    const counts = new Map();
    for (const value of values) {
        const key = clean(value).toLocaleLowerCase();
        if (key) counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.values()].filter(count => count > 1).length;
}

function sentenceTemplate(card) {
    const sentence = clean(card?.sentence || card?.example);
    const word = clean(card?.word);
    if (!sentence || !word) return '';
    return sentence.replace(new RegExp(`\\b${escapeRegExp(word)}\\b`, 'ig'), '__WORD__').toLocaleLowerCase();
}

export function auditDocument(document, root) {
    const cards = Array.isArray(document) ? document : Array.isArray(document?.cards) ? document.cards : [];
    const contentErrors = [];
    let missingImage = 0;
    let missingAudio = 0;
    let missingNarration = 0;
    const sentenceTemplates = new Map();

    cards.forEach((card, index) => {
        const label = `${index}:${clean(card?.word) || card?.id || 'unknown'}`;
        const required = [
            ['word', card?.word],
            ['translation', card?.translation ?? card?.chinese],
            ['phrase', card?.phrase],
            ['phraseTranslation', card?.phraseTranslation],
            ['sentence', card?.sentence ?? card?.example],
            ['sentenceTranslation', card?.sentenceTranslation ?? card?.exampleTranslation ?? card?.exampleZh]
        ];
        for (const [field, value] of required) {
            if (!clean(value) || /[\u0000-\u001f]/.test(String(value))) contentErrors.push({ type: 'missing-or-control-text', field, card: label });
        }
        const translatedText = [card?.translation ?? card?.chinese, card?.phraseTranslation, card?.sentenceTranslation ?? card?.exampleTranslation ?? card?.exampleZh].map(clean).join(' ');
        if (BAD_TRANSLATION.test(translatedText) || /^carry\s/i.test(clean(card?.phrase))) contentErrors.push({ type: 'suspect-content', card: label });
        if (!existingAsset(root, card?.image)) missingImage += 1;
        if (!existingAsset(root, card?.audio)) missingAudio += 1;
        if (!existingAsset(root, card?.narrationAudio?.sentence)) missingNarration += 1;
        const template = sentenceTemplate(card);
        if (template) sentenceTemplates.set(template, (sentenceTemplates.get(template) || 0) + 1);
    });

    const sentenceTemplatesList = [...sentenceTemplates.entries()]
        .map(([template, count]) => ({ template, count }))
        .sort((a, b) => b.count - a.count || a.template.localeCompare(b.template))
        .slice(0, 50);

    return {
        generatedAt: new Date().toISOString(),
        source: path.relative(root, MAIN_PATH).replace(/\\/g, '/'),
        totals: {
            cards: cards.length,
            missingImage,
            missingAudio,
            missingNarration,
            duplicateWords: duplicateCount(cards.map(card => card?.word)),
            duplicateSentences: duplicateCount(cards.map(card => card?.sentence || card?.example)),
            contentErrors: contentErrors.length
        },
        levels: countBy(cards, 'curriculumLevel'),
        bands: countBy(cards, 'minecraftBand'),
        contentErrors: contentErrors.slice(0, 200),
        sentenceTemplates: sentenceTemplatesList
    };
}

function main() {
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const input = process.argv[2] ? path.resolve(process.argv[2]) : MAIN_PATH;
    const output = process.argv[3] ? path.resolve(process.argv[3]) : path.join(root, 'tmp', 'minecraft-vocab-quality-report.json');
    const document = JSON.parse(fs.readFileSync(input, 'utf8'));
    const report = auditDocument(document, root);
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ output: path.relative(root, output).replace(/\\/g, '/'), totals: report.totals, topSentenceTemplates: report.sentenceTemplates.slice(0, 5) }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
