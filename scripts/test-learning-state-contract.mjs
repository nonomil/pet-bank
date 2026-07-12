import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/learn-center.js', 'utf8');

function createHarness(failKey = '') {
  const values = new Map();
  let points = 0;
  const localStorage = {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      if (failKey && key === failKey) throw new Error(`write blocked: ${key}`);
      values.set(key, String(value));
    }
  };
  const window = {
    PetBankTime: { localDate: () => '2026-07-13' },
    PetBankPoints: { add: (amount) => { points += amount; return points; } }
  };
  vm.runInNewContext(source, {
    window,
    globalThis: window,
    localStorage,
    console: { warn() {} },
    Date,
    fetch: async () => ({ ok: false }),
    setTimeout,
    clearTimeout
  });
  return { learn: window.LearnCenter, localStorage, getPoints: () => points };
}

const harness = createHarness();
const first = harness.learn.completeLesson('pack-a', 'module-a', 'lesson-1', 2);
assert.equal(first.persisted, true);
assert.equal(first.totalPoints, 2);
assert.equal(harness.getPoints(), 2);
assert.match(harness.localStorage.getItem('petbank_learning_progress'), /lesson-1/);
assert.match(harness.localStorage.getItem('petbank_learning_rewards'), /pack-a:module-a:lesson-1/);

const repeat = harness.learn.completeLesson('pack-a', 'module-a', 'lesson-1', 2);
assert.equal(repeat.persisted, true);
assert.equal(repeat.totalPoints, 0);
assert.equal(harness.getPoints(), 2);

const failed = createHarness('petbank_learning_progress');
const failedResult = failed.learn.completeLesson('pack-b', 'module-b', 'lesson-1', 5);
assert.equal(failedResult.persisted, false);
assert.equal(failed.getPoints(), 0);
assert.equal(failed.localStorage.getItem('petbank_learning_rewards'), null);

const failedReward = createHarness('petbank_learning_rewards');
const failedRewardResult = failedReward.learn.completeLesson('pack-c', 'module-c', 'lesson-1', 5);
assert.equal(failedRewardResult.persisted, false);
assert.equal(failedReward.getPoints(), 0);
assert.doesNotMatch(failedReward.localStorage.getItem('petbank_learning_progress') || '', /pack-c/);

console.log('PASS learning state contract');
