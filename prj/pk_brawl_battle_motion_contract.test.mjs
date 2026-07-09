import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const read = (relPath) => fs.readFileSync(path.join(repoRoot, relPath), 'utf8');

const battleFx = read('js/battle-fx.js');
const app = read('js/app.js');
const styleCss = read('css/style.css');
const mathPk = read('js/math-pk.js');
const cardArenaUi = read('js/card-arena-ui.js');
const arenaCss = read('css/arena.css');

[
  'battle-motion-approach',
  'battle-motion-impact',
  'battle-motion-recoil'
].forEach((needle) => {
  assert.ok(app.includes(needle) || styleCss.includes(needle), `exploration battle should contain motion marker: ${needle}`);
});

[
  'attacker',
  'defender',
  'motionStyle',
  'recoil'
].forEach((needle) => {
  assert.ok(battleFx.includes(needle), `battle-fx.js should expose semantic motion field: ${needle}`);
});

[
  'math-pk-rush-active',
  'math-pk-impact-burst',
  'math-pk-target-recoil',
  'math-pk-contact-flare',
  'math-pk-impact-echo',
  'math-pk-rush-shadow',
  'math-pk-target-slam',
  'math-pk-impact-shockwave',
  'math-pk-stage-impact-focus'
].forEach((needle) => {
  assert.ok(mathPk.includes(needle), `math PK should contain motion marker: ${needle}`);
});

[
  'math-pk-impact-style-dash',
  'math-pk-impact-style-hop',
  'math-pk-impact-style-spin'
].forEach((needle) => {
  assert.ok(mathPk.includes(needle), `math PK should expose style-specific impact marker: ${needle}`);
});

[
  'arena-battle-lunge',
  'arena-impact-burst',
  'arena-target-recoil',
  'arena-impact-backlight',
  'arena-impact-floor-ring',
  'arena-lunge-afterimage',
  'arena-target-slam',
  'arena-impact-shockwave',
  'arena-stage-impact-focus'
].forEach((needle) => {
  assert.ok(cardArenaUi.includes(needle) || arenaCss.includes(needle), `card arena should contain motion marker: ${needle}`);
});

[
  'arena-impact-style-basic',
  'arena-impact-style-heavy',
  'arena-impact-style-ultimate'
].forEach((needle) => {
  assert.ok(cardArenaUi.includes(needle) || arenaCss.includes(needle), `card arena should expose style-specific impact marker: ${needle}`);
});

[
  'battle-motion-impact',
  'battle-motion-contact-flare',
  'battle-motion-ground-ring',
  'battle-motion-afterimage',
  'battle-motion-slam',
  'battle-motion-impact-shockwave',
  'battle-motion-stage-impact-focus'
].forEach((needle) => {
  assert.ok(app.includes(needle) || styleCss.includes(needle), `exploration battle should contain impact flare marker: ${needle}`);
});

[
  'battle-motion-impact-style-dash',
  'battle-motion-impact-style-pounce',
  'battle-motion-impact-style-arc',
  'battle-motion-impact-style-burst'
].forEach((needle) => {
  assert.ok(app.includes(needle) || styleCss.includes(needle), `exploration battle should expose style-specific impact marker: ${needle}`);
});

assert.ok(mathPk.includes('from-human') && mathPk.includes('from-robot'), 'math PK should keep defender-side direction markers');
assert.ok(cardArenaUi.includes('data-side="${sideClass || \'\'}"'), 'card arena should tag combat cards with side markers');
assert.ok(app.includes('window.BattleFx.getEffectSpec'), 'exploration battle should read motion spec from BattleFx');

console.log('PASS pk_brawl_battle_motion_contract');
