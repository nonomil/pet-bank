import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = process.cwd();
const html = fs.readFileSync(`${root}/index.html`, 'utf8');
const moduleSource = fs.readFileSync(`${root}/js/playground-catalog.js`, 'utf8');

assert.match(html, /id="playgroundHomeButton"[\s\S]*switchPage\('map'\)/, 'playground should expose a home button');
assert.match(html, /id="playgroundCategoryTabs"/, 'playground should expose secondary category tabs');

const tabs = [...html.matchAll(/data-playground-category="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(tabs.slice(0, 3), ['english', 'pinyin', 'challenge'], 'playground should expose exactly three learning categories');
assert.equal(new Set(tabs.slice(0, 3)).size, 3, 'playground category tabs should be unique');

const cards = [...html.matchAll(/class="pg-img-card pg-feature-card"[^>]*data-playground-category="([^"]+)"[\s\S]*?class="pg-card-title">([^<]+)/g)];
assert.equal(cards.length, 8, 'all eight playground cards should remain in the catalog');
assert.ok(cards.every(([, category]) => tabs.slice(0, 3).includes(category)), 'every card should use a visible category');
assert.equal(cards[0][2], '单词跑酷', 'word parkour should remain the first catalog card');
assert.match(moduleSource, /PetBankPlaygroundCatalog/);
assert.match(moduleSource, /setCategory/);

console.log('PASS playground catalog contract');
