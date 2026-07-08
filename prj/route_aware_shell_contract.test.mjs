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
check('route shell page sets classic app, immersive app, and parent page groups', /const\s+CLASSIC_APP_PAGES\s*=\s*new\s+Set/.test(appJs) && /const\s+APP_SHELL_PAGES\s*=\s*new\s+Set/.test(appJs) && /const\s+PARENT_SHELL_PAGES\s*=\s*new\s+Set/.test(appJs));
check('primary child tabs use classic navigation shell', [
    /CLASSIC_APP_PAGES\.has\(page\)\)\s*return\s+['"]home['"]/.test(appJs),
    /const\s+CLASSIC_APP_PAGES\s*=\s*new\s+Set\(\[[\s\S]*['"]map['"][\s\S]*['"]today['"][\s\S]*['"]learn['"][\s\S]*['"]pet['"][\s\S]*['"]explore['"][\s\S]*['"]playground['"][\s\S]*\]\)/.test(appJs),
    /classList\.toggle\(\s*['"]shell-home['"]/.test(appJs),
    /body\.shell-home\s+\.app-bottom-dock\s*\{[^}]*display:\s*none/.test(css)
].every(Boolean));
check('switchPage applies route shell classes', /function\s+applyRouteShell\s*\(\s*page\s*\)/.test(appJs) && /applyRouteShell\s*\(\s*page\s*\)/.test(appJs) && /classList\.toggle\(\s*['"]shell-home['"]/.test(appJs) && /classList\.toggle\(\s*['"]shell-app['"]/.test(appJs) && /classList\.toggle\(\s*['"]shell-parent['"]/.test(appJs));
check('app shell syncs active dock and lightweight status', /\[data-app-dock\]/.test(appJs) && /appShellPoints/.test(appJs) && /appShellChildName/.test(appJs));
check('app shell marks current app page and surface mode', /function\s+getAppShellSurface\s*\(\s*page\s*\)/.test(appJs) && /dataset\.appPage/.test(appJs) && /dataset\.appSurface/.test(appJs) && /return\s+['"]scene['"]/.test(appJs) && /return\s+['"]game['"]/.test(appJs) && /return\s+['"]focus['"]/.test(appJs));
check('app shell preserves raw app route page for deep fullscreen pages', /dataset\.appRoutePage\s*=\s*page/.test(appJs) && /delete\s+document\.body\.dataset\.appRoutePage/.test(appJs));
check('app shell hides legacy top nav and sidebar', /body\.shell-app\s+\.top-nav\s*\{[^}]*display:\s*none/.test(css) && /body\.shell-app\s+\.sidebar\s*\{[^}]*display:\s*none/.test(css));
check('app shell uses near fullscreen content and bottom dock', /body\.shell-app\s+\.page-shell\s*\{[^}]*max-width:\s*none/.test(css) && /body\.shell-app\s+\.app-bottom-dock\s*\{[^}]*display:\s*flex/.test(css));
check('app shell is reserved for deep gameplay pages', [
    /const\s+APP_SHELL_PAGES\s*=\s*new\s+Set\(\[[\s\S]*['"]walk['"][\s\S]*['"]card['"][\s\S]*['"]mathpk['"][\s\S]*['"]hanzi['"][\s\S]*['"]leaderboard['"][\s\S]*\]\)/.test(appJs),
    /body\.shell-app\[data-app-surface="game"\]\s+\.page-shell/.test(css),
    /body\.shell-app\[data-app-page="playground"\]/.test(css),
    /min-height:\s*calc\(100svh/.test(css)
].every(Boolean));
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
