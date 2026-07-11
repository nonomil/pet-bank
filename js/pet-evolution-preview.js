/*
 * PetEvolutionPreview - read-only presentation model for the current and
 * next pet evolution stage. It deliberately does not own pet progression.
 */
(function (root) {
    'use strict';

    function stageImage(species, stage) {
        if (!species || !stage) return null;
        const images = species.imageStages || {};
        return images[String(stage.stageIdx)] || species.imageUrl || null;
    }

    function get(state, options = {}) {
        const s = state || {};
        const stages = Array.isArray(options.stages) && options.stages.length
            ? options.stages
            : (root.PetSystem && root.PetSystem.STAGES) || [];
        const species = options.species || null;
        const level = Math.max(1, Number(s.level) || 1);
        if (!stages.length) {
            return {
                current: { name: '', minLevel: 1, image: stageImage(species, null) },
                next: null,
                isMax: true,
                remainingLevels: 0,
                progressPct: 100
            };
        }
        let currentIndex = 0;
        stages.forEach((stage, index) => {
            if (level >= Number(stage.min_level || 1)) currentIndex = index;
        });
        const currentStage = stages[currentIndex];
        const nextStage = stages[currentIndex + 1] || null;
        const current = {
            name: currentStage.name || '',
            minLevel: Number(currentStage.min_level || 1),
            image: stageImage(species, currentStage)
        };
        if (!nextStage) {
            return { current, next: null, isMax: true, remainingLevels: 0, progressPct: 100 };
        }
        const nextMin = Number(nextStage.min_level || level);
        const span = Math.max(1, nextMin - current.minLevel);
        const progressPct = Math.max(0, Math.min(100, Math.round(((level - current.minLevel) / span) * 100)));
        return {
            current,
            next: {
                name: nextStage.name || '',
                minLevel: nextMin,
                image: stageImage(species, nextStage)
            },
            isMax: false,
            remainingLevels: Math.max(0, nextMin - level),
            progressPct
        };
    }

    root.PetEvolutionPreview = { get };
})(typeof window !== 'undefined' ? window : globalThis);
