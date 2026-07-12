import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const loader = fs.readFileSync(path.join(root, 'js', 'runtime-loader.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'js', 'core-reward-service.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const math = fs.readFileSync(path.join(root, 'js', 'math-pk.js'), 'utf8');
const hanzi = fs.readFileSync(path.join(root, 'js', 'hanzi-game.js'), 'utf8');
const claimSource = loader.match(/function claimGameRewardReceipt[\s\S]*?window\.GameRewardReceipts/)?.[0] || '';

assert.match(loader, /GAME_REWARD_RECEIPT_KEY/, 'runtime loader should define persistent reward receipts');
assert.match(loader, /window\.GameRewardReceipts/, 'runtime loader should expose the receipt service before app.js');
assert.match(loader, /profileId.*source.*eventId/s, 'receipt identity should include profile, source, and event id');
assert.match(loader, /amount <= 0|points <= 0/, 'receipt service should reject non-positive grants');
assert.match(claimSource, /rewards:\s*\[\s*\{\s*type:\s*'growth_points'/, 'game receipt should apply growth points through the core reward service');
assert.match(app, /GameRewardReceipts\.claim/, 'host bridge should claim receipts before game points are granted');
assert.match(math, /GameRewardReceipts\.claim/, 'math PK should claim a persistent receipt before awarding points');
assert.match(hanzi, /GameRewardReceipts\.claim/, 'hanzi game should claim a persistent receipt before awarding points');

const typingHandler = app.match(/if \(data\.kind === 'reward'\)[\s\S]*?\n\}\n\nwindow\.addEventListener\('message', handleTypingDefenseBridgeMessage\)/)?.[0] || '';
const wordMemoryHandler = app.match(/if \(data\.kind !== 'result'\) return;[\s\S]*?\n\}\n\nwindow\.addEventListener\('message', handleWordMemoryMapBridgeMessage\)/)?.[0] || '';
assert.doesNotMatch(typingHandler, /addGrowthPoints\(points\)/, 'typing defense must not add points after the receipt service');
assert.doesNotMatch(wordMemoryHandler, /addGrowthPoints\(points\)/, 'word memory map must not add points after the receipt service');
assert.doesNotMatch(math, /if \(receipt\.accepted && typeof window\.addGrowthPoints === 'function'\) \{[\s\S]*?window\.addGrowthPoints\(earnedPoints\);/, 'math PK must not add points after the receipt service');

const values = new Map();
const pointCalls = [];
const expCalls = [];
const storage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
};
const window = {
  localStorage: storage,
  PetBankPoints: { add(amount) { pointCalls.push(amount); } },
  PetSystem: {
    state: { exp: 0, level: 1, intimacy: 0, stage: { name: '蛋' } },
    getState() { return { ...this.state }; },
    addExp(amount) { expCalls.push(amount); this.state.exp += amount; },
  },
  location: { href: 'https://example.test/' },
  setTimeout() {},
};
const document = {
  currentScript: { src: 'https://example.test/js/runtime-loader.js' },
  scripts: [],
  baseURI: 'https://example.test/',
  querySelectorAll() { return []; },
};
const context = { console, Date, JSON, Math, Map, Object, Promise, Set, String, Number, Array, URL, window, document, localStorage: storage, globalThis: window };
vm.runInNewContext(core, context, { filename: 'js/core-reward-service.js' });
vm.runInNewContext(loader, context, { filename: 'js/runtime-loader.js' });
const first = window.GameRewardReceipts.claim({ profileId: 'p1', source: 'demo', eventId: 'round-1', points: 12 });
const second = window.GameRewardReceipts.claim({ profileId: 'p1', source: 'demo', eventId: 'round-1', points: 12 });
assert.equal(first.accepted, true);
assert.equal(second.accepted, false);
assert.deepEqual(pointCalls, [12], 'one game event should apply growth points once');
assert.deepEqual(expCalls, [12], 'one game event should apply pet exp once');

const pointsApi = window.PetBankPoints;
window.PetBankPoints = null;
const unavailable = window.GameRewardReceipts.claim({ profileId: 'p1', source: 'demo', eventId: 'round-2', points: 8 });
assert.equal(unavailable.accepted, false);
assert.equal(unavailable.reason, 'unavailable');
window.PetBankPoints = pointsApi;
assert.deepEqual(pointCalls, [12], 'unavailable points API must not write a receipt or add points');

console.log('PASS game reward receipt contract');
