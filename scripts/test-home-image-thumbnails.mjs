import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const configPath = path.join(root, 'scripts/home-image-thumbnails.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

assert.equal(config.version, 1, 'home thumbnail config should use schema version 1');
assert.equal(config.width, 640, 'home thumbnails should use the desktop-safe width');
assert.equal(config.height, 360, 'home thumbnails should use the card aspect ratio');
assert.equal(config.entries.length, 5, 'home should keep five thumbnail entries');

for (const entry of config.entries) {
    const source = path.join(root, entry.source);
    const output = path.join(root, entry.output);
    assert.ok(fs.statSync(source).isFile(), `thumbnail source should exist: ${entry.source}`);
    assert.ok(fs.statSync(output).isFile(), `thumbnail output should exist: ${entry.output}`);
    assert.ok(fs.statSync(output).size > 0, `thumbnail output should not be empty: ${entry.output}`);
    const escapedOutput = entry.output.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    assert.match(indexSource, new RegExp(`data-home-src="${escapedOutput}"`), `index should use the thumbnail: ${entry.output}`);
}

console.log('PASS home image thumbnail contract');
