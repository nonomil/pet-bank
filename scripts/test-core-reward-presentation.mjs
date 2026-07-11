import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/core-reward-service.js', 'utf8');
const context = { console, Date, globalThis: null, localStorage: { getItem: () => null, setItem() {} } };
context.globalThis = context;
vm.runInNewContext(source, context, { filename: 'js/core-reward-service.js' });

const model = context.CoreRewardService.toPresentation({
  accepted: true,
  event: { eventId: 'game:1', rewards: [
    { type: 'growth_points', amount: 10 },
    { type: 'pet_exp', amount: 5 },
    { type: 'intimacy', amount: 2 },
    { type: 'item', itemId: 'apple', amount: 1 }
  ] },
  leveledUp: true,
  evolutionChanged: true,
  petAfter: { level: 2, stage: '幼崽' },
  nextAction: { action: 'play', label: '玩耍', reason: '陪宠物玩一会儿吧' }
});
assert.equal(model.accepted, true);
assert.equal(model.lines.length, 6);
assert.equal(model.lines.includes('成长分 +10'), true);
assert.equal(model.lines.includes('宠物升级到 Lv.2'), true);
assert.equal(model.nextAction.label, '玩耍');

const duplicate = context.CoreRewardService.toPresentation({
  accepted: false,
  duplicate: true,
  event: { eventId: 'game:1', rewards: [] }
});
assert.equal(duplicate.title, '奖励已领取');
assert.equal(duplicate.lines[0], '这份奖励已经领取过了');
console.log('core reward presentation tests passed');
