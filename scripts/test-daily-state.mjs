import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const repoRoot = process.cwd();

function createStorage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return {
        get length() { return data.size; },
        key(index) { return [...data.keys()][index] ?? null; },
        getItem(key) { return data.has(key) ? data.get(key) : null; },
        setItem(key, value) { data.set(key, String(value)); },
        removeItem(key) { data.delete(key); },
        dump() { return Object.fromEntries(data); }
    };
}

function loadApp({ storage, profileId = 'p_default', now = '2026-07-11T09:30:00' } = {}) {
    const document = {
        head: { appendChild() {} },
        createElement() { return { style: {}, classList: { add() {}, remove() {} } }; },
        getElementById() { return null; },
        querySelector() { return null; },
        addEventListener() {},
        body: { appendChild() {} }
    };
    const window = {
        document,
        localStorage: storage,
        addEventListener() {},
        location: { href: 'http://localhost/', pathname: '/', origin: 'http://localhost/' },
        ProfileManager: { getActiveId: () => profileId },
        PetSystem: { addExp() {}, getState: () => ({}) },
        InventorySystem: { load() {}, loadItemsData: async () => {}, getAllItems: () => [] },
        ExplorationSystem: {},
        ShopSystem: {},
        fetch: async () => ({ json: async () => ({}) }),
        alert() {},
        confirm: () => false,
        setTimeout,
        clearTimeout
    };
    window.window = window;
    const RealDate = Date;
    class LocalDate extends RealDate {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return new RealDate(now).getTime(); }
    }
    const context = vm.createContext({
        window, document, localStorage: storage, Date: LocalDate,
        PetSystem: window.PetSystem, InventorySystem: window.InventorySystem,
        ExplorationSystem: window.ExplorationSystem, ShopSystem: window.ShopSystem,
        fetch: window.fetch, alert: window.alert, confirm: window.confirm,
        setTimeout, clearTimeout, URL, console
    });
    for (const scriptName of ['task-catalog.js', 'app.js']) {
        vm.runInContext(
            fs.readFileSync(path.join(repoRoot, 'js', scriptName), 'utf8'),
            context,
            { filename: `js/${scriptName}` }
        );
    }
    return {
        window,
        loadTreasure() {
            vm.runInContext(fs.readFileSync(path.join(repoRoot, 'js', 'treasure.js'), 'utf8'), context, { filename: 'js/treasure.js' });
            return window.TreasureChest;
        }
    };
}

test('daily task state uses local dates, profile isolation, and one-time legacy migration', () => {
    const storage = createStorage({
        petbank_completed: JSON.stringify(['learning-阅读 20 分钟'])
    });
    const { window: app } = loadApp({ storage, profileId: 'p_one' });

    assert.ok(app.PetBankDailyState, 'app exposes the shared daily state contract');
    assert.equal(app.PetBankDailyState.localDate(), '2026-07-11');

    const first = app.PetBankDailyState.load();
    assert.deepEqual([...first.completedTasks], ['learning-阅读 20 分钟']);
    assert.equal(storage.getItem('petbank_tasks_completed_today'), '1');

    app.PetBankDailyState.save(new Set(['sports-运动 30 分钟']));
    assert.deepEqual([...app.PetBankDailyState.load().completedTasks], ['sports-运动 30 分钟']);

    const { window: nextDay } = loadApp({ storage, profileId: 'p_one', now: '2026-07-12T09:30:00' });
    assert.equal(nextDay.PetBankDailyState.load().completedTasks.size, 0, 'a new local day resets tasks');
    assert.equal(storage.getItem('petbank_tasks_completed_today'), '0');

    const { window: otherProfile } = loadApp({ storage: createStorage(), profileId: 'p_two' });
    assert.equal(otherProfile.PetBankDailyState.load().completedTasks.size, 0, 'a different profile starts isolated');
});

test('treasure daily eligibility shares the app daily-state claim contract', async () => {
    const storage = createStorage();
    const appRuntime = loadApp({ storage });
    const app = appRuntime.window;
    app.PetBankDailyState.save(new Set(['learning-阅读 20 分钟']));
    storage.setItem('petbank_tasks_completed_today', '0');
    const treasure = appRuntime.loadTreasure();

    await Promise.resolve();
    await Promise.resolve();
    assert.equal(treasure.canOpenDaily().can, true);

    app.PetBankDailyState.claimDaily();
    assert.equal(treasure.canOpenDaily().can, false, 'a claim recorded by the shared contract blocks a second daily chest');
    assert.equal(treasure.canOpenDaily().msg, '今日已领取');
    assert.equal(storage.getItem('petbank_daily_claim_date'), new Date('2026-07-11T09:30:00').toLocaleDateString(), 'the legacy claim key keeps its original local-date format');
});

test('daily state migrates a legacy same-day chest claim and resets its chest count on the next local day', async () => {
    const todayLegacyDate = new Date('2026-07-11T09:30:00').toLocaleDateString();
    const storage = createStorage({
        petbank_daily_claim_date: todayLegacyDate,
        petbank_chests: JSON.stringify({ daily: 0, explore: 2, milestone: 0 })
    });
    const firstRuntime = loadApp({ storage, now: '2026-07-11T09:30:00' });
    const first = firstRuntime.window;

    assert.equal(first.PetBankDailyState.hasClaimedDaily(), true, 'a legacy same-day claim migrates as claimed');
    assert.equal(first.PetBankDailyState.getDailyChestCount(), 0);

    const nextRuntime = loadApp({ storage, now: '2026-07-12T09:30:00' });
    const next = nextRuntime.window;
    assert.equal(next.PetBankDailyState.hasClaimedDaily(), false);
    assert.equal(next.PetBankDailyState.getDailyChestCount(), 1, 'a new local day restores one daily chest');

    nextRuntime.loadTreasure().init();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(JSON.parse(storage.getItem('petbank_chests')).daily, 1, 'treasure inventory follows the shared daily chest count');
});

test('daily state recovers malformed storage and invalid daily chest counts to a safe initial value', () => {
    const malformedStorage = createStorage({
        petbank_daily_state: '{bad json',
        petbank_completed: '{bad json',
        petbank_chests: '{bad json'
    });
    const { window: malformedApp } = loadApp({ storage: malformedStorage });
    assert.equal(malformedApp.PetBankDailyState.load().completedTasks.size, 0);
    assert.equal(malformedApp.PetBankDailyState.getDailyChestCount(), 1);
    assert.doesNotThrow(() => JSON.parse(malformedStorage.getItem('petbank_daily_state')));

    for (const invalidCount of [-1, 'not-a-number', null]) {
        const storage = createStorage({
            petbank_daily_state: JSON.stringify({
                date: '2026-07-11',
                profileId: 'p_default',
                completedTasks: [],
                dailyChestClaimed: false,
                dailyChestCount: invalidCount
            })
        });
        const { window: app } = loadApp({ storage });
        assert.equal(app.PetBankDailyState.getDailyChestCount(), 1, `invalid daily chest count ${String(invalidCount)} resets to one`);
        assert.equal(JSON.parse(storage.getItem('petbank_daily_state')).dailyChestCount, 1, 'the safe value is persisted');
    }
});

test('treasure falls back to the legacy completed-task counter when the shared state API is unavailable', async () => {
    const storage = createStorage({ petbank_tasks_completed_today: '1' });
    const appRuntime = loadApp({ storage });
    delete appRuntime.window.PetBankDailyState;
    const treasure = appRuntime.loadTreasure();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(treasure.canOpenDaily().can, true);
});
