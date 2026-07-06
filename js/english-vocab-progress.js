(function () {
    'use strict';

    const PROGRESS_KEY = 'petbank_learning_vocab_progress';
    const REWARD_KEY = 'petbank_learning_english_rewards';
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

    function read() {
        return readKey(PROGRESS_KEY, {});
    }

    function write(data) {
        writeKey(PROGRESS_KEY, data || {});
    }

    function readRewards() {
        return readKey(REWARD_KEY, {});
    }

    function writeRewards(rewards) {
        writeKey(REWARD_KEY, rewards || {});
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
