import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = await fs.readFile(path.join(root, 'js', 'cloud-sync-outbox.js'), 'utf8');
const window = {};
vm.runInNewContext(source, { window, globalThis: window });

const values = new Map();
const storage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); },
};
const outbox = window.PetBankCloudSyncOutbox;

assert.ok(outbox, 'cloud sync outbox should be exposed');
assert.equal(outbox.list(storage).length, 0);
assert.equal(outbox.upsert(storage, { id: 'p1:child1', profileId: 'p1', childId: 'child1', revision: 1, payload: { points: 1 } }), true);
assert.equal(JSON.stringify(outbox.get(storage, 'p1:child1').payload), JSON.stringify({ points: 1 }));
assert.equal(outbox.upsert(storage, { id: 'p1:child1', profileId: 'p1', childId: 'child1', revision: 2, payload: { points: 2 } }), true);
assert.equal(outbox.list(storage).length, 1, 'one child should have one coalesced pending snapshot');
assert.equal(outbox.get(storage, 'p1:child1').revision, 2);
assert.equal(outbox.remove(storage, 'p1:child1'), true);
assert.equal(outbox.list(storage).length, 0);

console.log('PASS cloud sync outbox storage contract');
