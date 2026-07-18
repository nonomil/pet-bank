import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = process.cwd();
const html = fs.readFileSync(`${root}/index.html`, 'utf8');
const moduleSource = fs.readFileSync(`${root}/js/playground-catalog.js`, 'utf8');
const styleSource = fs.readFileSync(`${root}/css/playground.css`, 'utf8');

assert.match(html, /id="playgroundHomeButton"[\s\S]*switchPage\('map'\)/, 'playground should expose a home button');
assert.match(html, /id="playgroundCategoryTabs"/, 'playground should expose secondary category tabs');

const tabs = [...html.matchAll(/data-playground-category="([^"]+)"/g)].map((match) => match[1]);
assert.deepEqual(tabs.slice(0, 4), ['all', 'english', 'pinyin', 'challenge'], 'playground should expose all plus three learning categories');
assert.equal(new Set(tabs.slice(0, 4)).size, 4, 'playground category tabs should be unique');
assert.match(html, /aria-selected="true"[^>]*data-playground-category="all"/, 'all games should be selected by default');

const cards = [...html.matchAll(/class="pg-img-card pg-feature-card"[^>]*data-playground-category="([^"]+)"[\s\S]*?class="pg-card-title">([^<]+)/g)];
assert.equal(cards.length, 8, 'all eight playground cards should remain in the catalog');
assert.ok(cards.every(([, category]) => tabs.slice(1, 4).includes(category)), 'every card should use a visible category');
assert.equal(cards[0][2], '单词跑酷', 'word parkour should remain the first catalog card');
assert.match(moduleSource, /PetBankPlaygroundCatalog/);
assert.match(moduleSource, /setCategory/);
assert.match(moduleSource, /nextCategory === 'all'/, 'all category should show every card');
assert.match(styleSource, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/, 'desktop game cards should use three columns');

console.log('PASS playground catalog contract');
