import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/core-reward-service.js', 'utf8');
const data = new Map();
const context = {
  console,
  Date,
  globalThis: null,
  localStorage: {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, value); }
  },
  addGrowthPoints() {},
  PetSystem: {
    state: { exp: 20, level: 1, intimacy: 0, stage: { name: '蛋' } },
    getState() { return { ...this.state, stage: { ...this.state.stage } }; },
    addExp(amount) {
      this.state.exp += amount;
      if (this.state.exp >= 30) {
        this.state.exp -= 30;
        this.state.level = 2;
        this.state.stage = { name: '幼崽' };
      }
    },
    addIntimacy(amount) { this.state.intimacy += amount; }
  }
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: 'js/core-reward-service.js' });

const result = context.CoreRewardService.claim({
  eventId: 'game:level-up:1',
  source: 'game',
  sourceId: 'demo-game',
  rewards: [
    { type: 'pet_exp', amount: 15 },
    { type: 'intimacy', amount: 4 }
  ]
});

assert.equal(result.accepted, true);
assert.equal(result.petExpApplied, 15);
assert.equal(result.leveledUp, true);
assert.equal(result.evolutionChanged, true);
assert.equal(result.petAfter.intimacy, 4);
console.log('pet growth feedback tests passed');
