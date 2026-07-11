import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/profiles.js', import.meta.url), 'utf8');

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

const storage = createStorage({
    petbank_profiles_meta: JSON.stringify([
        { id: 'profile-a', name: 'A', emoji: 'A', createdAt: 1 },
        { id: 'profile-b', name: 'B', emoji: 'B', createdAt: 2 },
    ]),
    petbank_active_profile: 'profile-a',
    petbank_points: '12',
    'petbank_profile_data_profile-b': JSON.stringify({ petbank_points: '3' }),
});
const window = { location: { href: 'https://example.test/pet-bank/' } };
const document = { baseURI: window.location.href };

vm.runInNewContext(source, { window, document, localStorage: storage, JSON, Date, URL, Set, Object });
const profiles = window.ProfileManager;

profiles._swapTo('profile-b', false);
assert.equal(profiles.getActiveId(), 'profile-b');
assert.equal(storage.getItem('petbank_points'), '3', 'B receives only its own snapshot');
assert.equal(JSON.parse(storage.getItem('petbank_profile_data_profile-a')).petbank_points, '12');

storage.setItem('petbank_points', '8');
profiles._swapTo('profile-a', false);
assert.equal(profiles.getActiveId(), 'profile-a');
assert.equal(storage.getItem('petbank_points'), '12', 'returning to A restores A without B changes');
assert.equal(JSON.parse(storage.getItem('petbank_profile_data_profile-b')).petbank_points, '8');

console.log('profile isolation journey simulation: PASS');
