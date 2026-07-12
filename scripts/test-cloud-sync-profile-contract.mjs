import assert from 'node:assert/strict';
import fs from 'node:fs';

const profiles = fs.readFileSync('js/profiles.js', 'utf8');

assert.match(profiles, /PetBankCloudSyncOutbox/, 'profiles should use the persistent cloud outbox');
assert.match(profiles, /flushCloudOutbox/, 'profiles should expose an outbox flush operation');
assert.match(profiles, /status: 'conflict'/, 'revision conflicts should remain visible in the outbox');
assert.match(profiles, /nextAttemptAt/, 'outbox entries should carry a retry schedule');
assert.match(profiles, /addEventListener\('online'/, 'online events should trigger outbox retries');
assert.match(profiles, /queueCloudSnapshot/, 'network failures should queue the latest local snapshot');

console.log('PASS cloud sync profile contract');
