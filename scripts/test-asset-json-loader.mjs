import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';

const source = fs.existsSync('js/asset-loader.js')
    ? fs.readFileSync('js/asset-loader.js', 'utf8')
    : '';

function createLoader(fetchImpl) {
    const context = {
        fetch: fetchImpl,
        window: {
            resolvePetBankAssetUrl: (path) => `https://static.example.test/${path}`
        }
    };
    vm.runInNewContext(source, context, { filename: 'js/asset-loader.js' });
    assert.ok(context.window.PetBankAssetLoader, 'asset loader namespace should be registered');
    return context.window.PetBankAssetLoader;
}

test('shared JSON loader deduplicates concurrent requests by resolved URL', async () => {
    let fetchCount = 0;
    const loader = createLoader(async (url) => {
        fetchCount += 1;
        return { ok: true, json: async () => ({ url }) };
    });

    const first = loader.fetchJson('data/items.json');
    const second = loader.fetchJson('data/items.json');
    const [firstValue, secondValue] = await Promise.all([first, second]);

    assert.equal(fetchCount, 1);
    assert.deepEqual(firstValue, secondValue);
    assert.equal(firstValue.url, 'https://static.example.test/data/items.json');
});

test('failed JSON requests are evicted so a later call can retry', async () => {
    let fetchCount = 0;
    const loader = createLoader(async () => {
        fetchCount += 1;
        if (fetchCount === 1) return { ok: false, status: 503, json: async () => ({}) };
        return { ok: true, json: async () => ({ recovered: true }) };
    });

    await assert.rejects(loader.fetchJson('data/items.json'), /503/);
    await assert.doesNotReject(async () => {
        assert.deepEqual(await loader.fetchJson('data/items.json'), { recovered: true });
    });

    assert.equal(fetchCount, 2);
});

test('core JSON consumers share the loader registered before them', () => {
    const index = fs.readFileSync('index.html', 'utf8');
    const inventory = fs.readFileSync('js/inventory.js', 'utf8');
    const treasure = fs.readFileSync('js/treasure.js', 'utf8');
    const learnCenter = fs.readFileSync('js/learn-center.js', 'utf8');

    assert.ok(index.indexOf('js/asset-loader.js') < index.indexOf('js/inventory.js'));
    assert.ok(index.indexOf('js/asset-loader.js') < index.indexOf('js/treasure.js'));
    assert.match(inventory, /PetBankAssetLoader\.fetchJson\(['"]data\/items\.json['"]\)/);
    assert.match(treasure, /PetBankAssetLoader\.fetchJson\(['"]data\/items\.json['"]\)/);
    assert.match(learnCenter, /PetBankAssetLoader\.fetchJson\(url\)/);
});
