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
        location: { href: 'https://example.test/pet-bank/', origin: 'https://example.test', pathname: '/pet-bank/' },
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

await testNetworkFailureQueuesLatestSnapshot();
await testRetrySuccessRemovesEntryAndUpdatesRevision();
await testConflictRemainsPersistedWhenRemoteReadFails();

console.log('PASS cloud sync profile integration');
