/**
 * pet-care-daily.js - idempotent daily pet-house care state
 */
(function (root) {
    'use strict';
    const STORAGE_KEY = 'petbank_pet_care_daily_v1';
    const ACTIONS = ['feed', 'play', 'bath', 'rest'];
    const LABELS = { feed: '喂食', play: '玩耍', bath: '洗澡', rest: '休息' };

    function today(date = new Date()) {
        const d = date instanceof Date ? date : new Date(date);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function read() {
        try {
            const raw = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && parsed.date === today() && Array.isArray(parsed.completed)) return parsed;
        } catch (e) {}
        return { date: today(), completed: [] };
    }

    function write(state) {
        try {
            if (root.localStorage) root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {}
        return state;
    }

    function getState() {
        const state = read();
        const completed = ACTIONS.filter((action) => state.completed.includes(action));
        return {
            date: state.date,
            completed,
            remaining: ACTIONS.filter((action) => !completed.includes(action)),
            progress: completed.length,
            total: ACTIONS.length,
            complete: completed.length === ACTIONS.length,
            labels: { ...LABELS }
        };
    }

    function recordAction(action) {
        const normalized = String(action || '').trim();
        if (!ACTIONS.includes(normalized)) return { accepted: false, state: getState() };
        const state = read();
        const alreadyDone = state.completed.includes(normalized);
        if (!alreadyDone) state.completed.push(normalized);
        write(state);
        return { accepted: !alreadyDone, duplicate: alreadyDone, state: getState() };
    }

    function getNextAction(petState) {
        const s = petState || {};
        const state = getState();
        const candidates = [
            { action: 'feed', score: Number(s.hunger ?? 100), reason: '宠物有点饿了' },
            { action: 'bath', score: Number(s.cleanliness ?? 100), reason: '宠物需要清洁' },
            { action: 'play', score: Number(s.happiness ?? 100), reason: '陪宠物玩一会儿吧' },
            { action: 'rest', score: Number(s.hp ?? 100), reason: '宠物需要休息' }
        ].filter((item) => !state.completed.includes(item.action));
        candidates.sort((a, b) => a.score - b.score);
        const next = candidates[0] || null;
        return next ? { ...next, label: LABELS[next.action] } : null;
    }

    root.PetCareDaily = { STORAGE_KEY, ACTIONS, LABELS, today, getState, recordAction, getNextAction };
})(typeof window !== 'undefined' ? window : globalThis);
