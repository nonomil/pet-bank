(function (global) {
    'use strict';

    const KEY = 'petbank_self_hosted_snapshot_outbox_v1';
    const MAX_ENTRIES = 20;

    function read(storage) {
        try {
            const raw = storage && storage.getItem(KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (_) {
            return {};
        }
    }

    function write(storage, entries) {
        try {
            storage.setItem(KEY, JSON.stringify(entries));
            return true;
        } catch (_) {
            return false;
        }
    }

    function upsert(storage, input) {
        const item = input && typeof input === 'object' ? input : {};
        const id = String(item.id || '').trim();
        const profileId = String(item.profileId || '').trim();
        const childId = String(item.childId || '').trim();
        const revision = Number(item.revision);
        if (!id || !profileId || !childId || !Number.isSafeInteger(revision) || revision < 1) return false;
        if (!item.payload || typeof item.payload !== 'object' || Array.isArray(item.payload)) return false;

        const entries = read(storage);
        entries[id] = {
            id,
            profileId,
            childId,
            revision,
            payload: item.payload,
            status: item.status === 'conflict' ? 'conflict' : 'pending',
            attempts: Math.max(0, Number(item.attempts) || 0),
            nextAttemptAt: Math.max(0, Number(item.nextAttemptAt) || 0),
            queuedAt: Number(item.queuedAt) || Date.now(),
            lastError: String(item.lastError || ''),
            remoteRevision: Number.isSafeInteger(Number(item.remoteRevision)) ? Number(item.remoteRevision) : null
        };
        const ids = Object.keys(entries).sort((a, b) => Number(entries[a].queuedAt || 0) - Number(entries[b].queuedAt || 0));
        ids.slice(0, Math.max(0, ids.length - MAX_ENTRIES)).forEach((oldId) => delete entries[oldId]);
        return write(storage, entries);
    }

    function get(storage, id) {
        return read(storage)[String(id || '').trim()] || null;
    }

    function list(storage) {
        return Object.values(read(storage));
    }

    function remove(storage, id) {
        const entries = read(storage);
        const key = String(id || '').trim();
        if (!Object.prototype.hasOwnProperty.call(entries, key)) return false;
        delete entries[key];
        return write(storage, entries);
    }

    global.PetBankCloudSyncOutbox = Object.freeze({ KEY, list, get, upsert, remove });
})(typeof window !== 'undefined' ? window : globalThis);
