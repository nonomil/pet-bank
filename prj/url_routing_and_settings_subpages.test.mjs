import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const appJs = readFileSync('js/app.js', 'utf8');
const artifactJs = readFileSync('scripts/assemble-pages-artifact.mjs', 'utf8');

const results = [];
function check(name, cond, detail = '') {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

check('app defines path to route resolver', /function\s+resolveRouteFromLocation\s*\(/.test(appJs));
check('app defines page to path resolver', /function\s+getPathForPage\s*\(/.test(appJs));
check('/settings maps to settings page', /['"]\/settings['"]\s*:\s*\{\s*page:\s*['"]settings['"]/.test(appJs));
check('/settings/account maps to account section', /['"]\/settings\/account['"]\s*:\s*\{\s*page:\s*['"]settings['"],\s*settingsSection:\s*['"]account['"]/.test(appJs));
check('/settings/family maps to family section', /['"]\/settings\/family['"]\s*:\s*\{\s*page:\s*['"]settings['"],\s*settingsSection:\s*['"]family['"]/.test(appJs));
check('/settings/learning maps to learning section', /['"]\/settings\/learning['"]\s*:\s*\{\s*page:\s*['"]settings['"],\s*settingsSection:\s*['"]learning['"]/.test(appJs));
check('child app canonical routes live under /app namespace', [
    /map:\s*['"]\/app['"]/.test(appJs),
    /today:\s*['"]\/app\/today['"]/.test(appJs),
    /learn:\s*['"]\/app\/learn['"]/.test(appJs),
    /pet:\s*['"]\/app\/pet['"]/.test(appJs),
    /playground:\s*['"]\/app\/playground['"]/.test(appJs)
].every(Boolean));
check('legacy child routes remain compatibility aliases', [
    /['"]\/['"]\s*:\s*\{\s*page:\s*['"]map['"]/.test(appJs),
    /['"]\/today['"]\s*:\s*\{\s*page:\s*['"]today['"]/.test(appJs),
    /['"]\/learn['"]\s*:\s*\{\s*page:\s*['"]learn['"]/.test(appJs),
    /['"]\/pet['"]\s*:\s*\{\s*page:\s*['"]pet['"]/.test(appJs),
    /['"]\/playground['"]\s*:\s*\{\s*page:\s*['"]playground['"]/.test(appJs)
].every(Boolean));
check('parent settings namespace aliases map to settings sections', [
    /['"]\/parent\/settings['"]\s*:\s*\{\s*page:\s*['"]settings['"],\s*settingsSection:\s*['"]home['"]/.test(appJs),
    /['"]\/parent\/settings\/account['"]\s*:\s*\{\s*page:\s*['"]settings['"],\s*settingsSection:\s*['"]account['"]/.test(appJs),
    /['"]\/parent\/settings\/family['"]\s*:\s*\{\s*page:\s*['"]settings['"],\s*settingsSection:\s*['"]family['"]/.test(appJs)
].every(Boolean));
check('/parent maps to dedicated parent home page', /['"]\/parent['"]\s*:\s*\{\s*page:\s*['"]parent['"]/.test(appJs));
check('parent home page has direct management entries', [
    /id="page-parent"/.test(html),
    /data-parent-entry="works"/.test(html),
    /data-parent-entry="tools"/.test(html),
    /data-parent-entry="settings"/.test(html)
].every(Boolean));
check('switchPage can skip history writes during route hydration', /switchPage\s*\(\s*page\s*,\s*options\s*=\s*\{\s*\}/.test(appJs) && /replace:\s*true/.test(appJs));
check('popstate listener restores page from URL', /addEventListener\s*\(\s*['"]popstate['"]/.test(appJs));
check('DOMContentLoaded init activates route from URL', /resolveRouteFromLocation\s*\(\s*window\.location/.test(appJs) && /switchPage\s*\(\s*initialRoute\.page/.test(appJs));
check('settings page exposes section shell', /class="[^"]*settings-subpage-shell/.test(html));
check('settings home panel exists', /data-settings-section="home"/.test(html));
check('settings account panel exists', /data-settings-section="account"/.test(html));
check('settings family panel exists', /data-settings-section="family"/.test(html));
check('settings learning panel exists', /data-settings-section="learning"/.test(html));
check('settings advanced panel exists', /data-settings-section="advanced"/.test(html));
check('settings nav links use independent URLs', /href="\/settings\/account"/.test(html) && /href="\/settings\/family"/.test(html));
check('settings sections keep existing mount ids', [
    'settings-account-list',
    'auth-root',
    'household-root',
    'social-root',
    'settings-learning-mode',
    'settings-math-diff',
    'diagnostics-root'
].every((id) => html.includes(`id="${id}"`)));
check('index declares a static base before relative assets on deep routes', /<base\s+id="routeBase"\s+href="\/">/.test(html) && html.indexOf('<base id="routeBase"') < html.indexOf('<link rel="preload"'));
check('route base script updates the static base element', /getElementById\(['"]routeBase['"]\)/.test(html) && /setAttribute\(['"]href['"],\s*base\)/.test(html));
check('base href route prefixes include app namespace', /routePrefixes\s*=\s*\[[^\]]*['"]\/app['"]/.test(html));
check('Pages artifact emits 404 fallback for deep links', /404\.html/.test(artifactJs) && /copyFile\('index\.html',\s*'404\.html'\)/.test(artifactJs));

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
