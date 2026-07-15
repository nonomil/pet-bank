import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainPath = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');
const ankiPath = path.join(repoRoot, 'prj', 'anki-minecraft-vocab', 'data', 'cards.json');
const outputDir = path.join(repoRoot, 'assets', 'learn', 'english-vocab', 'minecraft-cards');
const outputRoot = 'assets/learn/english-vocab/minecraft-cards/';

const explicitMediaNames = {
    friend: ['entitysprite_tamed-wolf(119)_processed.png'],
    house: ['envsprite_new-village(84)_processed.png'],
    white: ['White Wool JE2 BE2.png'],
    disk: ['itemsprite_music-disc-13(202)_processed.png'],
    pickaxe: ['itemsprite_diamond-pickaxe(194)_processed.png'],
    chicken: ['Chicken_JE2_BE2.png'],
    compass: ['itemsprite_lodestone-compass(192)_processed.png'],
    air: ['blocksprite_air(553)_processed.png'],
    bell: ['Floor Bell (N) JE4.png'],
    rail: ['blocksprite_powered-rail(184)_processed.png'],
    chain: ['itemsprite_chain-helmet(97)_processed.png'],
    ore: ['Coal Ore JE5 BE4.png'],
    cave: ['300px-Dripstone_Caves.png'],
    hill: ['300px-Windswept_Hills.png']
};

const approximateWords = new Set(['disk']);

const aliases = {
    world: ['world icon', 'overworld'],
    hello: ['villager', 'player'],
    look: ['player head', 'player'],
    run: ['envsprite sprint', 'sprint'],
    door: ['oak door'],
    friend: ['wolf', 'dog', 'player'],
    cat: ['cat spawn egg', 'cat'],
    bag: ['bundle', 'shulker box'],
    tree: ['oak log', 'oak leaves'],
    red: ['red wool'],
    play: ['player'],
    sword: ['diamond sword'],
    pickaxe: ['pickaxe'],
    creeper: ['creeper head', 'creeper spawn egg'],
    craft: ['crafting table'],
    house: ['village', 'house'],
    cow: ['480px cow', 'cow spawn egg'],
    oak: ['oak log'],
    pig: ['480px pig', 'pig spawn egg'],
    blue: ['blue wool'],
    boat: ['oak boat'],
    wood: ['oak wood', 'oak log'],
    wool: ['white wool'],
    birch: ['birch log'],
    black: ['black wool'],
    daisy: ['oxeye daisy'],
    green: ['green wool'],
    sheep: ['480px white sheep', 'sheep spawn egg'],
    tulip: ['red tulip'],
    white: ['white wool'],
    acacia: ['acacia log'],
    flower: ['dandelion'],
    leaves: ['oak leaves'],
    orchid: ['blue orchid'],
    spruce: ['spruce log'],
    yellow: ['yellow wool'],
    chicken: ['chicken'],
    compass: ['compass'],
    sapling: ['oak sapling'],
    mushroom: ['brown mushroom'],
    air: ['air'],
    bell: ['bell'],
    rail: ['rail'],
    chain: ['chain'],
    ore: ['ore'],
    cave: ['cave'],
    disk: ['disk'],
    hill: ['hills']
};

function normalize(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function normalizePhrase(value) {
    return normalize(value).replace(/^480px/, '');
}

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function collectCandidates() {
    const raw = readJson(ankiPath);
    const cards = Array.isArray(raw) ? raw : raw.cards || [];
    const byFile = new Map();
    for (const card of cards) {
        const word = card.content?.word || '';
        for (const media of card.media || []) {
            if (media.kind !== 'image' || media.available !== true || !media.path) continue;
            const sourcePath = path.join(repoRoot, 'prj', 'anki-minecraft-vocab', media.path.replaceAll('/', path.sep));
            if (!fs.existsSync(sourcePath)) continue;
            const key = path.normalize(sourcePath).toLowerCase();
            if (byFile.has(key)) continue;
            byFile.set(key, {
                sourcePath,
                name: media.name || path.basename(sourcePath),
                word,
                wordKey: normalizePhrase(word),
                nameKey: normalizePhrase(path.basename(media.name || sourcePath, path.extname(media.name || sourcePath))),
                extension: path.extname(sourcePath).toLowerCase()
            });
        }
    }
    return [...byFile.values()];
}

function imageFileKey(card) {
    return normalizePhrase(path.basename(String(card.imageFile || ''), path.extname(String(card.imageFile || ''))));
}

function score(card, candidate) {
    const wordKey = normalizePhrase(card.word);
    const sourceKey = imageFileKey(card);
    const preferred = (aliases[wordKey] || []).map(normalizePhrase);
    let points = 0;
    if (candidate.wordKey === wordKey) points += 1200;
    if (sourceKey && candidate.nameKey === sourceKey) points += 1100;
    if (preferred.some(token => candidate.wordKey === token || candidate.nameKey === token)) points += 1000;
    if (candidate.extension === '.gif') points -= 120;
    return points;
}

function explicitCandidate(card, candidates) {
    const names = (explicitMediaNames[normalizePhrase(card.word)] || []).map(normalizePhrase);
    if (!names.length) return null;
    const candidate = candidates.find(item => names.includes(normalizePhrase(item.name)));
    return candidate ? { candidate, points: 2000 } : null;
}

function generatedCandidate(card) {
    if (card.imageSourceQuality !== 'gpt-generated' || !card.image) return null;
    const sourcePath = path.join(repoRoot, card.image.replaceAll('/', path.sep));
    if (!fs.existsSync(sourcePath)) return null;
    return {
        candidate: {
            sourcePath,
            name: card.imageSourceFile || path.basename(sourcePath),
            word: card.word,
            wordKey: normalizePhrase(card.word),
            nameKey: normalizePhrase(path.basename(sourcePath, path.extname(sourcePath))),
            extension: path.extname(sourcePath).toLowerCase(),
            sourceQuality: 'gpt-generated'
        },
        points: 3000
    };
}

function choose(card, candidates, used) {
    const ranked = candidates
        .map(candidate => ({ candidate, points: score(card, candidate) }))
        .filter(item => item.points > 0)
        .sort((a, b) => b.points - a.points || a.candidate.name.localeCompare(b.candidate.name));
    const unused = ranked.find(item => !used.has(item.candidate.sourcePath));
    return unused || ranked[0] || null;
}

function destinationName(card, index, extension) {
    const slug = normalize(card.word).slice(0, 36) || `card-${index + 1}`;
    return `card-${String(index + 1).padStart(3, '0')}-${slug}${extension}`;
}

const apply = process.argv.includes('--apply');
const main = readJson(mainPath);
// The presentation pack is the legacy 96-card visual set; the learning pool
// itself is larger and keeps direct Anki media references in the main module.
const cards = Array.isArray(main.cards) ? main.cards.slice(0, 96) : [];
const candidates = collectCandidates();
const used = new Set();
const mapping = [];
const unresolved = [];

for (const [index, card] of cards.entries()) {
    const selected = generatedCandidate(card) || explicitCandidate(card, candidates) || choose(card, candidates, used);
    if (!selected) {
        unresolved.push(card.word);
        mapping.push({ index, id: card.id, word: card.word, status: 'unresolved', image: card.image || '' });
        continue;
    }
    used.add(selected.candidate.sourcePath);
    const fileName = destinationName(card, index, selected.candidate.extension);
    const sourceQuality = selected.candidate.sourceQuality || (approximateWords.has(normalizePhrase(card.word)) ? 'anki-approximate' : 'anki-matched');
    mapping.push({
        index,
        id: card.id,
        word: card.word,
        status: sourceQuality === 'gpt-generated' ? 'gpt-generated' : 'anki-extracted',
        source: selected.candidate.name,
        sourceKey: selected.candidate.name,
        sourcePath: selected.candidate.sourcePath,
        sourceWord: selected.candidate.word,
        sourceQuality,
        score: selected.points,
        image: `${outputRoot}${fileName}`
    });
    if (apply) {
        fs.mkdirSync(outputDir, { recursive: true });
        const destinationPath = path.join(outputDir, fileName);
        if (path.normalize(selected.candidate.sourcePath).toLowerCase() !== path.normalize(destinationPath).toLowerCase()) {
            fs.copyFileSync(selected.candidate.sourcePath, destinationPath);
        }
        card.image = `${outputRoot}${fileName}`;
        card.imageType = sourceQuality === 'gpt-generated' ? 'gpt-generated' : 'anki-extracted';
        card.imageSource = sourceQuality === 'gpt-generated' ? 'GPT Bee gpt-image-2' : 'prj/anki-minecraft-vocab/assets/media';
        card.imageSourceFile = selected.candidate.name;
        card.imageSourceQuality = sourceQuality;
    }
}

const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    source: 'prj/anki-minecraft-vocab/data/cards.json',
    target: 'data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab.json',
    cardCount: cards.length,
    mappedCount: mapping.filter(item => ['anki-extracted', 'gpt-generated'].includes(item.status)).length,
    unresolved,
    mapping
};

if (apply) {
    fs.writeFileSync(mainPath, `${JSON.stringify(main, null, 2)}\n`, 'utf8');
    fs.writeFileSync(path.join(outputDir, 'manifest.json'), `${JSON.stringify({
        id: 'minecraft-vocab-card-media',
        schemaVersion: 1,
        source: report.source,
        runtimeRoot: outputRoot,
        assets: mapping.filter(item => ['anki-extracted', 'gpt-generated'].includes(item.status)).map(item => ({
            id: item.id,
            word: item.word,
            source: item.source,
            sourceQuality: item.sourceQuality,
            path: item.image
        }))
    }, null, 2)}\n`, 'utf8');
}

console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    cardCount: cards.length,
    candidateCount: candidates.length,
    mappedCount: report.mappedCount,
    unresolved,
    mapping,
    lowConfidence: mapping.filter(item => item.status === 'anki-extracted' && item.score < 1000).map(item => ({ word: item.word, source: item.source, sourceWord: item.sourceWord, score: item.score })),
    sample: mapping.slice(0, 12)
}, null, 2));
