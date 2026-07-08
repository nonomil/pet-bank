import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('css/style.css', 'utf8');
const appJs = readFileSync('js/app.js', 'utf8');
const lucideLiteJs = readFileSync('js/lucide-lite.js', 'utf8');

const results = [];
function check(name, cond, detail = '') {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

check('main content exposes a skip target', /class="skip-link"[^>]+href="#mainContent"/.test(html) && /<main[^>]+id="mainContent"/.test(html));
check('child app shell bar exists outside top nav', /class="[^"]*app-shell-bar/.test(html) && /id="appShellChildName"/.test(html) && /id="appShellPoints"/.test(html));
check('child app bottom dock exposes primary app destinations', [
    /class="[^"]*app-bottom-dock/.test(html),
    /data-app-dock="map"[\s\S]{0,220}switchPage\('map'\)/.test(html),
    /data-app-dock="today"[\s\S]{0,220}switchPage\('today'\)/.test(html),
    /data-app-dock="learn"[\s\S]{0,220}switchPage\('learn'\)/.test(html),
    /data-app-dock="pet"[\s\S]{0,220}switchPage\('pet'\)/.test(html),
    /data-app-dock="explore"[\s\S]{0,220}switchPage\('explore'\)/.test(html),
    /data-app-dock="playground"[\s\S]{0,220}switchPage\('playground'\)/.test(html)
].every(Boolean));
check('route shell page sets separate app and parent page groups', /const\s+APP_SHELL_PAGES\s*=\s*new\s+Set/.test(appJs) && /const\s+PARENT_SHELL_PAGES\s*=\s*new\s+Set/.test(appJs));
check('switchPage applies route shell classes', /function\s+applyRouteShell\s*\(\s*page\s*\)/.test(appJs) && /applyRouteShell\s*\(\s*page\s*\)/.test(appJs) && /classList\.toggle\(\s*['"]shell-app['"]/.test(appJs) && /classList\.toggle\(\s*['"]shell-parent['"]/.test(appJs));
check('app shell syncs active dock and lightweight status', /\[data-app-dock\]/.test(appJs) && /appShellPoints/.test(appJs) && /appShellChildName/.test(appJs));
check('app shell hides legacy top nav and sidebar', /body\.shell-app\s+\.top-nav\s*\{[^}]*display:\s*none/.test(css) && /body\.shell-app\s+\.sidebar\s*\{[^}]*display:\s*none/.test(css));
check('app shell uses near fullscreen content and bottom dock', /body\.shell-app\s+\.page-shell\s*\{[^}]*max-width:\s*none/.test(css) && /body\.shell-app\s+\.app-bottom-dock\s*\{[^}]*display:\s*flex/.test(css));
check('parent shell keeps management chrome and hides child primary nav', /body\.shell-parent\s+\.primary-nav\s*\{[^}]*display:\s*none/.test(css) && /body\.shell-parent\s+\.app-shell-bar\s*\{[^}]*display:\s*none/.test(css));
check('parent shell exposes dedicated management nav', [
    /class="[^"]*parent-shell-nav/.test(html),
    /data-parent-shell-nav="parent"[\s\S]{0,220}switchPage\('parent'\)/.test(html),
    /data-parent-shell-nav="settings"[\s\S]{0,220}switchPage\('settings'\)/.test(html),
    /data-parent-shell-nav="works"[\s\S]{0,220}switchPage\('works'\)/.test(html),
    /data-parent-shell-nav="tools"[\s\S]{0,220}switchPage\('tools'\)/.test(html),
    /data-parent-shell-nav="app"[\s\S]{0,220}switchPage\('map'\)/.test(html)
].every(Boolean));
check('parent shell nav is only visible in parent shell', /body\.shell-parent\s+\.parent-shell-nav\s*\{[^}]*display:\s*flex/.test(css) && /body\.shell-app\s+\.parent-shell-nav\s*\{[^}]*display:\s*none/.test(css));
check('app shell syncs parent management nav current state', /\[data-parent-shell-nav\]/.test(appJs) && /item\.dataset\.parentShellNav/.test(appJs));
check('local lucide-lite includes shell navigation icons', ['home', 'settings', 'star', 'book-open', 'paw-print', 'map', 'gamepad-2', 'wrench'].every((name) => lucideLiteJs.includes(`${name}:`) || lucideLiteJs.includes(`'${name}':`)));

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
