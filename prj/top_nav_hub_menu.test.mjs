import fs from 'node:fs';

const appJs = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');

const results = [];
function check(name, cond, detail = '') {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

const closeSectionMenusMatch = appJs.match(/function closeSectionMenus\(\)\s*\{([\s\S]*?)\n\}/);
const documentClickMatch = appJs.match(/document\.addEventListener\('click', \(event\) => \{([\s\S]*?)\n\}\);/);

check('closeSectionMenus function exists', !!closeSectionMenusMatch);
check('document click handler exists', !!documentClickMatch);

const closeSectionMenusBody = closeSectionMenusMatch ? closeSectionMenusMatch[1] : '';
const documentClickBody = documentClickMatch ? documentClickMatch[1] : '';

check(
    'page section closer does not directly close top hub menus',
    !closeSectionMenusBody.includes('closeTopHubMenus();')
);
check(
    'document click handler has dedicated top hub close guard',
    documentClickBody.includes("!event.target.closest('.nav-hub') && !event.target.closest('#topHubMenu')")
);

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.filter((item) => item.pass).length}/${results.length} passed`);

if (failed.length) {
    console.log('FAILURES:', failed.map((item) => item.name).join('; '));
    process.exit(1);
}

process.exit(0);
