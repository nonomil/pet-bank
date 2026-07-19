import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const sourceModulePath = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules', 'minecraft-vocab.json');
const expeditionPath = path.join(repoRoot, 'data', 'learn', 'minecraft-expedition', 'camp-regions.json');
const sourceDir = path.join(repoRoot, 'assets', 'learn', 'english-vocab', 'minecraft-narration');
const outputDir = path.resolve(repoRoot, process.argv[2] || 'tmp/minecraft-audio-artifact');
const releaseId = String(process.argv[3] || '').trim() || 'v20260719';

function toPosix(value) { return value.split(path.sep).join('/'); }
function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function sourceRelativePath(value) {
    const relative = String(value || '').replace(/\\/g, '/');
    const prefix = 'assets/learn/english-vocab/minecraft-narration/';
    if (!relative.startsWith(prefix) || !relative.endsWith('.mp3')) throw new Error(`Unsupported Minecraft narration path: ${relative}`);
    return relative.slice(prefix.length);
}

function collectEntries(module) {
    const entries = new Map();
    for (const card of module.cards || []) {
        for (const [key, value] of Object.entries(card.narrationAudio || {})) {
            const source = String(value || '').trim();
            if (!source) continue;
            if (!source.startsWith('assets/learn/english-vocab/minecraft-narration/')) continue;
            const relative = sourceRelativePath(source);
            const outputPath = `audio/${relative.replace(/\.mp3$/i, '.ogg')}`;
            const existing = entries.get(source);
            if (existing && existing.path !== outputPath) throw new Error(`Conflicting output path for ${source}`);
            entries.set(source, {
                source,
                path: outputPath,
                cards: [...(existing?.cards || []), { cardId: card.id, key }]
            });
        }
    }
    return [...entries.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function copyEntries(entries) {
    for (const entry of entries) {
        const relative = entry.path.slice('audio/'.length);
        const source = path.join(sourceDir, relative);
        const output = path.join(outputDir, entry.path);
        if (!fs.existsSync(source)) throw new Error(`Missing Opus source variant: ${toPosix(path.relative(repoRoot, source))}`);
        const stat = fs.statSync(source);
        if (stat.size < 256) throw new Error(`Audio variant is too small: ${entry.path}`);
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.copyFileSync(source, output);
        entry.bytes = stat.size;
    }
}

const sourceModule = JSON.parse(fs.readFileSync(sourceModulePath, 'utf8'));
const expedition = JSON.parse(fs.readFileSync(expeditionPath, 'utf8'));
const expeditionCardIds = new Set((expedition.regions || []).flatMap((region) => region.mission?.cardIds || []));
const entries = collectEntries(sourceModule);
if (entries.length === 0) throw new Error('Minecraft narration manifest is empty');
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
copyEntries(entries);

const indexGroups = [
    {
        id: 'starter',
        cards: (sourceModule.cards || []).filter((card) => card.curriculumLevel !== 'minecraft' || expeditionCardIds.has(card.id))
    },
    ...['minecraft-core', 'minecraft-basic', 'minecraft-building', 'minecraft-mobs', 'minecraft-world', 'minecraft-advanced']
        .map((bandId) => ({ id: bandId, cards: (sourceModule.cards || []).filter((card) => card.minecraftBand === bandId) }))
];
const indexes = {};
for (const group of indexGroups) {
    const cardIds = new Set(group.cards.map((card) => card.id));
    const groupEntries = entries.filter((entry) => entry.cards.some((card) => cardIds.has(card.cardId)));
    const indexPath = `indexes/${group.id}.json`;
    writeJson(path.join(outputDir, indexPath), {
        version: 1,
        id: `minecraft-vocab-audio-${group.id}`,
        releaseId,
        groupId: group.id,
        cardCount: cardIds.size,
        clipCount: groupEntries.length,
        files: groupEntries.map(({ source, path: filePath, bytes }) => ({ source, path: filePath, bytes }))
    });
    indexes[group.id] = { path: indexPath, cardCount: cardIds.size, clipCount: groupEntries.length };
}

writeJson(path.join(outputDir, 'manifest.json'), {
    version: 1,
    id: 'minecraft-vocab-audio',
    releaseId,
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: sourceModule.generatedAt || '',
    format: 'OGG',
    subtype: 'OPUS',
    sourceRoot: 'assets/learn/english-vocab/minecraft-narration',
    indexMode: 'selection',
    basePath: 'audio/',
    cardCount: (sourceModule.cards || []).length,
    clipCount: entries.length,
    indexes
});
console.log(`[minecraft-audio-artifact] release=${releaseId} cards=${sourceModule.cards.length} clips=${entries.length} output=${outputDir}`);
