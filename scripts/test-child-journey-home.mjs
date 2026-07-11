import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'style.css'), 'utf8');

for (const id of ['childJourneyHero', 'childJourneyToday', 'childJourneyPet', 'childJourneyAdventure', 'childJourneyMore']) {
    assert.match(html, new RegExp(`id="${id}"`), `home should expose ${id}`);
}

assert.match(html, /id="childJourneyHero"[\s\S]*switchPage\('today'\)/, 'hero should lead to today');
assert.match(html, /id="childJourneyToday"[\s\S]*switchPage\('today'\)/, 'today entry should lead to today');
assert.match(html, /id="childJourneyPet"[\s\S]*switchPage\('pet'\)/, 'pet entry should lead to pet');
assert.match(html, /id="childJourneyAdventure"[\s\S]*switchPage\('playground'\)/, 'adventure entry should lead to playground');
assert.match(html, /id="childJourneyMore"[\s\S]*switchPage\('explore'\)[\s\S]*switchPage\('shop'\)/, 'more entry should retain exploration and shop');
assert.ok(
    html.indexOf('id="childJourneyHero"') < html.indexOf('class="child-journey-main-grid"')
        && html.indexOf('class="child-journey-main-grid"') < html.indexOf('id="showcase"'),
    'children should see the main journey choices before the optional showcase carousel'
);

for (const selector of ['.child-journey-hero', '.child-journey-main-grid', '.child-journey-entry:focus-visible', '@media (max-width: 760px)']) {
    assert.match(css, new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `styles should include ${selector}`);
}

console.log('PASS child journey home contract');
