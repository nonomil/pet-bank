import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/pet-care-daily.js', 'utf8');
const data = new Map();
const context = {
  console,
  Date,
  globalThis: null,
  localStorage: {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, value); }
  }
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: 'js/pet-care-daily.js' });

const daily = context.PetCareDaily;
assert.ok(daily);
assert.equal(daily.getState().completed.length, 0);
assert.equal(daily.recordAction('feed').accepted, true);
assert.equal(daily.recordAction('feed').duplicate, true);
assert.equal(daily.getState().progress, 1);
assert.equal(daily.getNextAction({ hunger: 90, cleanliness: 10, happiness: 70, hp: 80 }).action, 'bath');
assert.equal(daily.recordAction('bath').accepted, true);
assert.equal(daily.recordAction('play').accepted, true);
assert.equal(daily.recordAction('rest').accepted, true);
assert.equal(daily.getState().complete, true);
assert.equal(daily.getNextAction({ hunger: 0, cleanliness: 0, happiness: 0, hp: 0 }), null);
console.log('pet care daily state tests passed');
