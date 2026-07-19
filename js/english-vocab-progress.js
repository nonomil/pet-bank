(function () {
    'use strict';

    const PROGRESS_KEY = 'petbank_learning_vocab_progress';
    const REWARD_KEY = 'petbank_learning_english_rewards';
    const SCOPE_MIGRATION_PREFIX = 'petbank_english_vocab_scope_migration_v2_';
    const MASTERED_STREAK = 2;
    const COMMON_VOUCHER_ID = 'minecraft-card-common-10';
    const SRS_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60];
    const SRS_MAX_INTERVAL_DAYS = 90;
    const SRS_DEFAULT_EASE = 2.5;
    const SRS_MIN_EASE = 1.3;
    const SRS_MAX_EASE = 3;
    const SRS_RETRY_MINUTES = 10;
    const SRS_HARD_RETRY_HOURS = 12;
    const SRS_EASY_MIN_INTERVAL_DAYS = 2;
    const REVIEW_GRADES = ['again', 'hard', 'good', 'easy'];

    function readKey(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) {
            console.warn('[EnglishVocabProgress] failed to read storage; using fallback', key, err);
            return fallback;
        }
    }

    function writeKey(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value || {}));
            return true;
        } catch (err) {
            console.warn('[EnglishVocabProgress] failed to write storage', key, err);
            return false;
        }
    }

    function resolveNow(value) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        const parsed = Date.parse(String(value || ''));
        return Number.isFinite(parsed) ? parsed : Date.now();
    }

    function isoAt(timestamp) {
        return new Date(timestamp).toISOString();
    }

    function clampEase(value) {
        return Math.max(SRS_MIN_EASE, Math.min(SRS_MAX_EASE, Number(value) || SRS_DEFAULT_EASE));
    }

    function normalizeGrade(input) {
        if (typeof input === 'boolean') return input ? 'good' : 'again';
        const grade = String(input || '').trim().toLowerCase();
        return REVIEW_GRADES.includes(grade) ? grade : 'again';
    }

    function requestProfileSync(reason) {
        try {
            window.ProfileManager?.requestHighPrioritySync?.(reason);
        } catch (err) {
            console.warn('[EnglishVocabProgress] profile sync request failed', err);
        }
    }

    function activeProfileScope() {
        try {
            if (window.ProfileManager && typeof window.ProfileManager.getActiveId === 'function') {
                const id = window.ProfileManager.getActiveId();
                if (id) return { id, resolved: true };
            }
        } catch (err) {
            console.warn('[EnglishVocabProgress] failed to migrate profile-scoped storage', err);
        }
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
        return writeKey(scopedKey(PROGRESS_KEY), data || {});
    }

    function readRewards() {
        ensureScopedMigration();
        return readKey(scopedKey(REWARD_KEY), {});
    }

    function writeRewards(rewards) {
        ensureScopedMigration();
        return writeKey(scopedKey(REWARD_KEY), rewards || {});
    }

    function get(cardId) {
        const data = read();
        return data[cardId] || {
            seen: 0,
            correct: 0,
            wrong: 0,
            streak: 0,
            status: 'new',
            repetitions: 0,
            intervalDays: 0,
            ease: SRS_DEFAULT_EASE,
            lapses: 0,
            dueAt: '',
            lastReviewedAt: '',
            lastGrade: '',
            hintUsed: false,
            responseMode: '',
            lastResponseMs: 0
        };
    }

    function record(cardId, isCorrect, options = {}) {
        if (!cardId) return get(cardId);
        const data = read();
        const item = Object.assign({}, get(cardId));
        const reviewedAtMs = resolveNow(options.now);
        const grade = normalizeGrade(options.grade || isCorrect);
        const correct = grade !== 'again';
        item.seen += 1;
        if (correct) {
            item.correct += 1;
            item.streak += 1;
        } else {
            item.wrong += 1;
            item.streak = 0;
        }
        item.status = grade !== 'again' && grade !== 'hard' && item.streak >= MASTERED_STREAK ? 'mastered' : 'learning';
        const easeDelta = { again: -0.2, hard: -0.05, good: 0.05, easy: 0.15 }[grade];
        item.ease = clampEase(Number(item.ease || SRS_DEFAULT_EASE) + easeDelta);
        item.lapses = Math.max(0, Number(item.lapses || 0) + (grade === 'again' ? 1 : 0));
        if (grade === 'again') {
            item.repetitions = 0;
            item.intervalDays = 0;
            item.dueAt = isoAt(reviewedAtMs + SRS_RETRY_MINUTES * 60 * 1000);
        } else if (grade === 'hard') {
            item.intervalDays = 0;
            item.dueAt = isoAt(reviewedAtMs + SRS_HARD_RETRY_HOURS * 60 * 60 * 1000);
        } else {
            item.repetitions = Math.max(0, Number(item.repetitions || 0)) + 1;
            const scheduleIndex = Math.min(item.repetitions - 1, SRS_INTERVALS_DAYS.length - 1);
            const baseDays = item.repetitions <= SRS_INTERVALS_DAYS.length
                ? SRS_INTERVALS_DAYS[scheduleIndex]
                : Math.min(SRS_MAX_INTERVAL_DAYS, Math.max(1, Math.round(Number(item.intervalDays || 1) * item.ease)));
            const scheduledDays = grade === 'easy'
                ? Math.min(SRS_MAX_INTERVAL_DAYS, Math.max(SRS_EASY_MIN_INTERVAL_DAYS, Math.round(baseDays * 1.5)))
                : baseDays;
            item.intervalDays = scheduledDays;
            item.dueAt = isoAt(reviewedAtMs + scheduledDays * 24 * 60 * 60 * 1000);
        }
        item.lastGrade = grade;
        if (Object.prototype.hasOwnProperty.call(options, 'hintUsed')) item.hintUsed = Boolean(options.hintUsed);
        if (options.responseMode) item.responseMode = String(options.responseMode);
        if (Number.isFinite(Number(options.responseMs))) item.lastResponseMs = Math.max(0, Number(options.responseMs));
        item.lastReviewedAt = isoAt(reviewedAtMs);
        item.updatedAt = item.lastReviewedAt;
        data[cardId] = item;
        const persisted = write(data);
        if (persisted) requestProfileSync('english-vocab-progress');
        return Object.assign({}, item, { persisted });
    }

    function stats(cards) {
        const data = read();
        const now = Date.now();
        return (cards || []).reduce((acc, card) => {
            const progress = data[card.id] || {};
            const status = progress.status || 'new';
            if (status === 'mastered') acc.mastered += 1;
            else if (status === 'learning') acc.learning += 1;
            else acc.new += 1;
            if (status !== 'new' && (!progress.dueAt || Date.parse(progress.dueAt) <= now)) acc.due += 1;
            acc.total += 1;
            return acc;
        }, { total: 0, new: 0, learning: 0, mastered: 0, due: 0 });
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
            if (!writeRewards(rewards)) {
                delete rewards[COMMON_VOUCHER_ID];
            }
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
        reset,
        SRS_INTERVALS_DAYS,
        SRS_RETRY_MINUTES
    };
})();
