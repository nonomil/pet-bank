import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('index.html', 'utf8');
const homeDemoImageTags = [...source.matchAll(/<button class="home-demo-resource-card"[\s\S]*?<img\b[^>]*>/g)]
    .map((match) => match[0].slice(match[0].lastIndexOf('<img')));

assert.equal(homeDemoImageTags.length, 5, 'home demo resource cards should keep five images');
homeDemoImageTags.forEach((tag, index) => {
    assert.match(tag, /\bloading="lazy"/, `home demo resource image ${index + 1} should be lazy loaded`);
    assert.match(tag, /\bdecoding="async"/, `home demo resource image ${index + 1} should decode asynchronously`);
});

console.log('PASS initial media loading contract');
