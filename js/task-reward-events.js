/** Reversible task operation log; does not mutate points. */
(function (root) {
    'use strict';
    const KEY = 'petbank_task_reward_events_v1';
    function read() { try { const raw = root.localStorage && root.localStorage.getItem(KEY); const value = raw ? JSON.parse(raw) : []; return Array.isArray(value) ? value : []; } catch (e) { return []; } }
    function record(input = {}) {
        const operation = input.operation === 'undo' ? 'undo' : 'complete';
        const item = { eventId: String(input.eventId || `${input.profileId || 'local'}:${input.date || ''}:${input.taskId || ''}:${operation}:${Date.now()}`), profileId: String(input.profileId || 'local'), date: String(input.date || ''), taskId: String(input.taskId || ''), points: Math.max(0, Math.floor(Number(input.points) || 0)), operation, occurredAt: new Date().toISOString() };
        const list = read();
        list.unshift(item);
        try { root.localStorage && root.localStorage.setItem(KEY, JSON.stringify(list.slice(0, 200))); } catch (e) {}
        if (root.PetGrowthHistory && typeof root.PetGrowthHistory.append === 'function') root.PetGrowthHistory.append({ source: 'task', action: operation, label: operation === 'undo' ? '撤回任务奖励' : '完成学习任务', taskId: item.taskId, points: item.points });
        return item;
    }
    function getRecent(limit = 50) { return read().slice(0, Math.max(0, Number(limit) || 50)); }
    root.TaskRewardEvents = { KEY, record, getRecent };
})(typeof window !== 'undefined' ? window : globalThis);
