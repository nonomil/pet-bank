import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadRegistry,
  scanLocalStorageKeys,
} from './audit-localstorage-registry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function loadStorageMigrations() {
  const source = await fs.readFile(path.join(ROOT, 'js', 'storage-key-migrations.js'), 'utf8');
  const window = {};
  vm.runInNewContext(source, { window, globalThis: window });
  return window.PetBankStorageMigrations;
}

async function loadProfileStoragePolicy() {
  const source = await fs.readFile(path.join(ROOT, 'js', 'profile-storage-policy.js'), 'utf8');
  const window = {};
  vm.runInNewContext(source, { window });
  return window.PetBankProfileStoragePolicy;
}

async function readSource(relativePath) {
  return fs.readFile(path.join(ROOT, relativePath), 'utf8');
}

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test('registry declares storage ownership and scope for every static key', async () => {
  const registry = await loadRegistry();
  assert.equal(registry.version, 1);
  assert.ok(registry.entries.length >= 60);

  for (const entry of registry.entries) {
    assert.match(entry.pattern, /\S/);
    assert.match(entry.owner, /\S/);
    assert.ok(['profile', 'device', 'global', 'parent', 'legacy'].includes(entry.scope));
    assert.equal(typeof entry.snapshot, 'boolean');
  }
});

test('runtime profile policy matches every explicit non-profile registry entry', async () => {
  const registry = await loadRegistry();
  const policy = await loadProfileStoragePolicy();
  const expected = registry.entries
    .filter((entry) => entry.scope !== 'profile' && entry.pattern.startsWith('petbank_'))
    .map((entry) => entry.pattern)
    .sort();
  assert.deepEqual(Array.from(policy.getNonProfilePatterns()).sort(), expected);
  assert.equal(policy.shouldSnapshot('petbank_points'), true);
  assert.equal(policy.shouldSnapshot('petbank_new_future_key'), true);
  assert.equal(policy.shouldSnapshot('petbank_sfx_volume'), false);
  assert.equal(policy.shouldSnapshot('petbank_self_hosted_access_token'), false);
});

test('source scan has no unregistered localStorage keys', async () => {
  const report = await scanLocalStorageKeys();
  assert.deepEqual(report.unknown, [], `unregistered keys:\n${report.unknown.join('\n')}`);
});

test('card storage has one owner and arena uses its public read API', async () => {
  const collection = await readSource(path.join('js', 'card-collection.js'));
  const arena = await readSource(path.join('js', 'card-arena-ui.js'));
  assert.match(collection, /function getCollectedIds\(\)/);
  assert.match(collection, /return _cards\.slice\(\)/);
  assert.doesNotMatch(arena, /localStorage\.getItem\(['"]petbank_cards['"]\)/);
  assert.match(arena, /CardCollection\.getCollectedIds\(\)/);
});

test('legacy storage value migrates to the registered key exactly once', async () => {
  const migrations = await loadStorageMigrations();
  const storage = createStorage({ legacy_key: '{"value":42}' });

  assert.equal(migrations.migrateKey(storage, 'legacy_key', 'current_key'), true);
  assert.equal(storage.getItem('current_key'), '{"value":42}');
  assert.equal(storage.getItem('legacy_key'), null);
  assert.equal(migrations.migrateKey(storage, 'legacy_key', 'current_key'), false);
});

test('legacy storage value never overwrites an existing current value', async () => {
  const migrations = await loadStorageMigrations();
  const storage = createStorage({ legacy_key: 'old', current_key: 'new' });

  assert.equal(migrations.migrateKey(storage, 'legacy_key', 'current_key'), false);
  assert.equal(storage.getItem('current_key'), 'new');
  assert.equal(storage.getItem('legacy_key'), null);
});
