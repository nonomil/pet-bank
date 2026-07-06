import { readFileSync } from 'node:fs';

const social = readFileSync('js/social.js', 'utf8');
const app = readFileSync('js/app.js', 'utf8');
const css = readFileSync('css/style.css', 'utf8') + '\n' + readFileSync('css/walk.css', 'utf8');

const results = [];
function check(name, cond, detail = '') {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

check('friend home renders visitor pet card', social.includes('friend-home-visitor-pet-card'));
check('friend home renders owner pet card', social.includes('friend-home-owner-pet-card'));
check('friend home has local pet visual helper', social.includes('getLocalPetVisitVisual'));
check('walk page renders buddy stage card', app.includes('walk-buddy-stage-card'));
check('walk page has peer visual helper', app.includes('getWalkPeerVisualMarkup'));
check('two-pet friend home styles exist', css.includes('.friend-home-visitor-pet-card') && css.includes('.friend-home-owner-pet-card'));
check('walk buddy stage styles exist', css.includes('.walk-buddy-stage-card'));

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
