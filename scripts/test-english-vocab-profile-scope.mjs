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

function loadProgress(storage, getActiveId, onSync) {
    const window = {
        ProfileManager: getActiveId ? { getActiveId, requestHighPrioritySync: onSync || (() => ({ scheduled: false })) } : undefined
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

{
    const storage = createStorage();
    const syncReasons = [];
    const progress = loadProgress(storage, () => 'profile-a', reason => syncReasons.push(reason));
    const scheduler = progress.scheduler();
    assert.equal(scheduler.algorithm, 'fsrs-5');
    assert.equal(scheduler.targetRetention, 0.9);
    assert.equal(scheduler.weights.length, 19);
    const calibration = progress.calibrate({
        events: Array.from({ length: 20 }, (_, index) => ({
            reviewId: `calibration-${index}`,
            grade: index < 17 ? 'good' : 'again',
            reviewedAt: `2026-07-${String(1 + (index % 10)).padStart(2, '0')}T08:00:00.000Z`
        }))
    });
    assert.equal(calibration.algorithm, 'fsrs-5');
    assert.equal(calibration.sampleSize, 20);
    assert.equal(calibration.observedRetention, 0.85);
    assert.equal(calibration.calibrated, true);
    assert.equal(calibration.parameterCalibration.weights.length, 19);
    assert.equal(calibration.parameterCalibration.fitted, true, '20 valid reviews should fit FSRS parameters');
    assert.ok(calibration.parameterCalibration.transitionCount >= 5);
    assert.ok(calibration.parameterCalibration.objectiveAfter <= calibration.parameterCalibration.objectiveBefore);
    assert.equal(calibration.ebbinghaus.fitted, true);
    assert.ok(calibration.ebbinghaus.lambda > 0);
    assert.notEqual(progress.scheduler().calibration.sampleSize, 0);
    assert.equal(progress.scheduler().weightsSource, 'profile-calibration');
    assert.equal(progress.scheduler().weights.length, 19);
    const first = progress.record('stone', true, { now: '2026-07-19T08:00:00.000Z' });
    assert.equal(first.repetitions, 1);
    assert.equal(first.intervalDays, 1);
    assert.equal(first.dueAt, '2026-07-20T08:00:00.000Z');
    assert.equal(first.schedulerVersion, 'fsrs-5');
    assert.ok(first.stabilityDays > 0);
    assert.ok(first.difficulty >= 1 && first.difficulty <= 10);
    assert.ok(first.retrievability >= 0.99);
    const second = progress.record('stone', true, { now: '2026-07-20T08:00:00.000Z' });
    assert.equal(second.repetitions, 2);
    assert.equal(second.intervalDays, 3);
    assert.equal(second.dueAt, '2026-07-23T08:00:00.000Z');
    assert.ok(second.stabilityDays >= first.stabilityDays);
    const later = progress.record('stone', true, { now: '2026-07-23T08:00:00.000Z' });
    assert.ok(later.stabilityDays > second.stabilityDays, 'FSRS stability should grow after a successful review');
    assert.ok(later.intervalDays >= 1, 'FSRS should schedule a positive interval after graduation');
    const lapsed = progress.record('stone', false, { now: '2026-07-20T09:00:00.000Z' });
    assert.equal(lapsed.status, 'learning');
    assert.equal(lapsed.lapses, 1);
    assert.equal(lapsed.intervalDays, 0);
    assert.equal(lapsed.dueAt, '2026-07-20T09:10:00.000Z');
    assert.deepEqual(syncReasons, [
        'english-vocab-progress',
        'english-vocab-progress',
        'english-vocab-progress',
        'english-vocab-progress'
    ]);
}

{
    const storage = createStorage({
        'petbank_learning_vocab_progress_profile-a': JSON.stringify({
            legacy: {
                seen: 4,
                correct: 3,
                wrong: 1,
                streak: 1,
                status: 'learning',
                repetitions: 2,
                intervalDays: 3,
                ease: 2.4,
                dueAt: '2026-07-22T08:00:00.000Z',
                lastReviewedAt: '2026-07-19T08:00:00.000Z'
            }
        })
    });
    const progress = loadProgress(storage, () => 'profile-a');
    const migrated = progress.get('legacy');
    assert.equal(migrated.schedulerVersion, 'fsrs-5');
    assert.equal(migrated.schedulerMigration, 'sm2-to-fsrs5');
    assert.ok(migrated.stabilityDays >= 3);
    assert.ok(migrated.difficulty >= 1 && migrated.difficulty <= 10);
}

{
    const storage = createStorage();
    const progress = loadProgress(storage, () => 'profile-a');
    const again = progress.record('again-card', 'again', {
        now: '2026-07-19T08:00:00.000Z',
        hintUsed: true,
        responseMode: 'picture-recall',
        responseMs: 4200
    });
    assert.equal(again.lastGrade, 'again');
    assert.equal(again.hintUsed, true);
    assert.equal(again.responseMode, 'picture-recall');
    assert.equal(again.lastResponseMs, 4200);
    assert.equal(again.dueAt, '2026-07-19T08:10:00.000Z');

    const hard = progress.record('hard-card', 'hard', { now: '2026-07-19T08:00:00.000Z' });
    assert.equal(hard.lastGrade, 'hard');
    assert.equal(hard.dueAt, '2026-07-19T20:00:00.000Z');
    assert.equal(hard.status, 'learning');

    const good = progress.record('good-card', 'good', { now: '2026-07-19T08:00:00.000Z' });
    assert.equal(good.lastGrade, 'good');
    assert.equal(good.intervalDays, 1);
    assert.equal(good.dueAt, '2026-07-20T08:00:00.000Z');

    const easy = progress.record('easy-card', 'easy', { now: '2026-07-19T08:00:00.000Z' });
    assert.equal(easy.lastGrade, 'easy');
    assert.equal(easy.intervalDays, 2);
    assert.equal(easy.dueAt, '2026-07-21T08:00:00.000Z');
}

{
    const storage = createStorage();
    const progress = loadProgress(storage, () => 'profile-a');
    const first = progress.record('idempotent-card', 'good', {
        reviewId: 'review-1',
        now: '2026-07-19T08:00:00.000Z',
        responseMode: 'recall',
        responseMs: 1800
    });
    const duplicate = progress.record('idempotent-card', 'good', {
        reviewId: 'review-1',
        now: '2026-07-19T08:01:00.000Z',
        responseMode: 'recall',
        responseMs: 2000
    });
    assert.equal(first.eventPersisted, true);
    assert.equal(duplicate.duplicate, true, 'retrying a reviewId must not increment progress twice');
    assert.equal(progress.get('idempotent-card').seen, 1);
    assert.equal(progress.readReviewEvents().filter(event => event.reviewId === 'review-1').length, 1);
}

{
    const storage = createStorage();
    const progress = loadProgress(storage, () => 'profile-a');
    progress.record('apple', 'again', { reviewId: 'report-1', now: '2026-07-19T08:00:00.000Z', responseMode: 'recall', responseMs: 4200 });
    progress.record('apple', 'good', { reviewId: 'report-2', now: '2026-07-20T08:00:00.000Z', responseMode: 'recall', responseMs: 2200 });
    progress.record('stone', 'hard', { reviewId: 'report-3', now: '2026-07-20T09:00:00.000Z', responseMode: 'scene', responseMs: 5300 });
    const report = progress.reviewStats([
        { id: 'apple', word: 'apple', translation: '苹果' },
        { id: 'stone', word: 'stone', translation: '石头' }
    ], { now: '2026-07-20T12:00:00.000Z', days: 7 });
    assert.equal(report.totalReviews, 3);
    assert.equal(report.correct, 2);
    assert.equal(report.accuracy, 67);
    assert.equal(report.daily.length, 7);
    assert.equal(report.byMode.recall.reviews, 2);
    assert.equal(report.weakCards[0].cardId, 'apple');
}

{
    const reviewEventsKey = 'petbank_learning_vocab_review_events_profile-a';
    const storage = createStorage({}, [reviewEventsKey]);
    const progress = loadProgress(storage, () => 'profile-a');
    const result = progress.record('event-write-failure', 'good', { reviewId: 'partial-1', now: '2026-07-19T08:00:00.000Z' });
    assert.equal(result.persisted, true, 'progress itself remains persisted');
    assert.equal(result.eventPersisted, false, 'event persistence failure must be observable');
    assert.equal(result.partial, true);
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
    progress.record('event-a', 'good', { reviewId: 'profile-event-a', now: '2026-07-19T08:00:00.000Z' });
    activeId = 'profile-b';
    progress.record('apple', true);
    assert.equal(progress.readReviewEvents().some(event => event.reviewId === 'profile-event-a'), false, 'B must not read A review events');
    progress.record('event-b', 'good', { reviewId: 'profile-event-b', now: '2026-07-19T08:00:00.000Z' });

    assert.equal(progress.get('apple').streak, 1, 'B must not receive A streak');
    assert.equal(JSON.parse(storage.dump(progressKey('profile-a'))).apple.streak, 2);
    assert.equal(JSON.parse(storage.dump(progressKey('profile-b'))).apple.streak, 1);
    activeId = 'profile-a';
    assert.equal(progress.readReviewEvents().some(event => event.reviewId === 'profile-event-a'), true, 'A review events remain isolated');
    assert.equal(progress.readReviewEvents().some(event => event.reviewId === 'profile-event-b'), false, 'A must not read B review events');

    activeId = 'profile-b';
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
