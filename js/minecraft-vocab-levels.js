(function (global) {
    'use strict';

    const LEVELS = [
        { id: 'kindergarten', label: '幼儿园', labelEn: 'Kindergarten', description: '先学看得见、说得出的身边词。', rank: 1 },
        { id: 'bridge', label: '幼小衔接', labelEn: 'Bridge', description: '加入更多 Minecraft 基础动作和物品。', rank: 2 },
        { id: 'lower-grade', label: '小学低年级', labelEn: 'Lower Grade', description: '适合开始读短句、认识更多游戏词。', rank: 3 },
        { id: 'minecraft', label: 'Minecraft 初级', labelEn: 'Minecraft Starter', description: '打开更完整的 Minecraft 常用词。', rank: 4 },
        { id: 'all', label: '完整词库', labelEn: 'Full Library', description: '包含 Anki 和参考词库中的全部词条。', rank: 5 }
    ];
    const LEVEL_BY_ID = new Map(LEVELS.map(level => [level.id, level]));
    const DEFAULT_LEVEL_ID = 'kindergarten';
    const MINECRAFT_BANDS = [
        { id: 'minecraft-core', label: '常用核心', labelEn: 'Core Words', description: '先学最常见的方块、动作、动物和生存词。', rank: 1 },
        { id: 'minecraft-basic', label: '常见基础', labelEn: 'Everyday Basics', description: '加入日常物品、资源和简单游戏操作。', rank: 2 },
        { id: 'minecraft-building', label: '建造与工具', labelEn: 'Building & Tools', description: '学习搭建房屋、采集和制作工具的词。', rank: 3 },
        { id: 'minecraft-mobs', label: '生物与战斗', labelEn: 'Mobs & Combat', description: '认识动物、生物、装备和战斗场景。', rank: 4 },
        { id: 'minecraft-world', label: '世界与环境', labelEn: 'World & Nature', description: '探索群系、结构、植物和不同地形。', rank: 5 },
        { id: 'minecraft-advanced', label: '机制与进阶', labelEn: 'Advanced Mechanics', description: '最后挑战效果、进度和复杂变体词。', rank: 6 }
    ];
    const MINECRAFT_BAND_BY_ID = new Map(MINECRAFT_BANDS.map(band => [band.id, band]));
    const DEFAULT_MINECRAFT_BAND_ID = 'minecraft-core';

    function normalizeLevelId(value) {
        const id = String(value || '').trim().toLowerCase();
        return LEVEL_BY_ID.has(id) ? id : DEFAULT_LEVEL_ID;
    }

    function normalizeBandId(value) {
        const id = String(value || '').trim().toLowerCase();
        return MINECRAFT_BAND_BY_ID.has(id) ? id : DEFAULT_MINECRAFT_BAND_ID;
    }

    function cardLevel(card) {
        const explicit = String(card?.curriculumLevel || '').trim().toLowerCase();
        if (LEVEL_BY_ID.has(explicit)) return explicit;
        const tags = Array.isArray(card?.tags) ? card.tags.map(tag => String(tag).toLowerCase()) : [];
        const rawLevel = String(card?.level || '').toLowerCase();
        if (rawLevel === 'starter' || tags.includes('starter') || tags.includes('kindergarten')) return 'kindergarten';
        if (rawLevel === 'core' || tags.includes('core') || tags.includes('bridge')) return 'bridge';
        if (rawLevel === 'ket-1' || tags.includes('lower-grade') || tags.includes('elementary_lower')) return 'lower-grade';
        if (rawLevel === 'advanced' || Number(card?.difficulty) >= 3) return 'all';
        if (rawLevel === 'anki-official' || card?.sourceProvider === 'anki-apkg') return 'minecraft';
        return 'minecraft';
    }

    function filterCards(cards, levelId = DEFAULT_LEVEL_ID, bandId = '') {
        const selected = LEVEL_BY_ID.get(normalizeLevelId(levelId));
        const source = Array.isArray(cards) ? cards.filter(card => card && card.id) : [];
        if (!selected || selected.id === 'all') return source;
        const curriculumCards = source.filter(card => (LEVEL_BY_ID.get(cardLevel(card))?.rank || LEVELS[3].rank) <= selected.rank);
        if (selected.id === 'minecraft' && bandId) {
            const band = normalizeBandId(bandId);
            return curriculumCards.filter(card => cardLevel(card) === 'minecraft' && String(card.minecraftBand || '') === band);
        }
        return curriculumCards;
    }

    function get(levelId) {
        return LEVEL_BY_ID.get(normalizeLevelId(levelId));
    }

    global.MinecraftVocabLevels = {
        DEFAULT_LEVEL_ID,
        LEVELS,
        MINECRAFT_BANDS,
        DEFAULT_MINECRAFT_BAND_ID,
        list: () => LEVELS.slice(),
        minecraftBands: () => MINECRAFT_BANDS.slice(),
        getBand: bandId => MINECRAFT_BAND_BY_ID.get(normalizeBandId(bandId)),
        get,
        normalizeLevelId,
        normalizeBandId,
        cardLevel,
        filterCards
    };
})(typeof window !== 'undefined' ? window : globalThis);
