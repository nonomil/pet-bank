(function (global) {
    'use strict';

    const STARTER_PATH = 'data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab-runtime-starter.json';
    const BAND_PATHS = {
        'minecraft-core': 'data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab-runtime-minecraft-core.json',
        'minecraft-basic': 'data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab-runtime-minecraft-basic.json',
        'minecraft-building': 'data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab-runtime-minecraft-building.json',
        'minecraft-mobs': 'data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab-runtime-minecraft-mobs.json',
        'minecraft-world': 'data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab-runtime-minecraft-world.json',
        'minecraft-advanced': 'data/learn/packs/english-mc-hybrid-2026/modules/minecraft-vocab-runtime-minecraft-advanced.json'
    };
    const shardCache = new Map();
    const moduleCache = new Map();

    function fetchJson(path) {
        if (global.PetBankAssetLoader && typeof global.PetBankAssetLoader.fetchJson === 'function') {
            return global.PetBankAssetLoader.fetchJson(path);
        }
        return fetch(path).then((response) => {
            if (!response.ok) throw new Error(`[MinecraftVocabLoader] ${response.status}: ${path}`);
            return response.json();
        });
    }

    function normalizedLevel(levelId) {
        return global.MinecraftVocabLevels?.normalizeLevelId?.(levelId) || 'kindergarten';
    }

    function normalizedBand(bandId) {
        return global.MinecraftVocabLevels?.normalizeBandId?.(bandId) || 'minecraft-core';
    }

    function loadShard(path) {
        if (!shardCache.has(path)) {
            const promise = fetchJson(path).then((data) => {
                if (!data || !Array.isArray(data.cards)) {
                    throw new Error(`[MinecraftVocabLoader] invalid shard: ${path}`);
                }
                return data;
            }).catch((error) => {
                shardCache.delete(path);
                throw error;
            });
            shardCache.set(path, promise);
        }
        return shardCache.get(path);
    }

    function mergeShards(shards, levelId, bandId) {
        const cardsById = new Map();
        for (const shard of shards) {
            for (const card of shard.cards) {
                if (!cardsById.has(card.id)) cardsById.set(card.id, card);
            }
        }
        return {
            id: 'minecraft-vocab',
            type: 'vocab',
            sourceModuleId: 'minecraft-vocab',
            viewId: levelId,
            levelId,
            bandId: bandId || '',
            shards: shards.map((shard) => shard.id),
            cards: [...cardsById.values()]
        };
    }

    async function loadForSelection(levelId = 'kindergarten', bandId = 'minecraft-core') {
        const normalizedLevelId = normalizedLevel(levelId);
        const normalizedBandId = normalizedBand(bandId);
        const cacheKey = `${normalizedLevelId}:${normalizedLevelId === 'minecraft' ? normalizedBandId : ''}`;
        if (moduleCache.has(cacheKey)) return moduleCache.get(cacheKey);

        const paths = [STARTER_PATH];
        if (normalizedLevelId === 'minecraft') paths.push(BAND_PATHS[normalizedBandId]);
        if (normalizedLevelId === 'all') paths.push(...Object.values(BAND_PATHS));
        const shards = await Promise.all(paths.map(loadShard));
        const module = mergeShards(shards, normalizedLevelId, normalizedLevelId === 'minecraft' ? normalizedBandId : '');
        moduleCache.set(cacheKey, module);
        return module;
    }

    global.MinecraftVocabLoader = Object.freeze({
        loadForSelection,
        clearCache() {
            shardCache.clear();
            moduleCache.clear();
        }
    });
})(typeof window !== 'undefined' ? window : globalThis);
