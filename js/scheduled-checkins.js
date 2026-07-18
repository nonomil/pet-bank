(function (root) {
    'use strict';

    const STORAGE_KEY = 'petbank_scheduled_checkins_v1';
    const SCHEMA_VERSION = 1;
    const DEFAULT_SCHEDULE = Object.freeze([
        { id: 'morning-rest', icon: 'coffee', title: '休息一下', subtitle: '完成一项，放松片刻', start: '09:00', end: '11:00', points: 0, tag: '自由' },
        { id: 'think-english', icon: 'book-open', title: '剑桥 Think 英语', subtitle: '专注学习一小时，完成后领取成长分', start: '11:10', end: '12:10', points: 2, tag: '英语学习' },
        { id: 'lunch', icon: 'utensils', title: '午餐', subtitle: '好好吃饭，给下午补充能量', start: '12:10', end: '12:50', points: 0, tag: '用餐' },
        { id: 'nap', icon: 'bed-double', title: '午睡', subtitle: '睡个午觉，下午更有精神', start: '12:50', end: '14:20', points: 0, tag: '午睡' },
        { id: 'afternoon-reading', icon: 'book-open-text', title: '课外阅读（下午）', subtitle: '读一会儿喜欢的书，再去探索', start: '14:20', end: '15:05', points: 2, tag: '阅读/阅读' },
        { id: 'outdoor-time', icon: 'sun-medium', title: '户外活动', subtitle: '出门走走，和宠物一起晒晒太阳', start: '15:20', end: '16:20', points: 2, tag: '运动' },
        { id: 'dinner', icon: 'soup', title: '晚餐', subtitle: '慢慢吃饭，聊聊今天的收获', start: '17:30', end: '18:30', points: 0, tag: '用餐' },
        { id: 'evening-reset', icon: 'list-checks', title: '睡前整理', subtitle: '收好物品，准备明天的小计划', start: '20:30', end: '21:00', points: 1, tag: '自控力' }
    ]);

    function getStorage() {
        try {
            if (root.localStorage && typeof root.localStorage.getItem === 'function') return root.localStorage;
        } catch (error) {
            console.warn('[ScheduledCheckins] storage unavailable', error);
        }
        return null;
    }

    function getProfileId() {
        try {
            return root.ProfileManager && typeof root.ProfileManager.getActiveId === 'function'
                ? String(root.ProfileManager.getActiveId() || 'p_default')
                : 'p_default';
        } catch (error) {
            return 'p_default';
        }
    }

    function toDate(value) {
        const date = value == null ? new Date() : (value instanceof Date ? new Date(value.getTime()) : new Date(value));
        return Number.isNaN(date.getTime()) ? new Date() : date;
    }

    function localDate(value) {
        const date = toDate(value);
        if (root.PetBankTime && typeof root.PetBankTime.localDate === 'function') return root.PetBankTime.localDate(date);
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function minuteOfDay(time) {
        const [hours, minutes] = String(time || '').split(':').map(Number);
        return (Number.isFinite(hours) ? hours : 0) * 60 + (Number.isFinite(minutes) ? minutes : 0);
    }

    function getCurrentMinute(date) {
        return date.getHours() * 60 + date.getMinutes();
    }

    function readStoredState() {
        const store = getStorage();
        if (!store) return null;
        try {
            const raw = store.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
        } catch (error) {
            console.warn('[ScheduledCheckins] invalid stored state', error);
            return null;
        }
    }

    function writeState(state) {
        const store = getStorage();
        if (!store) return false;
        try {
            store.setItem(STORAGE_KEY, JSON.stringify(state));
            return true;
        } catch (error) {
            console.warn('[ScheduledCheckins] failed to save state', error);
            return false;
        }
    }

    function emptyState(date, profileId) {
        return { schemaVersion: SCHEMA_VERSION, date, profileId, checkins: {} };
    }

    function getState(options = {}) {
        const date = localDate(options.now);
        const profileId = getProfileId();
        const saved = readStoredState();
        if (saved && saved.schemaVersion === SCHEMA_VERSION && saved.date === date && saved.profileId === profileId && saved.checkins && typeof saved.checkins === 'object' && !Array.isArray(saved.checkins)) {
            return { ...saved, checkins: { ...saved.checkins } };
        }
        return emptyState(date, profileId);
    }

    function getStatus(item, date, record) {
        if (record && record.status === 'completed') return 'completed';
        if (record && record.status === 'pending') return 'pending';
        const current = getCurrentMinute(date);
        if (current < minuteOfDay(item.start)) return 'upcoming';
        if (current <= minuteOfDay(item.end)) return 'active';
        return 'missed';
    }

    function getToday(options = {}) {
        const date = toDate(options.now);
        const state = getState({ now: date });
        return DEFAULT_SCHEDULE.map((item) => {
            const record = state.checkins[item.id] || null;
            const status = getStatus(item, date, record);
            return {
                ...item,
                date: state.date,
                profileId: state.profileId,
                status,
                completed: status === 'completed',
                late: Boolean(record && record.late),
                completedAt: record && record.completedAt ? record.completedAt : '',
                eventId: record && record.eventId ? record.eventId : `${state.profileId}:${state.date}:${item.id}`
            };
        });
    }

    function findItem(itemId) {
        return DEFAULT_SCHEDULE.find((item) => item.id === String(itemId || '')) || null;
    }

    function complete(itemId, options = {}) {
        const item = findItem(itemId);
        if (!item) return { accepted: false, reason: 'unknown-item' };

        const date = toDate(options.now);
        const state = getState({ now: date });
        const eventId = `${state.profileId}:${state.date}:${item.id}`;
        const existing = state.checkins[item.id];
        if (existing && existing.status === 'completed') {
            return { accepted: false, duplicate: true, item: { ...item, date: state.date, status: 'completed' }, eventId };
        }

        const status = getStatus(item, date, existing);
        if (status === 'upcoming') return { accepted: false, reason: 'not-open', item: { ...item, date: state.date, status }, eventId };

        const late = status === 'missed';
        const points = late ? 0 : item.points;
        const pendingState = {
            ...state,
            checkins: {
                ...state.checkins,
                [item.id]: { status: 'pending', eventId, late, points }
            }
        };
        if (!writeState(pendingState)) return { accepted: false, reason: 'storage', item: { ...item, date: state.date, status }, eventId };

        const rewardResult = root.CoreRewardService && typeof root.CoreRewardService.claim === 'function'
            ? root.CoreRewardService.claim({
                eventId,
                profileId: state.profileId,
                source: 'task',
                sourceId: `scheduled:${item.id}`,
                rewards: points > 0 ? [{ type: 'growth_points', amount: points }] : []
            })
            : { accepted: false, duplicate: false, reason: 'reward-service-unavailable' };

        if (!rewardResult.accepted && !rewardResult.duplicate) {
            writeState(state);
            return { accepted: false, reason: rewardResult.reason || 'reward-unavailable', item: { ...item, date: state.date, status }, eventId };
        }

        const completedState = {
            ...pendingState,
            checkins: {
                ...pendingState.checkins,
                [item.id]: { status: 'completed', completed: true, eventId, late, points, completedAt: new Date().toISOString() }
            }
        };
        if (!writeState(completedState)) {
            return { accepted: false, reason: 'storage-finalize', item: { ...item, date: state.date, status: 'pending' }, eventId, reward: rewardResult };
        }
        return { accepted: true, duplicate: Boolean(rewardResult.duplicate), late, points, item: { ...item, date: state.date, status: 'completed' }, eventId, reward: rewardResult };
    }

    let ticker = null;
    function startTicker(callback, interval = 30000) {
        stopTicker();
        if (typeof root.setInterval !== 'function' || typeof callback !== 'function') return null;
        ticker = root.setInterval(callback, Math.max(10000, Number(interval) || 30000));
        return ticker;
    }

    function stopTicker() {
        if (ticker !== null && typeof root.clearInterval === 'function') root.clearInterval(ticker);
        ticker = null;
    }

    root.ScheduledCheckins = Object.freeze({
        STORAGE_KEY,
        SCHEMA_VERSION,
        DEFAULT_SCHEDULE,
        getState,
        getToday,
        complete,
        startTicker,
        stopTicker
    });
})(typeof window !== 'undefined' ? window : globalThis);
