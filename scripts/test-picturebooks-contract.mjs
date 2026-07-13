import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const catalog = JSON.parse(read('data/picturebooks/catalog.json'));

assert.equal(catalog.schemaVersion, 1);
assert.equal(catalog.stories.length, 8);
assert.ok(catalog.stories.every((story) => story.id && story.titleZh && story.pages.length >= 2));

for (const story of catalog.stories) {
    assert.match(story.cover, /^assets\/picturebooks\/images\/[a-z0-9-]+\/page-[0-9]+\.(?:jpg|png)$/);
    assert.ok(fs.existsSync(path.join(root, story.cover)), `missing cover: ${story.cover}`);
    for (const page of story.pages) {
        assert.match(page.image, /^assets\/picturebooks\/images\/[a-z0-9-]+\/page-[0-9]+\.(?:jpg|png)$/);
        assert.ok(fs.existsSync(path.join(root, page.image)), `missing page: ${page.image}`);
        assert.ok(page.zh || page.en, `page has no text: ${story.id}#${page.page}`);
    }
}

const router = read('js/page-router.js');
assert.match(router, /picturebooks: 'picturebooks'/);
assert.match(router, /picturebooks: '\/app\/picturebooks'/);
assert.match(router, /'\/app\/picturebooks': \{ page: 'picturebooks' \}/);
assert.match(router, /'\/picturebooks': \{ page: 'picturebooks' \}/);

const runtime = read('js/runtime-loader.js');
assert.match(runtime, /picturebooks: \['css\/picturebooks\.css'\]/);
assert.match(runtime, /picturebooks: \['js\/picturebooks\.js'\]/);
assert.match(runtime, /case 'picturebooks':/);

const index = read('index.html');
assert.match(index, /data-page="picturebooks"/);
assert.match(index, /id="page-picturebooks"/);
assert.match(index, /data-app-dock="picturebooks"/);

const module = read('js/picturebooks.js');
assert.match(module, /petbank_picturebook_progress_v1/);
assert.match(module, /sourceId: 'picturebooks'/);
assert.match(module, /picturebook:\$\{story\.id\}:complete/);
assert.match(module, /type: 'growth_points', amount: 8/);
assert.match(module, /type: 'pet_exp', amount: 4/);

const registry = read('docs_project/data-contracts/localstorage-registry.json');
assert.match(registry, /petbank_picturebook_progress_v1/);

console.log(`picturebooks contract passed: ${catalog.stories.length} stories, ${catalog.stories.reduce((sum, story) => sum + story.pages.length, 0)} pages`);
