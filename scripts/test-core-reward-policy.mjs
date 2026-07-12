import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/core-reward-service.js', 'utf8');
const data = new Map();
const calls = { points: [], exp: [], items: [] };
const context = {
  console,
  Date,
  globalThis: null,
  localStorage: {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, value); }
  },
  PetBankPoints: { add(amount) { calls.points.push(amount); } },
  PetSystem: {
    state: { exp: 0, level: 1, intimacy: 0, stage: { name: '蛋' } },
    getState() { return { ...this.state }; },
    addExp(amount) { this.state.exp += amount; if (this.state.exp >= 30) { this.state.level = 2; this.state.stage = { name: '蛋' }; } calls.exp.push(amount); },
    addIntimacy(amount) { this.state.intimacy += amount; }
  },
  InventorySystem: { addItem(id, amount) { calls.items.push({ id, amount }); } }
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: 'js/core-reward-service.js' });

const service = context.CoreRewardService;
assert.ok(service, 'service should be exposed');
const event = {
  eventId: 'task:demo:1',
  profileId: 'local',
  source: 'task',
  sourceId: 'demo',
  rewards: [
    { type: 'growth_points', amount: 10 },
    { type: 'pet_exp', amount: 5 },
    { type: 'item', itemId: 'apple', amount: 1 }
  ]
};
const first = service.claim(event);
assert.equal(first.accepted, true);
assert.equal(first.duplicate, false);
assert.deepEqual(calls.points, [10]);
assert.deepEqual(calls.exp, [5]);
assert.deepEqual(calls.items, [{ id: 'apple', amount: 1 }]);
assert.equal(first.petExpApplied, 5);

const second = service.claim(event);
assert.equal(second.accepted, false);
assert.equal(second.duplicate, true);
assert.deepEqual(calls.points, [10], 'duplicate must not add points');
assert.deepEqual(calls.exp, [5], 'duplicate must not add pet exp');

assert.throws(() => service.claim({ eventId: 'bad', source: 'unknown', rewards: [] }), /unsupported reward source/);
assert.throws(() => service.claim({ eventId: 'bad-amount', source: 'task', rewards: [{ type: 'growth_points', amount: -1 }] }), /non-negative/);
assert.equal(service.getHistory().length, 1);
console.log('core reward policy tests passed');
