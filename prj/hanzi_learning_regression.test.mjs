import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const progressSource = fs.readFileSync(new URL('../js/hanzi-progress.js', import.meta.url), 'utf8');
const gameSource = fs.readFileSync(new URL('../js/hanzi-game.js', import.meta.url), 'utf8');

function createStorage() {
    const store = new Map();
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
        clear() {
            store.clear();
        }
    };
}

function loadProgress() {
    const localStorage = createStorage();
    const context = {
        window: null,
        localStorage,
        console,
        Math,
        Date
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(progressSource, context, { filename: 'js/hanzi-progress.js' });
    return { api: context.window.HanziProgress, localStorage };
}

async function loadGameWithEmptyBank() {
    const events = {
        toast: null,
        leaderboardCalls: 0,
        growthCalls: 0
    };
    const document = {
        body: { appendChild() {} },
        createElement() {
            return {
                id: '',
                className: '',
                style: {},
                innerHTML: '',
                appendChild() {},
                querySelector() { return null; },
                insertAdjacentHTML() {},
                classList: { add() {}, remove() {} }
            };
        },
        getElementById() { return null; },
        querySelectorAll() { return []; }
    };

    const context = {
        window: null,
        document,
        console,
        Math,
        Date,
        setTimeout,
        clearTimeout,
        alert(message) {
            events.toast = message;
        },
        showToast(message) {
            events.toast = message;
        },
        fetch: async (url) => ({
            ok: true,
            async json() {
                if (String(url).includes('hanzi-hsk')) return { levels: {} };
                return { levels: { 1: [], 2: [], 3: [] } };
            }
        }),
        Leaderboard: {
            record() {
                events.leaderboardCalls += 1;
            }
        },
        addGrowthPoints() {
            events.growthCalls += 1;
        }
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(gameSource, context, { filename: 'js/hanzi-game.js' });
    return { api: context.window.HanziGame, events };
}

function testProgressUniquenessAndStats() {
    const { api } = loadProgress();
    api.reset();

    const pool = ['1:char:山', '1:char:水', '1:char:火', '1:char:木'];
    const asked = new Set();
    for (let i = 0; i < pool.length; i++) {
        const next = api.pickNext(pool, asked);
        assert.ok(next, 'pickNext should return an item while pool is non-empty');
        assert.ok(!asked.has(next), 'pickNext should avoid items already asked in this session');
        asked.add(next);
    }

    const fallback = api.pickNext(pool, asked);
    assert.ok(pool.includes(fallback), 'pickNext should fall back to the pool after session coverage is exhausted');

    api.record('1:char:山', true);
    api.record('1:char:山', true);
    api.record('1:char:水', false);
    const stats = JSON.parse(JSON.stringify(api.stats('1', ['1:char:山', '1:char:水', '1:char:火'])));
    assert.deepEqual(stats, {
        total: 3,
        learned: 2,
        mastered: 1,
        toReview: 1,
        newCount: 1
    });
}

async function testEmptyLevelGuard() {
    const { api, events } = await loadGameWithEmptyBank();
    await api.start();
    assert.equal(events.toast, '该等级暂无题目，请稍后再试');
    assert.equal(events.leaderboardCalls, 0, 'empty level should not write leaderboard records');
    assert.equal(events.growthCalls, 0, 'empty level should not grant growth points');
}

async function main() {
    testProgressUniquenessAndStats();
    await testEmptyLevelGuard();
    console.log('PASS - hanzi learning regression checks');
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
