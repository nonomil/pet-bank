import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/pet-story-cases.js', 'utf8');
const petSource = fs.readFileSync('js/pet.js', 'utf8');
assert.match(petSource, /pet_id/, 'pet state persists a stable instance identity');
assert.match(petSource, /state\.pet_id\s*=\s*createPetId\(\)/, 'choosing a pet creates a new instance identity');
const data = new Map();
const calls = [];
const context = {
  console,
  Date,
  globalThis: null,
  localStorage: {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, value); }
  },
  ProfileManager: { getActiveId: () => 'child-a' },
  PetSystem: {
    getState: () => ({ species: 'moon-cat', pet_id: 'pet-001', hunger: 20, hp: 80, happiness: 50, cleanliness: 70, intimacy: 10, level: 3, stage: { name: '幼崽' } }),
    feed: () => { calls.push('feed'); return { success: true }; },
    play: () => ({ success: false, msg: 'busy' })
  }
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: 'js/pet-story-cases.js' });

const cases = context.PetStoryCases;
assert.ok(cases, 'story case API exposed');
assert.equal(cases.getPetIdentity({ species: 'moon-cat', pet_id: 'pet-001' }), 'pet-001');
assert.equal(cases.getPetIdentity({ species: 'moon-cat' }), '', 'legacy pet without an instance identity cannot create a scoped case');

const clue = cases.resolveClue({
  source: 'pet.hunger',
  presentation: { bands: [
    { max: 30, id: 'needs-energy', label: '需要点心' },
    { max: 100, id: 'bright', label: '能量充足' }
  ] }
}, context.PetSystem.getState());
assert.equal(clue.available, true);
assert.equal(clue.id, 'needs-energy');
assert.equal(clue.label, '需要点心');

const caseInput = { storyId: 'space-growth-detective', caseId: 'energy-stardust', profileId: 'child-a', petIdentity: 'pet-001', selectedAnswerId: 'feed-first', resolution: 'care-action', summary: '已补给' };
assert.equal(cases.complete(caseInput).accepted, true, 'first completion is accepted');
assert.equal(cases.complete(caseInput).duplicate, true, 'same scoped receipt cannot complete twice');
assert.equal(cases.complete({ ...caseInput, petIdentity: 'pet-002' }).accepted, true, 'another pet has an independent case line');
assert.equal(cases.complete({ ...caseInput, profileId: 'child-b' }).accepted, true, 'another child has an independent case line');

assert.equal(cases.runCareAction({ id: 'feed', invoke: 'feed', options: {} }).success, true);
assert.deepEqual(calls, ['feed']);
assert.equal(cases.runCareAction({ id: 'play', invoke: 'play', options: {} }).success, false, 'failed pet action remains failed');
assert.equal(cases.runCareAction({ id: 'unsafe', invoke: 'save', options: {} }).success, false, 'action whitelist blocks arbitrary pet methods');

console.log('PASS pet story case state contract');
