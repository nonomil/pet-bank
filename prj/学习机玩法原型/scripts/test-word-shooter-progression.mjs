import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const prototypeDir = path.resolve(scriptDir, '..');
const html = fs.readFileSync(path.join(prototypeDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(prototypeDir, 'styles.css'), 'utf8');
const js = fs.readFileSync(path.join(prototypeDir, 'game.js'), 'utf8');

assert.match(html, /id="wordShooterHangar"/, 'word shooter should expose a hangar panel');
assert.match(html, /data-hangar-ship="scout"/, 'hangar should expose the scout ship');
assert.match(html, /data-hangar-ship="guardian"/, 'hangar should expose the guardian ship');
assert.match(html, /data-hangar-ship="nova"/, 'hangar should expose the nova ship');
assert.match(html, /data-hangar-weapon="homing-missile"/, 'hangar should expose the homing missile');
assert.match(js, /WORD_SHOOTER_PROGRESSION_STORAGE_KEY/, 'word shooter progression should have a dedicated storage key');
assert.match(js, /function readWordShooterProgression/, 'word shooter progression should recover a saved profile');
assert.match(js, /function getWordShooterLoadout/, 'word shooter should resolve an equipped loadout');
assert.match(js, /shipUpgrades/, 'word shooter progression should persist ship upgrade levels');
assert.match(js, /starDust/, 'word shooter progression should persist upgrade currency');
assert.match(css, /\.typing-enemy-word-card\b/, 'enemy words should render as independent target cards');
assert.match(css, /min-width:\s*clamp\(180px/, 'enemy word cards should stay readable at desktop sizes');

console.log('PASS - word shooter progression contract');
