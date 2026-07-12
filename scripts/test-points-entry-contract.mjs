import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const taskSource = app.match(/function toggleTask[\s\S]*?function renderTaskGrid/)?.[0] || '';
const recommendedSource = app.match(/function completeRecommended[\s\S]*?const HOME_TAB_MAP/)?.[0] || '';

assert.match(taskSource, /addGrowthPoints\(/, 'task completion should use the main points entry');
assert.doesNotMatch(taskSource, /totalPoints\s*[+\-]=/, 'task completion must not mutate the points balance directly');
assert.match(recommendedSource, /addGrowthPoints\(/, 'recommended tasks should use the main points entry');
assert.doesNotMatch(recommendedSource, /totalPoints\s*\+=/, 'recommended tasks must not mutate the points balance directly');

console.log('PASS points entry contract');
