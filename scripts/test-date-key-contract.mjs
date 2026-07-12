import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const walk = fs.readFileSync('js/walk.js', 'utf8');
const arena = fs.readFileSync('js/card-arena-ui.js', 'utf8');
const treasure = fs.readFileSync('js/treasure.js', 'utf8');

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
