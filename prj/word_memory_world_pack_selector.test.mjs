import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.join(dir, '单词记忆射击场原型');
const html = fs.readFileSync(path.join(projectDir, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(projectDir, 'game.js'), 'utf8');

assert.match(html, /worldSelect/, 'page should expose a world theme selector');
assert.match(html, /选择地图主题/, 'world selector should have an accessible label');
assert.match(js, /WORLD_PACK_REGISTRY/, 'game should register named world packs');
assert.match(js, /selectedWorldPack:\s*'farm'/, 'game should track the selected world pack state');
assert.match(js, /function renderWorldSelect\(/, 'game should render world pack options');
assert.match(js, /function changeWorldPack\(/, 'game should support changing world packs');
assert.match(js, /loadWorldTiles\(\)\s*{[\s\S]*WORLD_PACK_REGISTRY\[state\.selectedWorldPack\]/, 'world tile loader should resolve the selected world pack');
assert.match(js, /id:\s*'level-1'[\s\S]*worldPack:\s*'farm_gpt'/, 'level 1 should default to the farm GPT world pack');
assert.match(js, /id:\s*'level-2'[\s\S]*worldPack:\s*'farm_gpt'/, 'level 2 should default to the farm GPT world pack');
assert.match(js, /assets\/generated\/world-bg-tiles\/farm-9grid-manifest\.json/, 'legacy farm pack should remain available as a registered world');
assert.match(js, /assets\/generated\/world-bg-tiles\/farm-gpt-9grid-manifest\.json/, 'game should register the parallel farm GPT preview world');
assert.match(js, /space|ocean|forest|alien|sky|grassland/, 'game should prepare additional named world packs for future assets');

console.log('PASS - word memory world pack selector');
