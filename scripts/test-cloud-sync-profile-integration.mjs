import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const outboxSource = fs.readFileSync('js/cloud-sync-outbox.js', 'utf8');
const profilesSource = fs.readFileSync('js/profiles.js', 'utf8');

function createStorage(initial) {
    const data = new Map(Object.entries(initial));
    return {
        get length() { return data.size; },
        key(index) { return [...data.keys()][index] ?? null; },
        getItem(key) { return data.has(key) ? data.get(key) : null; },
        setItem(key, value) { data.set(key, String(value)); },
        removeItem(key) { data.delete(key); },
    };
}

function createHarness(api, consoleObject = console) {
    const storage = createStorage({
        petbank_profiles_meta: JSON.stringify([
            { id: 'profile-a', name: 'A', emoji: 'A', createdAt: 1, cloudChildId: 'child-a' },
        ]),
        petbank_active_profile: 'profile-a',
        petbank_points: '12',
    });
    const window = {
        SelfHostedApi: api,
        location: {
            href: 'https://example.test/pet-bank/',
            origin: 'https://example.test',
            pathname: '/pet-bank/',
            replace(url) { this.replaced = url; this.href = url; },
        },
        addEventListener() {},
    };
    const document = {
        baseURI: window.location.href,
        visibilityState: 'visible',
        addEventListener() {},
    };
    const context = {
        window,
        document,
        localStorage: storage,
        JSON,
        Date,
        URL,
        Set,
        Map,
        Object,
        Promise,
        console: consoleObject,
    };
    vm.runInNewContext(outboxSource, context, { filename: 'js/cloud-sync-outbox.js' });
    vm.runInNewContext(profilesSource, context, { filename: 'js/profiles.js' });
    return { storage, window, profiles: window.ProfileManager, outbox: window.PetBankCloudSyncOutbox };
}

async function testNetworkFailureQueuesLatestSnapshot() {
    const api = {
        isSignedIn: () => true,
        listChildren: async () => ({ children: [] }),
        pushSnapshot: async () => {
            const error = new Error('offline');
            error.code = 'NETWORK_ERROR';
            throw error;
        },
    };
    const { profiles, outbox, storage } = createHarness(api, { warn() {} });

    const result = await profiles.syncActiveToCloud();
    assert.equal(result.queued, true);
    const entry = outbox.get(storage, 'profile-a:child-a');
    assert.equal(entry.status, 'pending');
    assert.deepEqual(entry.payload, { petbank_points: '12' });
    assert.equal(Object.hasOwn(profiles.getProfileSnapshot('profile-a'), outbox.KEY), false);
}

async function testRetrySuccessRemovesEntryAndUpdatesRevision() {
    let pushes = 0;
    const api = {
        isSignedIn: () => true,
        listChildren: async () => ({ children: [] }),
        pushSnapshot: async () => {
            pushes += 1;
            return { snapshot: { revision: 3, payload: { petbank_points: '12' } } };
        },
    };
    const { profiles, outbox, storage } = createHarness(api, { warn() {} });
    outbox.upsert(storage, {
        id: 'profile-a:child-a',
        profileId: 'profile-a',
        childId: 'child-a',
        revision: 3,
        payload: { petbank_points: '12' },
        nextAttemptAt: 0,
    });

    const result = await profiles.flushCloudOutbox();
    assert.equal(pushes, 1);
    assert.equal(result[0].status, 'synced');
    assert.equal(outbox.get(storage, 'profile-a:child-a'), null);
    assert.equal(profiles.get('profile-a').cloudRevision, 3);
}

async function testStalePendingRevisionAdvancesFromKnownCloudRevision() {
    let pushedRevision = 0;
    const api = {
        isSignedIn: () => true,
        listChildren: async () => ({ children: [] }),
        pushSnapshot: async (_childId, revision, payload) => {
            pushedRevision = revision;
            assert.equal(payload.petbank_points, '12');
            return { snapshot: { revision, payload } };
        },
    };
    const { profiles, outbox, storage } = createHarness(api);
    outbox.upsert(storage, {
        id: 'profile-a:child-a',
        profileId: 'profile-a',
        childId: 'child-a',
        revision: 1,
        payload: { petbank_points: '12' },
        nextAttemptAt: 0,
    });
    storage.setItem('petbank_profiles_meta', JSON.stringify([
        { id: 'profile-a', name: 'A', emoji: 'A', createdAt: 1, cloudChildId: 'child-a', cloudRevision: 1 },
    ]));

    const result = await profiles.syncActiveToCloud();
    assert.equal(pushedRevision, 2);
    assert.equal(result.revision, 2);
    assert.equal(outbox.get(storage, 'profile-a:child-a'), null);
}

async function testConflictRemainsPersistedWhenRemoteReadFails() {
    const api = {
        isSignedIn: () => true,
        listChildren: async () => ({ children: [] }),
        pushSnapshot: async () => {
            const error = new Error('revision conflict');
            error.code = 'SNAPSHOT_REVISION_CONFLICT';
            throw error;
        },
        latestSnapshot: async () => { throw new Error('remote unavailable'); },
    };
    const { profiles, outbox, storage } = createHarness(api, { warn() {} });

    await assert.rejects(() => profiles.syncActiveToCloud(), { code: 'SNAPSHOT_REVISION_CONFLICT' });
    const entry = outbox.get(storage, 'profile-a:child-a');
    assert.equal(entry.status, 'conflict');
    assert.equal(entry.revision, 1);
    assert.deepEqual(entry.payload, { petbank_points: '12' });
}

function seedConflict(outbox, storage) {
    outbox.upsert(storage, {
        id: 'profile-a:child-a',
        profileId: 'profile-a',
        childId: 'child-a',
        revision: 2,
        payload: { petbank_points: '12' },
        status: 'conflict',
        attempts: 1,
        nextAttemptAt: 0,
        remoteRevision: 4,
    });
}

async function testConflictCanUseRemoteSnapshot() {
    const api = {
        isSignedIn: () => true,
        listChildren: async () => ({ children: [] }),
        latestSnapshot: async () => ({ snapshot: { revision: 4, payload: { petbank_points: '5' } } }),
    };
    const { profiles, outbox, storage, window } = createHarness(api);
    seedConflict(outbox, storage);

    const result = await profiles.resolveCloudConflict('profile-a', 'remote');
    assert.equal(result.status, 'resolved');
    assert.equal(result.choice, 'remote');
    assert.equal(storage.getItem('petbank_points'), '5');
    assert.equal(outbox.get(storage, 'profile-a:child-a'), null);
    assert.equal(profiles.get('profile-a').cloudRevision, 4);
    assert.ok(window.location.replaced, 'using the remote snapshot reloads the app shell');
}

async function testVocabConflictAutoMergesAcrossDevices() {
    let pushes = 0;
    const api = {
        isSignedIn: () => true,
        listChildren: async () => ({ children: [] }),
        pushSnapshot: async (_childId, revision, payload) => {
            pushes += 1;
            if (pushes === 1) {
                const error = new Error('revision conflict');
                error.code = 'SNAPSHOT_REVISION_CONFLICT';
                throw error;
            }
            assert.equal(revision, 5);
            assert.ok(payload.petbank_learning_vocab_progress_profile_a.includes('block'));
            assert.ok(payload.petbank_learning_vocab_progress_profile_a.includes('world'));
            const calibration = JSON.parse(payload.petbank_learning_vocab_scheduler_calibration_profile_a);
            assert.equal(calibration.sampleSize, 2, 'calibration should use the deduplicated review union');
            assert.equal(calibration.observedRetention, 1, 'calibration retention should be recomputed from merged reviews');
            assert.equal(calibration.calibrated, false, 'calibration should remain insufficient below the review threshold');
            assert.equal(calibration.parametersReady, false, 'merged calibration must not claim fitted parameters');
            return { snapshot: { revision, payload } };
        },
        latestSnapshot: async () => ({
            snapshot: {
                revision: 4,
                payload: {
                    petbank_points: '12',
                    petbank_learning_vocab_progress_profile_a: JSON.stringify({
                        stone: { seen: 3, correct: 3, wrong: 0, status: 'mastered', updatedAt: '2026-07-21T08:00:00.000Z' },
                        world: { seen: 1, correct: 1, wrong: 0, status: 'learning', updatedAt: '2026-07-21T08:00:00.000Z' }
                    }),
                    petbank_learning_vocab_review_events_profile_a: JSON.stringify([
                        { reviewId: 'remote-review', cardId: 'world', grade: 'good', reviewedAt: '2026-07-21T08:00:00.000Z' }
                    ]),
                    petbank_learning_vocab_scheduler_calibration_profile_a: JSON.stringify({
                        version: 1,
                        algorithm: 'fsrs-5',
                        sampleSize: 1,
                        observedRetention: 1,
                        targetRetention: 0.9,
                        calibrated: false,
                        confidence: 'insufficient',
                        minimumReviews: 20,
                        updatedAt: '2026-07-21T08:00:01.000Z'
                    })
                }
            }
        })
    };
    const { profiles, outbox, storage } = createHarness(api);
    storage.setItem('petbank_learning_vocab_progress_profile_a', JSON.stringify({
        stone: { seen: 2, correct: 2, wrong: 0, status: 'learning', updatedAt: '2026-07-20T08:00:00.000Z' },
        block: { seen: 1, correct: 1, wrong: 0, status: 'learning', updatedAt: '2026-07-20T08:00:00.000Z' }
    }));
    storage.setItem('petbank_learning_vocab_review_events_profile_a', JSON.stringify([
        { reviewId: 'local-review', cardId: 'block', grade: 'good', reviewedAt: '2026-07-20T08:00:00.000Z' }
    ]));
    storage.setItem('petbank_learning_vocab_scheduler_calibration_profile_a', JSON.stringify({
        version: 1,
        algorithm: 'fsrs-5',
        sampleSize: 1,
        observedRetention: 1,
        targetRetention: 0.9,
        calibrated: false,
        confidence: 'insufficient',
        minimumReviews: 20,
        updatedAt: '2026-07-20T08:00:01.000Z'
    }));

    const result = await profiles.syncActiveToCloud();
    assert.equal(result.status, 'auto-merged');
    assert.equal(pushes, 2);
    assert.equal(outbox.get(storage, 'profile-a:child-a'), null);
    assert.equal(profiles.get('profile-a').cloudRevision, 5);
}

async function testConflictCanKeepLocalAsNextRevision() {
    let pushedRevision = 0;
    const api = {
        isSignedIn: () => true,
        listChildren: async () => ({ children: [] }),
        latestSnapshot: async () => ({ snapshot: { revision: 4, payload: { petbank_points: '5' } } }),
        pushSnapshot: async (_childId, revision, payload) => {
            pushedRevision = revision;
            assert.deepEqual(payload, { petbank_points: '12' });
            return { snapshot: { revision, payload } };
        },
    };
    const { profiles, outbox, storage } = createHarness(api);
    seedConflict(outbox, storage);

    const result = await profiles.resolveCloudConflict('profile-a', 'local');
    assert.equal(result.status, 'synced');
    assert.equal(pushedRevision, 5);
    assert.equal(outbox.get(storage, 'profile-a:child-a'), null);
    assert.equal(storage.getItem('petbank_points'), '12');
}

async function testConflictCanBeExportedWithoutMutation() {
    const api = {
        isSignedIn: () => true,
        listChildren: async () => ({ children: [] }),
    };
    const { profiles, outbox, storage } = createHarness(api);
    seedConflict(outbox, storage);

    const exported = profiles.getCloudConflictExport('profile-a');
    assert.equal(exported.profileId, 'profile-a');
    assert.deepEqual(exported.payload, { petbank_points: '12' });
    assert.equal(outbox.get(storage, 'profile-a:child-a').status, 'conflict');
}

await testNetworkFailureQueuesLatestSnapshot();
await testRetrySuccessRemovesEntryAndUpdatesRevision();
await testStalePendingRevisionAdvancesFromKnownCloudRevision();
await testConflictRemainsPersistedWhenRemoteReadFails();
await testConflictCanUseRemoteSnapshot();
await testVocabConflictAutoMergesAcrossDevices();
await testConflictCanKeepLocalAsNextRevision();
await testConflictCanBeExportedWithoutMutation();

console.log('PASS cloud sync profile integration');
