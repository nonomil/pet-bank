(function () {
    'use strict';

    const PROGRESS_KEY = 'petbank_learning_vocab_progress';
    const REWARD_KEY = 'petbank_learning_english_rewards';
    const SCOPE_MIGRATION_PREFIX = 'petbank_english_vocab_scope_migration_v2_';
    const MASTERED_STREAK = 2;
    const COMMON_VOUCHER_ID = 'minecraft-card-common-10';

    function readKey(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) {
            return fallback;
        }
    }

    function writeKey(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value || {}));
        } catch (err) {}
    }

    function activeProfileScope() {
        try {
            if (window.ProfileManager && typeof window.ProfileManager.getActiveId === 'function') {
                const id = window.ProfileManager.getActiveId();
                if (id) return { id, resolved: true };
            }
        } catch (err) {}
        return { id: 'default', resolved: false };
    }

    function activeProfileId() {
        return activeProfileScope().id;
    }

    function scopedKey(key) {
        return `${key}_${activeProfileId()}`;
    }

    function migrationKey(profileId) {
        return `${SCOPE_MIGRATION_PREFIX}${profileId}`;
    }

    function copyKeyIfMissing(sourceKey, targetKey) {
        if (localStorage.getItem(targetKey) !== null) return;
        const raw = localStorage.getItem(sourceKey);
        if (raw !== null) localStorage.setItem(targetKey, raw);
    }

    // Keep legacy fixed keys for rollback. A fallback copy remains pending until a real profile resolves.
    function ensureScopedMigration() {
        try {
            const scope = activeProfileScope();
            const markerKey = migrationKey(scope.id);
            const marker = localStorage.getItem(markerKey);
            const progressKey = `${PROGRESS_KEY}_${scope.id}`;
            const rewardKey = `${REWARD_KEY}_${scope.id}`;
            if (!scope.resolved) {
                if (marker) return;
                copyKeyIfMissing(PROGRESS_KEY, progressKey);
                copyKeyIfMissing(REWARD_KEY, rewardKey);
                localStorage.setItem(markerKey, 'fallback');
                return;
            }
            if (marker && marker !== 'fallback') return;
            const fallbackMarkerKey = migrationKey('default');
            if (scope.id !== 'default' && localStorage.getItem(fallbackMarkerKey) === 'fallback') {
                copyKeyIfMissing(`${PROGRESS_KEY}_default`, progressKey);
                copyKeyIfMissing(`${REWARD_KEY}_default`, rewardKey);
                localStorage.setItem(fallbackMarkerKey, `claimed:${scope.id}`);
            } else {
                copyKeyIfMissing(PROGRESS_KEY, progressKey);
                copyKeyIfMissing(REWARD_KEY, rewardKey);
            }
            localStorage.setItem(markerKey, '1');
        } catch (err) {}
    }

    function read() {
        ensureScopedMigration();
        return readKey(scopedKey(PROGRESS_KEY), {});
    }

    function write(data) {
        ensureScopedMigration();
        writeKey(scopedKey(PROGRESS_KEY), data || {});
    }

    function readRewards() {
        ensureScopedMigration();
        return readKey(scopedKey(REWARD_KEY), {});
    }

    function writeRewards(rewards) {
        ensureScopedMigration();
        writeKey(scopedKey(REWARD_KEY), rewards || {});
    }

    function get(cardId) {
        const data = read();
        return data[cardId] || {
            seen: 0,
            correct: 0,
            wrong: 0,
            streak: 0,
            status: 'new'
        };
    }

    function record(cardId, isCorrect) {
        if (!cardId) return get(cardId);
        const data = read();
        const item = Object.assign({}, get(cardId));
        item.seen += 1;
        if (isCorrect) {
            item.correct += 1;
            item.streak += 1;
        } else {
            item.wrong += 1;
            item.streak = 0;
        }
        item.status = item.streak >= MASTERED_STREAK ? 'mastered' : 'learning';
        item.updatedAt = new Date().toISOString();
        data[cardId] = item;
        write(data);
        return item;
    }

    function stats(cards) {
        const data = read();
        return (cards || []).reduce((acc, card) => {
            const status = data[card.id]?.status || 'new';
            if (status === 'mastered') acc.mastered += 1;
            else if (status === 'learning') acc.learning += 1;
            else acc.new += 1;
            acc.total += 1;
            return acc;
        }, { total: 0, new: 0, learning: 0, mastered: 0 });
    }

    function claimMilestoneRewards(cards) {
        const cardStats = stats(cards || []);
        const rewards = readRewards();
        if (cardStats.mastered >= 10 && !rewards[COMMON_VOUCHER_ID]) {
            rewards[COMMON_VOUCHER_ID] = {
                type: 'card-token',
                title: 'Minecraft 普通卡兑换券',
                reason: 'mastered-10-minecraft-words',
                masteredCount: cardStats.mastered,
                createdAt: new Date().toISOString()
            };
            writeRewards(rewards);
        }
        return rewards;
    }

    function reset() {
        write({});
        writeRewards({});
    }

    window.EnglishVocabProgress = {
        read,
        write,
        get,
        record,
        stats,
        readRewards,
        writeRewards,
        claimMilestoneRewards,
        reset
    };
})();
