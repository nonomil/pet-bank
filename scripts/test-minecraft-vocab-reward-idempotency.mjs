import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/minecraft-vocab-session.js', import.meta.url), 'utf8');
const values = new Map();
const storage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); }
};
const claimed = new Set();
const calls = [];
const window = {
    localStorage: storage,
    ProfileManager: { getActiveId: () => 'profile-a' },
    PetBankTime: { localDate: () => '2026-07-19' },
    GameRewardReceipts: {
        claim(event) {
            calls.push(event);
            if (claimed.has(event.eventId)) return { accepted: false, duplicate: true, event };
            claimed.add(event.eventId);
            return { accepted: true, duplicate: false, event };
        }
    }
};
vm.runInNewContext(source, { window, localStorage: storage, JSON, Date, console: { warn() {} } });
const session = window.MinecraftVocabSession;
let state = session.start([{ id: 'stone', category: 'block' }], () => ({ status: 'new' }), '2026-07-19', { queueSize: 1, levelId: 'kindergarten' }).state;
state = session.recordAction(state, 'stone').state;
assert.equal(session.isComplete(state), true);
const first = session.claimReward(state);
const second = session.claimReward(state);
assert.equal(first.accepted, true);
assert.equal(second.duplicate, true);
assert.equal(calls.length, 2);
assert.equal(calls[0].eventId, calls[1].eventId);
assert.equal(calls[0].points, 10);
assert.equal(calls[0].source, 'minecraft-vocab');
assert.notEqual(calls[0].eventId, '');
console.log('minecraft vocab reward idempotency: PASS');
