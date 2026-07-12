import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync('js/app.js', 'utf8');
const walk = fs.readFileSync('js/walk.js', 'utf8');
const hanzi = fs.readFileSync('js/hanzi-game.js', 'utf8');
const math = fs.readFileSync('js/math-pk.js', 'utf8');
const cardArena = fs.readFileSync('js/card-arena-ui.js', 'utf8');
const switchSource = app.match(/function switchPage[\s\S]*?window\.switchPage = switchPage;/)?.[0] || '';

assert.match(switchSource, /prevPage === 'tools'[\s\S]*?ToolboxSystem\.destroy\(\)/, 'leaving tools should stop toolbox timers');
assert.match(switchSource, /prevPage === 'walk'[\s\S]*?WalkSystem\.cancelActiveWalk\(\)/, 'leaving walk should cancel active walk animation');
assert.match(walk, /function cancelActiveWalk\(\)/, 'walk should expose an active animation cleanup path');
assert.match(walk, /cancelActiveWalk: cancelActiveWalk/, 'walk cleanup should be part of the public module API');
assert.match(switchSource, /prevPage === 'hanzi'[\s\S]*?HanziGame\.stop\(\)/, 'leaving hanzi should cancel game timers');
assert.match(switchSource, /prevPage === 'mathpk'[\s\S]*?MathPKGame\.stop\(\)/, 'leaving math pk should cancel game timers');
assert.match(switchSource, /prevPage === 'card'[\s\S]*?CardArenaUI\.stop\(\)/, 'leaving card arena should cancel result and motion timers');
assert.match(hanzi, /function clearGameTimers\(\)/, 'hanzi should own and clear its game timers');
assert.match(hanzi, /stop: stop/, 'hanzi cleanup should be part of the public module API');
assert.match(math, /function stopSession\(\)/, 'math pk should own and clear its session timers');
assert.match(math, /stop: \(\) => Game\.stop\(\)/, 'math pk cleanup should be part of the public module API');
assert.match(cardArena, /function stop\(\)/, 'card arena should own and clear its UI timers');
assert.match(cardArena, /stop,/, 'card arena cleanup should be part of the public module API');

console.log('PASS page lifecycle contract');
