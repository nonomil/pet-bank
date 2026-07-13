import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/profiles.js', import.meta.url), 'utf8');
const outboxSource = fs.readFileSync(new URL('../js/cloud-sync-outbox.js', import.meta.url), 'utf8');

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

const timers = new Map();
let nextTimerId = 1;
const uploads = [];
const storage = createStorage({
    petbank_profiles_meta: JSON.stringify([{ id: 'profile-a', name: '小星', emoji: '🧒', createdAt: 1 }]),
    petbank_active_profile: 'profile-a',
    petbank_points: '12',
    petbank_pet: JSON.stringify({ species: 'cat', hp: 10 }),
});
const window = {
    location: { href: 'https://example.test/pet-bank/' },
    SelfHostedApi: {
        isSignedIn: () => true,
        listChildren: async () => ({ children: [{ id: 'child-a', localProfileId: 'profile-a' }] }),
        pushSnapshot: async (childId, revision, payload) => {
            uploads.push({ childId, revision, payload });
            return { snapshot: { childId, revision, payload } };
        },
    },
};
const document = { baseURI: window.location.href };

const context = {
    window,
    document,
    localStorage: storage,
    JSON,
    Date,
    URL,
    Set,
    Object,
    Math,
    Promise,
    console,
    setTimeout(callback, delay) {
        const id = nextTimerId++;
        timers.set(id, { callback, delay });
        return id;
    },
    clearTimeout(id) { timers.delete(id); },
};
vm.runInNewContext(outboxSource, context);
vm.runInNewContext(source, context);

const profiles = window.ProfileManager;
profiles.linkCloudChild('profile-a', 'child-a', 'household-a');
const first = profiles.requestHighPrioritySync('points');
const second = profiles.requestHighPrioritySync('pet');

assert.equal(first.scheduled, true, 'a linked profile should schedule high-priority sync');
assert.equal(second.scheduled, true, 'a later state change should reuse the pending sync');
assert.equal(timers.size, 1, 'multiple changes in the debounce window should schedule one upload');
const timer = [...timers.values()][0];
assert.ok(timer.delay >= 500, 'sync should be asynchronous and debounced');

await profiles.syncActiveToCloud();
assert.equal(timers.size, 0, 'manual lifecycle sync should cancel a pending debounce timer');
assert.equal(uploads.length, 1, 'the scheduled sync should upload one snapshot');
assert.equal(uploads[0].childId, 'child-a');
assert.equal(uploads[0].payload.petbank_points, '12');
assert.deepEqual(JSON.parse(uploads[0].payload.petbank_pet), { species: 'cat', hp: 10 });

window.SelfHostedApi.pushSnapshot = async () => {
    const error = new Error('offline');
    error.code = 'NETWORK_ERROR';
    throw error;
};
const offline = profiles.requestHighPrioritySync('points');
assert.equal(offline.scheduled, true);
const offlineTimer = [...timers.values()][0];
await offlineTimer.callback();
const queued = window.PetBankCloudSyncOutbox.get(storage, 'profile-a:child-a');
assert.equal(queued.status, 'pending', 'automatic sync failures should use the existing offline outbox');
assert.equal(queued.lastError, 'offline');

console.log('high priority state sync contract: PASS');
