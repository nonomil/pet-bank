import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/family-review.js', 'utf8');
const runtimeLoader = fs.readFileSync('js/runtime-loader.js', 'utf8');
const context = {
  console,
  window: {},
  document: { getElementById() { return null; } },
  localStorage: {
    getItem() {
      return JSON.stringify([
        {
          mode: 'mathpk',
          cause: 'low_accuracy',
          note: '这局先保准确，再追速度。',
          nextStep: '下一局先慢读题，再确认符号。',
          timestamp: '2026-07-11T10:00:00.000Z'
        },
        {
          mode: 'mathpk',
          cause: 'low_accuracy',
          note: '还需要一点确认时间。',
          nextStep: '下一局先看符号，再算数字。',
          timestamp: '2026-07-10T10:00:00.000Z'
        },
        {
          mode: 'explore',
          cause: 'enemy_counter',
          note: '对手反击前没有留出恢复时间。',
          nextStep: '下一次先防御或回血，再继续攻击。',
          timestamp: '2026-07-09T10:00:00.000Z'
        }
      ]);
    }
  }
};

vm.runInNewContext(source, context, { filename: 'js/family-review.js' });

assert.equal(typeof context.window.FamilyReview.render, 'function');
assert.equal(typeof context.window.FamilyReview.refresh, 'function');
assert.match(
  runtimeLoader,
  /review:\s*\[\s*['"]js\/family-review\.js['"]\s*\]/,
  'runtime loader should declare the local review bundle'
);
assert.match(
  runtimeLoader,
  /case 'review':\s*return ensureReviewFeature\(\);/s,
  'review route should load the local review feature'
);

const insights = context.window.FamilyReview.buildGuidedInsights();
assert.equal(insights.hasData, true);
assert.equal(insights.title, '数学 PK 最近需要复盘');
assert.match(insights.detail, /准确/);
assert.equal(insights.nextStep, '下一局先慢读题，再确认符号。');
assert.equal(insights.items.length, 3);

const emptyInsights = context.window.FamilyReview.buildGuidedInsights([]);
assert.equal(emptyInsights.hasData, false);
assert.match(emptyInsights.nextStep, /完成一局/);

console.log('PASS growth_review_insights_contract');
