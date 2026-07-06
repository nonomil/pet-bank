import { readFileSync } from 'node:fs';

const js = readFileSync('js/social.js', 'utf8');

const results = [];
function check(name, cond, detail = '') {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

check('SocialSystem.refresh accepts options', /async function refresh\(options\)/.test(js));
check('default refresh clears stale info', /if\s*\(!preserveInfo\)\s*\{\s*state\.info\s*=\s*'';\s*\}/.test(js));
check('send walk invite preserves its own success message through refresh', /sendWalkInvite[\s\S]*await refresh\(\{\s*preserveInfo:\s*true\s*\}\)/.test(js));
check('accept walk invite preserves its own success message through refresh', /acceptWalkInvite[\s\S]*await refresh\(\{\s*preserveInfo:\s*true\s*\}\)/.test(js));
check('record visit preserves its own success message through refresh', /recordVisit[\s\S]*await refresh\(\{\s*preserveInfo:\s*true\s*\}\)/.test(js));

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
