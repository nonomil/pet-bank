import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const progressSource = fs.readFileSync(new URL('../js/english-vocab-progress.js', import.meta.url), 'utf8');

function createStorage() {
    const store = new Map();
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        }
    };
}

function loadProgress() {
    const localStorage = createStorage();
    const context = {
        window: null,
        localStorage,
        console,
        Math,
        Date
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(progressSource, context, { filename: 'js/english-vocab-progress.js' });
    return { api: context.window.EnglishVocabProgress, localStorage };
}

function buildCards(count) {
    return Array.from({ length: count }, (_, index) => ({
        id: `mc-word-${String(index + 1).padStart(2, '0')}`,
        word: `word-${index + 1}`,
        translation: `词 ${index + 1}`
    }));
}

function testMasteryAndStats() {
    const { api } = loadProgress();
    const cards = buildCards(4);

    assert.deepEqual(JSON.parse(JSON.stringify(api.get(cards[0].id))), {
        seen: 0,
        correct: 0,
        wrong: 0,
        streak: 0,
        status: 'new'
    });

    api.record(cards[0].id, true);
    assert.equal(api.get(cards[0].id).status, 'learning');

    api.record(cards[0].id, true);
    assert.equal(api.get(cards[0].id).status, 'mastered');

    api.record(cards[0].id, false);
    const afterWrong = api.get(cards[0].id);
    assert.equal(afterWrong.status, 'learning');
    assert.equal(afterWrong.streak, 0);
    assert.equal(afterWrong.wrong, 1);

    api.record(cards[1].id, false);
    api.record(cards[2].id, true);
    api.record(cards[2].id, true);

    assert.deepEqual(JSON.parse(JSON.stringify(api.stats(cards))), {
        total: 4,
        new: 1,
        learning: 2,
        mastered: 1
    });
}

function testEnglishRewardClaimIsIdempotent() {
    const { api, localStorage } = loadProgress();
    const cards = buildCards(12);

    cards.slice(0, 9).forEach((card) => {
        api.record(card.id, true);
        api.record(card.id, true);
    });
    assert.deepEqual(JSON.parse(JSON.stringify(api.claimMilestoneRewards(cards))), {});

    api.record(cards[9].id, true);
    api.record(cards[9].id, true);
    const firstClaim = api.claimMilestoneRewards(cards);
    assert.ok(firstClaim['minecraft-card-common-10'], 'mastering 10 words should grant a Minecraft voucher');
    assert.equal(firstClaim['minecraft-card-common-10'].type, 'card-token');

    const secondClaim = api.claimMilestoneRewards(cards);
    assert.equal(Object.keys(secondClaim).length, 1, 'reward should not be duplicated');

    const rawRewards = localStorage.getItem('petbank_learning_english_rewards');
    const rewards = JSON.parse(rawRewards || '{}');
    assert.equal(Object.keys(rewards).length, 1);
    assert.ok(rewards['minecraft-card-common-10']);
}

function main() {
    testMasteryAndStats();
    testEnglishRewardClaimIsIdempotent();
    console.log('PASS - english vocab progress checks');
}

main();
