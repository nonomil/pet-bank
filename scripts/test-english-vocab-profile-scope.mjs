import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/english-vocab-progress.js', import.meta.url), 'utf8');
const profileSource = fs.readFileSync(new URL('../js/profiles.js', import.meta.url), 'utf8');

function createStorage(initial = {}, failKeys = []) {
    const data = new Map(Object.entries(initial));
    const failures = new Set(failKeys);
    return {
        getItem(key) { return data.has(key) ? data.get(key) : null; },
        setItem(key, value) {
            if (failures.has(key)) throw new Error(`write blocked: ${key}`);
            data.set(key, String(value));
        },
        removeItem(key) { data.delete(key); },
        get length() { return data.size; },
        key(index) { return [...data.keys()][index] || null; },
        dump(key) { return data.get(key); }
    };
}

function loadProfileManager(storage) {
    const window = {};
    vm.runInNewContext(profileSource, { window, localStorage: storage, JSON, Date });
    return window.ProfileManager;
}

function loadProgress(storage, getActiveId) {
    const window = {
        ProfileManager: getActiveId ? { getActiveId } : undefined
    };
    vm.runInNewContext(source, {
        window,
        localStorage: storage,
        Date,
        JSON
    });
    Object.defineProperty(window.EnglishVocabProgress, '__testWindow', { value: window });
    return window.EnglishVocabProgress;
}

const legacyProgressKey = 'petbank_learning_vocab_progress';
const legacyRewardKey = 'petbank_learning_english_rewards';
const progressKey = (id) => `${legacyProgressKey}_${id}`;
const rewardKey = (id) => `${legacyRewardKey}_${id}`;

{
    let activeId = null;
    const storage = createStorage({
        [legacyProgressKey]: JSON.stringify({ apple: { seen: 2, correct: 2, wrong: 0, streak: 2, status: 'mastered' } })
    });
    const progress = loadProgress(storage, () => activeId);
    assert.equal(progress.get('apple').streak, 2, 'fallback default receives legacy data before ProfileManager loads');

    activeId = 'profile-a';
    assert.equal(progress.get('apple').streak, 2, 'fallback data transfers to the resolved active profile');
    storage.removeItem(legacyProgressKey);
    storage.removeItem(legacyRewardKey);
    activeId = 'profile-b';
    assert.equal(progress.get('apple').streak, 0, 'B must not inherit legacy data after A migration');
    assert.equal(storage.dump(progressKey('profile-b')), undefined);
}

{
    let activeId = 'profile-a';
    const storage = createStorage();
    const progress = loadProgress(storage, () => activeId);
    progress.record('apple', true);
    progress.record('apple', true);
    activeId = 'profile-b';
    progress.record('apple', true);

    assert.equal(progress.get('apple').streak, 1, 'B must not receive A streak');
    assert.equal(JSON.parse(storage.dump(progressKey('profile-a'))).apple.streak, 2);
    assert.equal(JSON.parse(storage.dump(progressKey('profile-b'))).apple.streak, 1);

    const cards = Array.from({ length: 10 }, (_, index) => ({ id: `b-${index}` }));
    cards.forEach((card) => {
        progress.record(card.id, true);
        progress.record(card.id, true);
    });
    progress.claimMilestoneRewards(cards);
    assert.ok(storage.dump(rewardKey('profile-b')), 'B reward must be scoped');
    assert.equal(storage.dump(rewardKey('profile-a')), undefined, 'A reward must remain isolated');
}

{
    const storage = createStorage({
        [legacyProgressKey]: JSON.stringify({ apple: { seen: 2, correct: 2, wrong: 0, streak: 2, status: 'mastered' } }),
        [legacyRewardKey]: JSON.stringify({ old: { title: 'legacy reward' } })
    });
    const progress = loadProgress(storage, () => 'profile-a');
    assert.equal(progress.get('apple').streak, 2, 'legacy data migrates to active profile');
    assert.deepEqual(progress.readRewards(), { old: { title: 'legacy reward' } });
    assert.ok(storage.dump(legacyProgressKey), 'legacy progress key is retained');
    assert.ok(storage.dump(legacyRewardKey), 'legacy reward key is retained');

    const reloaded = loadProgress(storage, () => 'profile-a');
    reloaded.write({ apple: { seen: 1, correct: 1, wrong: 0, streak: 1, status: 'learning' } });
    assert.equal(reloaded.get('apple').streak, 1, 'migration must not overwrite scoped data on later reads');
}

{
    const storage = createStorage();
    const progress = loadProgress(storage);
    progress.record('fallback', true);
    assert.equal(JSON.parse(storage.dump(progressKey('default'))).fallback.streak, 1);
}

{
    const storage = createStorage({
        petbank_profiles_meta: JSON.stringify([
            { id: 'profile-a', name: 'A', emoji: 'A', createdAt: 1 },
            { id: 'profile-b', name: 'B', emoji: 'B', createdAt: 2 }
        ]),
        petbank_active_profile: 'profile-a',
        [legacyProgressKey]: JSON.stringify({ apple: { seen: 2, correct: 2, wrong: 0, streak: 2, status: 'mastered' } }),
        [legacyRewardKey]: JSON.stringify({ rewardA: { title: 'A reward' } }),
        'petbank_profile_data_profile-b': JSON.stringify({
            [legacyProgressKey]: JSON.stringify({ apple: { seen: 1, correct: 1, wrong: 0, streak: 1, status: 'learning' } }),
            [legacyRewardKey]: JSON.stringify({ rewardB: { title: 'B reward' } })
        })
    });
    const profiles = loadProfileManager(storage);
    const progress = loadProgress(storage, () => profiles.getActiveId());
    assert.equal(progress.get('apple').streak, 2, 'A migrates its active legacy progress');
    assert.deepEqual(progress.readRewards(), { rewardA: { title: 'A reward' } });

    profiles._swapTo('profile-b', false);
    assert.equal(progress.get('apple').streak, 1, 'B migrates its own legacy progress after swap');
    assert.deepEqual(progress.readRewards(), { rewardB: { title: 'B reward' } });

    profiles._swapTo('profile-a', false);
    assert.equal(progress.get('apple').streak, 2, 'A scoped data remains intact after switching back');
    assert.deepEqual(progress.readRewards(), { rewardA: { title: 'A reward' } });
}

{
    const storage = createStorage({
        petbank_profiles_meta: JSON.stringify([
            { id: 'profile-a', name: 'A', emoji: 'A', createdAt: 1 },
            { id: 'profile-b', name: 'B', emoji: 'B', createdAt: 2 }
        ]),
        petbank_active_profile: 'profile-a',
        [progressKey('profile-a')]: JSON.stringify({ apple: { streak: 2 } })
    });
    const profiles = loadProfileManager(storage);
    const exported = profiles.exportProfiles().find((profile) => profile.id === 'profile-a');
    assert.ok(exported.snapshot[progressKey('profile-a')], 'profile export includes scoped English progress');
    storage.removeItem(progressKey('profile-a'));
    profiles.applySnapshotForProfile('profile-a', exported.snapshot, { activate: true });
    const progress = loadProgress(storage, () => profiles.getActiveId());
    assert.equal(progress.get('apple').streak, 2, 'same-profile restore makes scoped English progress readable');
}

{
    const progressKeyForProfile = `${legacyProgressKey}_profile-a`;
    const storage = createStorage({}, [progressKeyForProfile]);
    const progress = loadProgress(storage, () => 'profile-a');
    const result = progress.record('blocked', true);
    assert.equal(result.persisted, false, 'record reports a progress write failure');
    assert.equal(storage.dump(progressKeyForProfile), undefined, 'failed progress write does not claim persisted state');
}

{
    const rewardKeyForProfile = `${legacyRewardKey}_profile-a`;
    const storage = createStorage({}, [rewardKeyForProfile]);
    const progress = loadProgress(storage, () => 'profile-a');
    const cards = Array.from({ length: 10 }, (_, index) => ({ id: `blocked-${index}` }));
    cards.forEach((card) => {
        progress.record(card.id, true);
        progress.record(card.id, true);
    });
    const rewards = progress.claimMilestoneRewards(cards);
    assert.equal(rewards['minecraft-card-common-10'], undefined, 'failed reward write does not expose an unpersisted voucher');
    assert.equal(storage.dump(rewardKeyForProfile), undefined, 'failed reward write leaves no reward record');
}

console.log('english vocab profile scope: PASS');
