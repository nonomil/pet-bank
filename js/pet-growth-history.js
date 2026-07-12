/**
 * pet-growth-history.js - bounded local growth log and care streak
 */
(function (root) {
    'use strict';
    const KEY = 'petbank_growth_history_v1';
    const CARE_KEY = 'petbank_care_streak_v1';
    const LIMIT = 30;
    function read(key, fallback) {
        try { const raw = root.localStorage && root.localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
    }
    function write(key, value) { try { root.localStorage && root.localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
    function dateKey(date = new Date()) {
        if (arguments.length === 0 && root.PetBankTime && typeof root.PetBankTime.localDate === 'function') {
            return root.PetBankTime.localDate();
        }
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function append(entry) {
        if (!entry || typeof entry !== 'object') return null;
        const list = read(KEY, []);
        const item = { ...entry, date: entry.date || dateKey(), createdAt: entry.createdAt || new Date().toISOString() };
        list.unshift(item);
        write(KEY, list.slice(0, LIMIT));
        return item;
    }
    function getRecent(limit = LIMIT) { return read(KEY, []).slice(0, Math.max(0, Number(limit) || LIMIT)); }
    function markCare(date = new Date()) {
        const day = dateKey(date);
        const state = read(CARE_KEY, { lastDate: '', streak: 0 });
        if (state.lastDate === day) return state;
        const previous = new Date(`${state.lastDate}T00:00:00`);
        const current = new Date(`${day}T00:00:00`);
        const gap = state.lastDate ? Math.round((current - previous) / 86400000) : 0;
        const next = { lastDate: day, streak: gap === 1 ? Number(state.streak || 0) + 1 : 1 };
        write(CARE_KEY, next);
        return next;
    }
    function getCareStreak() { return read(CARE_KEY, { lastDate: '', streak: 0 }); }
    root.PetGrowthHistory = { KEY, LIMIT, dateKey, append, getRecent, markCare, getCareStreak };
})(typeof window !== 'undefined' ? window : globalThis);
