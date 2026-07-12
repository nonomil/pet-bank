import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const walk = fs.readFileSync('js/walk.js', 'utf8');
const arena = fs.readFileSync('js/card-arena-ui.js', 'utf8');
const treasure = fs.readFileSync('js/treasure.js', 'utf8');
const timeUtils = fs.readFileSync('js/time-utils.js', 'utf8');
const runtimeLoader = fs.readFileSync('js/runtime-loader.js', 'utf8');
const math = fs.readFileSync('js/math-pk.js', 'utf8');
const hanzi = fs.readFileSync('js/hanzi-game.js', 'utf8');

assert.match(timeUtils, /root\.PetBankTime/);
assert.match(timeUtils, /function localDate/);
assert.match(timeUtils, /function unixSeconds/);
assert.match(runtimeLoader, /getRewardLocalDate/);
assert.doesNotMatch(runtimeLoader, /toLocaleDateString\(\)/, 'game receipts must not create locale-dependent business dates');
assert.doesNotMatch(math, /new Date\(\)\.toLocaleDateString\(\)/, 'math rewards must not create locale-dependent business dates');
assert.doesNotMatch(hanzi, /new Date\(\)\.toLocaleDateString\(\)/, 'hanzi rewards must not create locale-dependent business dates');

const walkSummary = app.match(/function getWalkDaySummary[\s\S]*?function renderWalkPage/)?.[0] || '';
assert.doesNotMatch(walkSummary, /toDateString\(\)/, 'walk summary must use the shared local date key');
assert.match(walkSummary, /PetBankDailyState\.localDate\(\)/, 'walk summary must use PetBankDailyState.localDate');

assert.doesNotMatch(walk, /toDateString\(\)/, 'walk persistence must not use locale-dependent date strings');
assert.match(walk, /PetBankDailyState\.localDate\(\)/, 'walk persistence must use the shared local date key');

assert.doesNotMatch(arena, /toLocaleDateString\(['"]sv-SE['"]\)/, 'arena limits must not use locale formatting for business keys');
assert.match(arena, /PetBankDailyState\.localDate\(\)/, 'arena limits must use the shared local date key');

assert.match(treasure, /function getTodayKey\(\)/, 'treasure should centralize its current date lookup');
assert.match(treasure, /localStorage\.setItem\(DAILY_DATE_KEY, getTodayKey\(\)\)/, 'treasure should write the canonical date key');

console.log('PASS date key contract');
