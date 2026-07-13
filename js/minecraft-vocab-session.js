(function (global) {
    'use strict';

    const STORAGE_PREFIX = 'petbank_minecraft_vocab_session_v1';
    const REWARD_SOURCE = 'minecraft-vocab';
    const REWARD_POINTS = 10;
    const STAGE_MODES = ['review', 'review', 'new', 'new', 'new', 'new', 'new', 'recall', 'recall', 'recall', 'scene'];

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

    function localDate(input) {
        const supplied = String(input || '').trim();
        if (supplied) return supplied;
        if (global.PetBankTime && typeof global.PetBankTime.localDate === 'function') return global.PetBankTime.localDate();
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    function storageKey(profileId) {
        return `${STORAGE_PREFIX}_${String(profileId || activeProfileId())}`;
    }

    function readState(profileId = activeProfileId()) {
        try {
            const raw = global.localStorage && global.localStorage.getItem(storageKey(profileId));
            const parsed = raw ? JSON.parse(raw) : null;
            return parsed && typeof parsed === 'object' && Array.isArray(parsed.queue) && Array.isArray(parsed.completed)
                ? parsed
                : null;
        } catch (error) {
            console.warn('[MinecraftVocabSession] failed to read session', error);
            return null;
        }
    }

    function writeState(state) {
        try {
            global.localStorage.setItem(storageKey(state.profileId), JSON.stringify(state));
            return true;
        } catch (error) {
            console.warn('[MinecraftVocabSession] failed to write session', error);
            return false;
        }
    }

    function cardStatus(readProgress, card) {
        try {
            const progress = typeof readProgress === 'function' ? readProgress(card) : readProgress?.(card.id);
            return progress && typeof progress === 'object' ? String(progress.status || 'new') : 'new';
        } catch (error) {
            return 'new';
        }
    }

    function stableSort(cards, date) {
        const seed = String(date || '');
        return cards.slice().sort((a, b) => {
            const aKey = `${seed}:${a.id}`;
            const bKey = `${seed}:${b.id}`;
            return aKey.localeCompare(bKey);
        });
    }

    function createQueue(cards, readProgress, date) {
        const source = Array.isArray(cards) ? cards.filter(card => card && card.id) : [];
        const ordered = stableSort(source, date);
        const review = ordered.filter(card => ['learning', 'mastered'].includes(cardStatus(readProgress, card)));
        const fresh = ordered.filter(card => cardStatus(readProgress, card) === 'new');
        const used = new Set();
        const queue = [];
        const pick = (list, mode, count) => {
            for (const card of list) {
                if (queue.length >= 11 || count <= 0) break;
                if (used.has(card.id)) continue;
                used.add(card.id);
                queue.push({ cardId: card.id, mode });
                count -= 1;
            }
        };
        const reviewCountBefore = queue.length;
        pick(review, 'review', 2);
        // A first session has no review history. Fill the warm-up slots from
        // the stable card order while keeping their underlying progress new.
        pick(ordered, 'review', 2 - (queue.length - reviewCountBefore));
        pick(fresh, 'new', 5);
        pick(ordered, 'recall', 3);
        pick(ordered, 'scene', 1);
        return queue.slice(0, STAGE_MODES.length).map((item, index) => ({
            ...item,
            mode: STAGE_MODES[index]
        }));
    }

    function emptyState(cards, readProgress, date, profileId) {
        return {
            version: 1,
            profileId,
            localDate: localDate(date),
            queue: createQueue(cards, readProgress, date),
            completed: [],
            startedAt: new Date().toISOString(),
            completedAt: ''
        };
    }

    function start(cards, readProgress, date = '') {
        const profileId = activeProfileId();
        const today = localDate(date);
        const current = readState(profileId);
        if (current && current.localDate === today && current.queue.length) return { state: current, persisted: true, resumed: true };
        const state = emptyState(cards, readProgress, today, profileId);
        return { state, persisted: writeState(state), resumed: false };
    }

    function recordAction(state, cardId) {
        if (!state || !state.queue.some(item => item.cardId === cardId)) return { state, persisted: false, reason: 'unknown-card' };
        if (state.completed.includes(cardId)) return { state, persisted: true, duplicate: true };
        const next = { ...state, completed: [...state.completed, cardId] };
        if (next.completed.length >= next.queue.length) next.completedAt = new Date().toISOString();
        return { state: next, persisted: writeState(next), duplicate: false };
    }

    function isComplete(state) {
        return !!state && state.queue.length === STAGE_MODES.length && state.completed.length >= state.queue.length;
    }

    function getRewardEvent(state) {
        if (!isComplete(state)) return null;
        return {
            source: REWARD_SOURCE,
            eventId: `session:${state.localDate}`,
            points: REWARD_POINTS,
            profileId: state.profileId,
            localDate: state.localDate
        };
    }

    function claimReward(state) {
        const event = getRewardEvent(state);
        if (!event) return { accepted: false, reason: 'incomplete' };
        if (!global.GameRewardReceipts || typeof global.GameRewardReceipts.claim !== 'function') {
            return { accepted: false, reason: 'unavailable' };
        }
        return global.GameRewardReceipts.claim(event);
    }

    global.MinecraftVocabSession = {
        STORAGE_PREFIX,
        STAGE_MODES,
        REWARD_POINTS,
        activeProfileId,
        storageKey,
        readState,
        writeState,
        createQueue,
        start,
        recordAction,
        isComplete,
        getRewardEvent,
        claimReward
    };
})(typeof window !== 'undefined' ? window : globalThis);
