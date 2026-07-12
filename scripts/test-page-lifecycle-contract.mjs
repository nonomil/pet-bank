import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const walk = fs.readFileSync('js/walk.js', 'utf8');
const switchSource = app.match(/function switchPage[\s\S]*?window\.switchPage = switchPage;/)?.[0] || '';

assert.match(switchSource, /prevPage === 'tools'[\s\S]*?ToolboxSystem\.destroy\(\)/, 'leaving tools should stop toolbox timers');
assert.match(switchSource, /prevPage === 'walk'[\s\S]*?WalkSystem\.cancelActiveWalk\(\)/, 'leaving walk should cancel active walk animation');
assert.match(walk, /function cancelActiveWalk\(\)/, 'walk should expose an active animation cleanup path');
assert.match(walk, /cancelActiveWalk: cancelActiveWalk/, 'walk cleanup should be part of the public module API');

console.log('PASS page lifecycle contract');
