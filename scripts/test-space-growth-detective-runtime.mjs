import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/space-growth-detective.js', 'utf8');
const data = new Map();
const context = {
  console,
  URLSearchParams,
  location: { hostname: '127.0.0.1', search: '?story_test=space-growth-detective' },
  localStorage: {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, value); },
    removeItem(key) { data.delete(key); }
  },
  globalThis: null
};
context.globalThis = context;
vm.runInNewContext(source, context, { filename: 'js/space-growth-detective.js' });

const runtime = context.SpaceGrowthDetective;
assert.ok(runtime, 'story map runtime is exposed');
assert.equal(runtime.isTestMode(), true, 'test mode is local-host only and query-gated');
const hostCollection = (value) => JSON.parse(JSON.stringify(value));
assert.deepEqual(hostCollection(runtime.readCollection('child-a')), { cards: [], badges: [] });

const first = runtime.claimCollectibles('child-a', { cardId: 'energy-stardust', badgeId: 'energy-scout' });
assert.equal(first.accepted, true, 'first story collectible claim is accepted');
assert.deepEqual(hostCollection(runtime.readCollection('child-a')), { cards: ['energy-stardust'], badges: ['energy-scout'] });

const duplicate = runtime.claimCollectibles('child-a', { cardId: 'energy-stardust', badgeId: 'energy-scout' });
assert.equal(duplicate.accepted, false, 'duplicate story collectible claim is rejected');
assert.equal(duplicate.duplicate, true);
assert.deepEqual(hostCollection(runtime.readCollection('child-b')), { cards: [], badges: [] }, 'collections are profile scoped');

runtime.resetCollection('child-a');
assert.deepEqual(hostCollection(runtime.readCollection('child-a')), { cards: [], badges: [] });
console.log('PASS space growth detective runtime contract');
