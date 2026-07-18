import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const source = fs.readFileSync(path.join(process.cwd(), 'js', 'scheduled-checkins.js'), 'utf8');

function createStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        getItem(key) { return data.has(key) ? data.get(key) : null; },
        setItem(key, value) { data.set(key, String(value)); },
        dump() { return Object.fromEntries(data); }
    };
}

function loadRuntime({ storage = createStorage(), profileId = 'p_one', points = [] } = {}) {
    const window = {
        localStorage: storage,
        ProfileManager: { getActiveId: () => profileId },
        PetBankTime: { localDate: (value) => {
            const date = value == null ? new Date('2026-07-18T11:30:00') : new Date(value);
            return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        } },
        CoreRewardService: {
            claim(event) {
                const duplicate = points.some((item) => item.eventId === event.eventId);
                if (duplicate) return { accepted: false, duplicate: true, event };
                points.push(event);
                return { accepted: true, duplicate: false, event };
            }
        },
        PetBankPoints: { add() {} }
    };
    window.window = window;
    const context = vm.createContext({ window, globalThis: window, localStorage: storage, Date, console });
    vm.runInContext(source, context, { filename: 'js/scheduled-checkins.js' });
    return { api: window.ScheduledCheckins, storage, points };
}

test('provides a summer schedule with active, upcoming, and missed windows', () => {
    const { api } = loadRuntime();
    const items = api.getToday({ now: '2026-07-18T11:30:00' });

    assert.ok(items.some((item) => item.id === 'think-english' && item.status === 'active'));
    assert.ok(items.some((item) => item.id === 'lunch' && item.status === 'upcoming'));
    assert.ok(items.some((item) => item.id === 'morning-rest' && item.status === 'missed'));
    assert.ok(items.every((item) => item.date === '2026-07-18'));
});

test('awards a scheduled check-in once and persists completion', () => {
    const points = [];
    const runtime = loadRuntime({ points });
    const first = runtime.api.complete('think-english', { now: '2026-07-18T11:30:00' });
    const second = runtime.api.complete('think-english', { now: '2026-07-18T11:40:00' });

    assert.equal(first.accepted, true);
    assert.equal(first.late, false);
    assert.equal(second.duplicate, true);
    assert.equal(points.length, 1);
    assert.equal(JSON.parse(runtime.storage.dump().petbank_scheduled_checkins_v1).checkins['think-english'].completed, true);
});

test('allows late make-up check-in without changing the event id', () => {
    const points = [];
    const runtime = loadRuntime({ points });
    const result = runtime.api.complete('morning-rest', { now: '2026-07-18T12:30:00' });

    assert.equal(result.accepted, true);
    assert.equal(result.late, true);
    assert.equal(result.points, 0);
    assert.equal(points[0].eventId, 'p_one:2026-07-18:morning-rest');
});

test('resets state across local dates and profiles', () => {
    const storage = createStorage();
    const first = loadRuntime({ storage, profileId: 'p_one' });
    first.api.complete('think-english', { now: '2026-07-18T11:30:00' });

    const nextDay = loadRuntime({ storage, profileId: 'p_one' });
    assert.equal(nextDay.api.getToday({ now: '2026-07-19T11:30:00' }).find((item) => item.id === 'think-english').completed, false);

    const otherProfile = loadRuntime({ storage, profileId: 'p_two' });
    assert.equal(otherProfile.api.getToday({ now: '2026-07-18T11:30:00' }).find((item) => item.id === 'think-english').completed, false);
});

test('recovers malformed state to an empty valid state', () => {
    const { api } = loadRuntime({ storage: createStorage({ petbank_scheduled_checkins_v1: '{bad json' }) });
    assert.doesNotThrow(() => api.getState({ now: '2026-07-18T11:30:00' }));
    assert.equal(Object.keys(api.getState({ now: '2026-07-18T11:30:00' }).checkins).length, 0);
});
