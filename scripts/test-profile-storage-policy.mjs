import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const policySource = fs.readFileSync('js/profile-storage-policy.js', 'utf8');
const profilesSource = fs.readFileSync('js/profiles.js', 'utf8');

function createStorage(initial) {
  const data = new Map(Object.entries(initial));
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}

const storage = createStorage({
  petbank_profiles_meta: JSON.stringify([
    { id: 'profile-a', name: 'A', emoji: 'A', createdAt: 1 },
    { id: 'profile-b', name: 'B', emoji: 'B', createdAt: 2 }
  ]),
  petbank_active_profile: 'profile-a',
  petbank_points: '12',
  petbank_sfx_volume: '0.4',
  'petbank_profile_data_profile-b': JSON.stringify({
    petbank_points: '3',
    petbank_sfx_volume: '0.9'
  })
});
const window = { location: { href: 'https://example.test/pet-bank/' } };
const context = vm.createContext({
  window,
  document: { baseURI: window.location.href },
  localStorage: storage,
  JSON,
  Date,
  URL,
  Set,
  Object
});
vm.runInContext(policySource, context);
vm.runInContext(profilesSource, context);

const profiles = window.ProfileManager;
assert.deepEqual(Array.from(profiles._getBusinessKeys()).sort(), ['petbank_points']);
profiles._swapTo('profile-b', false);
assert.equal(storage.getItem('petbank_points'), '3');
assert.equal(storage.getItem('petbank_sfx_volume'), '0.4', 'device settings must survive profile switching');
assert.doesNotMatch(storage.getItem('petbank_profile_data_profile-a'), /sfx_volume/);

console.log('profile storage policy contract: PASS');
