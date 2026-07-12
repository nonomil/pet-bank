import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const prototypeDir = path.resolve(scriptDir, '..');
const html = fs.readFileSync(path.join(prototypeDir, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(prototypeDir, 'styles.css'), 'utf8');

assert.match(html, /id="wordShooterSettings"/, 'airplane battle should keep its in-game settings entry');
assert.match(css, /\.word-shooter \.typing-gun-ship\s*\{[^}]*animation:\s*none/s, 'player ship should keep a stable size without hover scaling');
assert.match(css, /\.word-shooter \.typing-arena\[data-arena-shake="true"\]\s*\{[^}]*animation:\s*none/s, 'airplane battle should not shake the whole playfield');
assert.match(css, /\.word-shooter \.typing-arena\s*\{[^}]*height:\s*100%/s, 'airplane battle arena should fill the available game window');
assert.doesNotMatch(css, /\.word-shooter \.typing-gun-ship\s*\{[^}]*animation:\s*ship-hover/s, 'player ship should not use the old bobbing animation');
console.log('PASS - word shooter layout');
