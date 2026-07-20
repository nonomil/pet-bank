import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('index.html', 'utf8');
const runtimeLoader = fs.readFileSync('js/runtime-loader.js', 'utf8');
const homeDemoImageTags = [...source.matchAll(/<button class="home-demo-resource-card"[\s\S]*?<img\b[^>]*>/g)]
    .map((match) => match[0].slice(match[0].lastIndexOf('<img')));

assert.equal(homeDemoImageTags.length, 5, 'home demo resource cards should keep five images');
homeDemoImageTags.forEach((tag, index) => {
    assert.match(tag, /\bdata-home-src="assets\//, `home demo resource image ${index + 1} should be activated by the home route`);
    assert.doesNotMatch(tag, /(?:^|\s)src="assets\//, `home demo resource image ${index + 1} should not load from the shared shell`);
    assert.match(tag, /\bloading="lazy"/, `home demo resource image ${index + 1} should be lazy loaded`);
    assert.match(tag, /\bdecoding="async"/, `home demo resource image ${index + 1} should decode asynchronously`);
});

assert.doesNotMatch(source, /<script\s+src="js\/battle-fx\.js"/, 'battle FX should not be part of the shared bootstrap');
assert.match(runtimeLoader, /explore:\s*\[[\s\S]*['"]js\/battle-fx\.js['"]/, 'explore runtime should load battle FX on demand');

console.log('PASS initial media loading contract');
