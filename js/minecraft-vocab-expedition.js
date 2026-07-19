(function (global) {
    'use strict';

    const STORAGE_PREFIX = 'petbank_minecraft_expedition_state_v2';
    const LEGACY_STORAGE_PREFIX = 'petbank_minecraft_expedition_state_v1';
    const STATUS = Object.freeze({ LOCKED: 'locked', AVAILABLE: 'available', ACTIVE: 'active', CLEARED: 'cleared' });

    function activeProfileId() {
        try {
            const id = global.ProfileManager && typeof global.ProfileManager.getActiveId === 'function'
                ? global.ProfileManager.getActiveId()
                : '';
            return String(id || 'default');
        } catch (error) {
            return 'default';
        }
    }

    function storageKey(profileId = activeProfileId()) {
        return `${STORAGE_PREFIX}_${String(profileId || 'default')}`;
    }

    function legacyStorageKey(profileId = activeProfileId()) {
        return `${LEGACY_STORAGE_PREFIX}_${String(profileId || 'default')}`;
    }

    function safeRegions(regions) {
        return Array.isArray(regions) ? regions.filter(region => region && region.id) : [];
    }

    function canUnlock(region, statuses) {
        return (region.prerequisiteRegionIds || []).every(id => statuses[id] === STATUS.CLEARED);
    }

    function createDefaultState(regions, profileId = activeProfileId()) {
        const statuses = {};
        for (const region of safeRegions(regions)) statuses[region.id] = canUnlock(region, statuses) ? STATUS.AVAILABLE : STATUS.LOCKED;
        return {
            version: 2,
            profileId: String(profileId || 'default'),
            regions: statuses,
            activeRegionId: '',
            clearedMissionIds: [],
            collection: [],
            experience: 0,
            level: 1,
            inventory: [],
            abilities: [],
            defeatedEnemies: [],
            storyComplete: false,
            updatedAt: ''
        };
    }

    function normalizeState(value, regions, profileId) {
        const defaults = createDefaultState(regions, profileId);
        if (!value || typeof value !== 'object' || !value.regions || typeof value.regions !== 'object') return defaults;
        const next = {
            ...defaults,
            ...value,
            version: 2,
            profileId: String(profileId || value.profileId || 'default'),
            regions: { ...defaults.regions },
            clearedMissionIds: Array.isArray(value.clearedMissionIds) ? [...new Set(value.clearedMissionIds.map(String))] : [],
            collection: Array.isArray(value.collection) ? [...new Set(value.collection.map(String))] : [],
            experience: Math.max(0, Number(value.experience || 0)),
            level: Math.max(1, Number(value.level || 1)),
            inventory: Array.isArray(value.inventory) ? [...new Set(value.inventory.map(String))] : [],
            abilities: Array.isArray(value.abilities) ? [...new Set(value.abilities.map(String))] : [],
            defeatedEnemies: Array.isArray(value.defeatedEnemies) ? [...new Set(value.defeatedEnemies.map(String))] : [],
            storyComplete: value.storyComplete === true
        };
        for (const region of safeRegions(regions)) {
            const current = String(value.regions[region.id] || defaults.regions[region.id]);
            next.regions[region.id] = Object.values(STATUS).includes(current) ? current : defaults.regions[region.id];
        }
        return next;
    }

    function readState(regions, profileId = activeProfileId()) {
        const id = String(profileId || 'default');
        try {
            const raw = global.localStorage && (global.localStorage.getItem(storageKey(id)) || global.localStorage.getItem(legacyStorageKey(id)));
            return normalizeState(raw ? JSON.parse(raw) : null, regions, id);
        } catch (error) {
            console.warn('[MinecraftVocabExpedition] failed to read state', error);
            return createDefaultState(regions, id);
        }
    }

    function writeState(state) {
        try {
            global.localStorage.setItem(storageKey(state.profileId), JSON.stringify(state));
            return true;
        } catch (error) {
            console.warn('[MinecraftVocabExpedition] failed to write state', error);
            return false;
        }
    }

    function stateResult(state, overrides = {}) {
        const next = { ...state, ...overrides, updatedAt: new Date().toISOString() };
        return { state: next, persisted: writeState(next) };
    }

    function getRegionState(state, regionId) {
        return String(state?.regions?.[regionId] || STATUS.LOCKED);
    }

    function enterRegion(state, regionId, regions) {
        if (!state || getRegionState(state, regionId) === STATUS.CLEARED) return { state, persisted: true, reason: 'cleared' };
        const region = safeRegions(regions).find(item => item.id === regionId);
        if (!region || getRegionState(state, regionId) === STATUS.LOCKED) return { state, persisted: true, reason: 'locked' };
        return stateResult(state, { activeRegionId: regionId, regions: { ...state.regions, [regionId]: STATUS.ACTIVE } });
    }

    function completeRegion(state, regionId, regions, missionId = '', collectionItem = '', reward = {}) {
        const status = getRegionState(state, regionId);
        if (status === STATUS.CLEARED) return { state, persisted: true, duplicate: true };
        if (status !== STATUS.ACTIVE) return { state, persisted: true, duplicate: false, reason: 'not-active' };
        const nextRegions = { ...state.regions, [regionId]: STATUS.CLEARED };
        for (const region of safeRegions(regions)) {
            if (nextRegions[region.id] === STATUS.LOCKED && canUnlock(region, nextRegions)) nextRegions[region.id] = STATUS.AVAILABLE;
        }
        const nextMissionIds = missionId && !state.clearedMissionIds.includes(missionId)
            ? [...state.clearedMissionIds, missionId]
            : state.clearedMissionIds;
        const nextCollection = collectionItem && !state.collection.includes(collectionItem)
            ? [...state.collection, collectionItem]
            : state.collection;
        const experience = Math.max(0, Number(state.experience || 0) + Number(reward.experience || 0));
        const level = Math.max(1, Math.floor(experience / 20) + 1);
        const inventory = reward.item && !state.inventory.includes(reward.item)
            ? [...state.inventory, String(reward.item)]
            : state.inventory;
        const abilities = reward.item && !state.abilities.includes(reward.item)
            ? [...state.abilities, String(reward.item)]
            : state.abilities;
        const defeatedEnemies = reward.enemy && !state.defeatedEnemies.includes(reward.enemy)
            ? [...state.defeatedEnemies, String(reward.enemy)]
            : state.defeatedEnemies;
        const storyComplete = safeRegions(regions).every(region => nextRegions[region.id] === STATUS.CLEARED);
        const result = stateResult(state, {
            activeRegionId: '',
            regions: nextRegions,
            clearedMissionIds: nextMissionIds,
            collection: nextCollection,
            experience,
            level,
            inventory,
            abilities,
            defeatedEnemies,
            storyComplete
        });
        return { ...result, duplicate: false };
    }

    function getSummary(state) {
        const statuses = Object.values(state?.regions || {});
        return {
            total: statuses.length,
            cleared: statuses.filter(status => status === STATUS.CLEARED).length,
            available: statuses.filter(status => status === STATUS.AVAILABLE).length,
            percent: statuses.length ? Math.round((statuses.filter(status => status === STATUS.CLEARED).length / statuses.length) * 100) : 0,
            experience: Number(state?.experience || 0),
            level: Number(state?.level || 1),
            inventory: Array.isArray(state?.inventory) ? state.inventory : [],
            abilities: Array.isArray(state?.abilities) ? state.abilities : [],
            defeatedEnemies: Array.isArray(state?.defeatedEnemies) ? state.defeatedEnemies : [],
            storyComplete: state?.storyComplete === true
        };
    }

    function calculateBattle(state, battle = {}) {
        const requiredAbility = String(battle.requiredAbility || '');
        const hasAbility = !requiredAbility || (state?.abilities || []).includes(requiredAbility);
        const playerPower = 8 + Number(state?.level || 1) * 6 + (state?.inventory || []).length * 2 + (hasAbility ? 8 : 0);
        const enemyPower = Math.max(1, Number(battle.enemyPower || 1));
        return { won: hasAbility && playerPower >= enemyPower, hasAbility, playerPower, enemyPower, requiredAbility };
    }

    global.MinecraftVocabExpedition = {
        STORAGE_PREFIX,
        STATUS,
        activeProfileId,
        storageKey,
        createDefaultState,
        readState,
        writeState,
        getRegionState,
        enterRegion,
        completeRegion,
        getSummary,
        calculateBattle
    };
})(typeof window !== 'undefined' ? window : globalThis);
