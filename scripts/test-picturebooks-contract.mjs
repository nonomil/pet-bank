import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const catalog = JSON.parse(read('data/picturebooks/portal-catalog.json'));
const portal = JSON.parse(read('data/picturebooks/portal.json'));

assert.equal(catalog.schemaVersion, 1);
assert.equal(catalog.stories.length, 25);
assert.ok(portal.libraryUrl.startsWith('https://'));
assert.equal(portal.devLibraryUrl, 'http://127.0.0.1:5174/picturebook-library/');
assert.ok(Number.isInteger(portal.sessionTtlMs) && portal.sessionTtlMs > 0);
assert.ok(catalog.stories.every((story) => story.id && story.titleZh && story.shelf));
assert.ok(catalog.stories.every((story) => Array.isArray(story.tags) && story.tags.length > 0));

for (const story of catalog.stories) {
    assert.match(story.cover, /^assets\/picturebooks\/images\/[a-z0-9-]+\/page-1\.webp$/);
    assert.ok(fs.existsSync(path.join(root, story.cover)), `missing cover: ${story.cover}`);
}

const router = read('js/page-router.js');
assert.match(router, /picturebooks: 'picturebooks'/);
assert.match(router, /picturebooks: '\/app\/picturebooks'/);
assert.match(router, /'\/app\/picturebooks': \{ page: 'picturebooks' \}/);
assert.match(router, /'\/picturebooks': \{ page: 'picturebooks' \}/);

const runtime = read('js/runtime-loader.js');
assert.match(runtime, /picturebooks: \['css\/picturebook-portal\.css'\]/);
assert.match(runtime, /picturebooks: \['js\/picturebook-external-bridge\.js'\]/);
assert.match(runtime, /case 'picturebooks':/);

const index = read('index.html');
assert.match(index, /id="page-picturebooks"/);
assert.match(index, /data-app-dock="picturebooks"/);

const module = read('js/picturebook-external-bridge.js');
assert.match(module, /petbank_picturebook_launches_v1/);
assert.match(module, /petbank\.picturebook\.completed/);
assert.match(module, /petbank\.picturebook\.reward-result/);
assert.match(module, /event\.origin !== state\.origin/);
assert.match(module, /sourceId: 'picturebook-library'/);
assert.match(module, /type: 'growth_points', amount: 8/);
assert.match(module, /type: 'pet_exp', amount: 4/);

const registry = read('docs_project/data-contracts/localstorage-registry.json');
assert.match(registry, /petbank_picturebook_launches_v1/);

console.log(`picturebooks portal contract passed: ${catalog.stories.length} stories`);
