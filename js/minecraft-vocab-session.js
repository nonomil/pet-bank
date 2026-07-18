 (function (global) {
    'use strict';

    const STORAGE_PREFIX = 'petbank_minecraft_vocab_session_v1';
    const REWARD_SOURCE = 'minecraft-vocab';
    const REWARD_POINTS = 10;
    const STAGE_MODES = ['review', 'review', 'new', 'new', 'new', 'new', 'new', 'recall', 'recall', 'recall', 'scene'];
    const QUEUE_SIZE = STAGE_MODES.length;

    function activeProfileId() {
        try {
            const id = global.ProfileManager && typeof global.ProfileManager.getActiveId === 'function'
                ? global.ProfileManager.getActiveId()
                : '';
            return String(id || 'default');
        } catch (error) { return 'default'; }
    }

    function localDate(input) {
        const supplied = String(input || '').trim();
        if (supplied) return supplied;
        if (global.PetBankTime && typeof global.PetBankTime.localDate === 'function') return global.PetBankTime.localDate();
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    function storageKey(profileId) { return `${STORAGE_PREFIX}_${String(profileId || activeProfileId())}`; }

    function readState(profileId = activeProfileId()) {
        try {
            const raw = global.localStorage && global.localStorage.getItem(storageKey(profileId));
            const parsed = raw ? JSON.parse(raw) : null;
            return parsed && typeof parsed === 'object' && Array.isArray(parsed.queue) && Array.isArray(parsed.completed) ? parsed : null;
        } catch (error) { console.warn('[MinecraftVocabSession] failed to read session', error); return null; }
    }

    function writeState(state) {
        try { global.localStorage.setItem(storageKey(state.profileId), JSON.stringify(state)); return true; }
        catch (error) { console.warn('[MinecraftVocabSession] failed to write session', error); return false; }
    }

    function cardStatus(readProgress, card) {
        try {
            const progress = typeof readProgress === 'function' ? readProgress(card) : readProgress?.(card.id);
            return progress && typeof progress === 'object' ? String(progress.status || 'new') : 'new';
        } catch (error) { return 'new'; }
    }

    function hash(value) {
        let result = 2166136261;
        for (const character of String(value)) {
            result ^= character.charCodeAt(0);
            result = Math.imul(result, 16777619);
        }
        return result >>> 0;
    }

    function categoryOf(card) {
        return String(card?.category || card?.viewCategory || 'item').trim().toLowerCase() || 'item';
    }

    function stableSort(cards, date) {
        const seed = String(date || '');
        return cards.slice().sort((a, b) => `${hash(`${seed}:${a.id}`)}:${a.id}`.localeCompare(`${hash(`${seed}:${b.id}`)}:${b.id}`));
    }

    function interleaveByCategory(list, limit = list.length) {
        const groups = new Map();
        for (const card of list) {
            const category = categoryOf(card);
            const group = groups.get(category) || [];
            group.push(card);
            groups.set(category, group);
        }
        const result = [];
        while (result.length < limit && groups.size) {
            const available = [...groups.entries()]
                .filter(([, group]) => group.length)
                .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
            if (!available.length) break;
            for (const [category, group] of available) {
                if (result.length >= limit) break;
                const card = group.shift();
                if (card) result.push(card);
                if (!group.length) groups.delete(category);
            }
        }
        return result;
    }

    function createQueue(cards, readProgress, date, queueSize = QUEUE_SIZE) {
        const source = Array.isArray(cards) ? cards.filter(card => card && card.id) : [];
        const ordered = interleaveByCategory(stableSort(source, date));
        const review = ordered.filter(card => ['learning', 'mastered'].includes(cardStatus(readProgress, card)));
        const fresh = ordered.filter(card => cardStatus(readProgress, card) === 'new');
        const used = new Set();
        const queue = [];
        const pick = (list, count) => {
            for (const card of list) {
                if (queue.length >= queueSize || count <= 0) break;
                if (used.has(card.id)) continue;
                used.add(card.id);
                queue.push({ cardId: card.id });
                count -= 1;
            }
        };
        const stageModes = queueSize === QUEUE_SIZE
            ? STAGE_MODES
            : Array.from({ length: queueSize }, (_, index) => index === queueSize - 1 ? 'scene' : index === 0 ? 'review' : 'new');
        pick(review, Math.min(2, queueSize));
        pick(ordered, Math.max(0, Math.min(2, queueSize) - queue.length));
        pick(fresh, Math.max(0, Math.min(5, queueSize) - queue.length));
        pick(ordered, Math.max(0, queueSize - queue.length));
        return queue.slice(0, queueSize).map((item, index) => ({ ...item, mode: stageModes[index] || 'new' }));
    }

    function emptyState(cards, readProgress, date, profileId, options = {}) {
        const queueSize = Math.max(1, Number(options.queueSize || QUEUE_SIZE));
        return { version: 1, profileId, localDate: localDate(date), regionId: String(options.regionId || ''), missionId: String(options.missionId || ''), rewardPoints: Number(options.rewardPoints || REWARD_POINTS), queue: createQueue(cards, readProgress, date, queueSize), completed: [], startedAt: new Date().toISOString(), completedAt: '' };
    }

    function start(cards, readProgress, date = '', options = {}) {
        const profileId = activeProfileId();
        const today = localDate(date);
        const current = readState(profileId);
        const requestedRegionId = String(options.regionId || '');
        if (current && current.localDate === today && current.queue.length && String(current.regionId || '') === requestedRegionId) return { state: current, persisted: true, resumed: true };
        const state = emptyState(cards, readProgress, today, profileId, options);
        return { state, persisted: writeState(state), resumed: false };
    }

    function recordAction(state, cardId) {
        if (!state || !state.queue.some(item => item.cardId === cardId)) return { state, persisted: false, reason: 'unknown-card' };
        if (state.completed.includes(cardId)) return { state, persisted: true, duplicate: true };
        const next = { ...state, completed: [...state.completed, cardId] };
        if (next.completed.length >= next.queue.length) next.completedAt = new Date().toISOString();
        return { state: next, persisted: writeState(next), duplicate: false };
    }

    function isComplete(state) { return !!state && state.queue.length > 0 && state.completed.length >= state.queue.length; }

    function getRewardEvent(state) {
        if (!isComplete(state)) return null;
        const eventId = state.regionId ? `session:${state.localDate}:${state.regionId}` : `session:${state.localDate}`;
        return { source: REWARD_SOURCE, eventId, points: Number(state.rewardPoints || REWARD_POINTS), profileId: state.profileId, localDate: state.localDate };
    }

    function claimReward(state) {
        const event = getRewardEvent(state);
        if (!event) return { accepted: false, reason: 'incomplete' };
        if (!global.GameRewardReceipts || typeof global.GameRewardReceipts.claim !== 'function') return { accepted: false, reason: 'unavailable' };
        return global.GameRewardReceipts.claim(event);
    }

    global.MinecraftVocabSession = {
        STORAGE_PREFIX, STAGE_MODES, REWARD_POINTS, activeProfileId, storageKey, readState, writeState,
        categoryOf, interleaveByCategory, createQueue, start, recordAction, isComplete, getRewardEvent, claimReward
    };
})(typeof window !== 'undefined' ? window : globalThis);
