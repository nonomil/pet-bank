const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const moduleDir = path.join(repoRoot, 'data', 'learn', 'packs', 'english-mc-hybrid-2026', 'modules');
const fullPath = path.join(moduleDir, 'minecraft-vocab.json');
const expeditionPath = path.join(repoRoot, 'data', 'learn', 'minecraft-expedition', 'camp-regions.json');
const fullModule = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
const expedition = JSON.parse(fs.readFileSync(expeditionPath, 'utf8'));

const bands = [
    'minecraft-core',
    'minecraft-basic',
    'minecraft-building',
    'minecraft-mobs',
    'minecraft-world',
    'minecraft-advanced'
];

const expeditionCardIds = new Set(
    expedition.regions.flatMap((region) => region.mission?.cardIds || [])
);
const seenStarterIds = new Set();
const starterCards = [];

for (const card of fullModule.cards || []) {
    const isLowLevel = card.curriculumLevel !== 'minecraft';
    const isExpeditionSeed = expeditionCardIds.has(card.id);
    if (!isLowLevel && !isExpeditionSeed) continue;
    if (seenStarterIds.has(card.id)) continue;
    seenStarterIds.add(card.id);
    starterCards.push(isExpeditionSeed && card.curriculumLevel === 'minecraft'
        ? { ...card, expeditionSeed: true }
        : card);
}

function sanitizeRuntimeCard(card, { includeNarration = true } = {}) {
    const runtimeCard = { ...card };
    if (!includeNarration && runtimeCard.narrationAudio && typeof runtimeCard.narrationAudio === 'object') {
        runtimeCard.externalNarrationAudio = { ...runtimeCard.narrationAudio };
        for (const [key, value] of Object.entries(runtimeCard.externalNarrationAudio)) {
            if (String(value || '').startsWith('prj/')) runtimeCard.externalNarrationAudio[key] = '';
        }
    }
    for (const field of ['image', 'backImage', 'audio']) {
        if (String(runtimeCard[field] || '').startsWith('prj/')) runtimeCard[field] = '';
        if (!includeNarration && String(runtimeCard[field] || '').startsWith('assets/learn/english-vocab/minecraft-narration/')) {
            runtimeCard[field] = '';
        }
    }
    if (runtimeCard.narrationAudio && typeof runtimeCard.narrationAudio === 'object') {
        runtimeCard.narrationAudio = { ...runtimeCard.narrationAudio };
        for (const [key, value] of Object.entries(runtimeCard.narrationAudio)) {
            if (String(value || '').startsWith('prj/') || !includeNarration) runtimeCard.narrationAudio[key] = '';
        }
    }
    return runtimeCard;
}

const runtimeStarterCards = starterCards.map(sanitizeRuntimeCard);

function writeModule(fileName, module) {
    fs.writeFileSync(path.join(moduleDir, fileName), `${JSON.stringify(module, null, 2)}\n`);
}

const common = {
    version: 1,
    sourceModuleId: fullModule.id,
    sourceProvider: fullModule.sourceProvider,
    generatedAt: fullModule.generatedAt || '2026-07-19'
};

writeModule('minecraft-vocab-runtime-starter.json', {
    ...common,
    id: 'minecraft-vocab-runtime-starter',
    type: 'vocab-runtime-shard',
    viewId: 'starter-runtime',
    title: 'Minecraft 单词远征起步分片',
    description: '首次进入远征时加载的低龄词卡和节点必需词卡。',
    cards: runtimeStarterCards
});

for (const bandId of bands) {
    writeModule(`minecraft-vocab-runtime-${bandId}.json`, {
        ...common,
        id: `minecraft-vocab-runtime-${bandId}`,
        type: 'vocab-runtime-shard',
        viewId: bandId,
        title: `Minecraft 单词远征 ${bandId}`,
        description: `按需加载的 ${bandId} 词卡分片。`,
        bandId,
        cards: (fullModule.cards || []).filter((card) =>
            card.curriculumLevel === 'minecraft' && card.minecraftBand === bandId
        ).map((card) => sanitizeRuntimeCard(card, { includeNarration: false }))
    });
}

console.log(`Minecraft runtime shards: starter=${starterCards.length}, bands=${bands.map((bandId) => `${bandId}:${(fullModule.cards || []).filter((card) => card.minecraftBand === bandId).length}`).join(', ')}`);
