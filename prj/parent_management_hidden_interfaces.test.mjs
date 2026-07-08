import { readFileSync } from 'node:fs';

const toolsJs = readFileSync('js/tools.js', 'utf8');
const appJs = readFileSync('js/app.js', 'utf8');
const indexHtml = readFileSync('index.html', 'utf8');

const results = [];
function check(name, cond, detail = '') {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

check('top nav exposes parent zone wording', /家长区/.test(indexHtml));
check('top nav opens dedicated parent home', /data-page="parent"[\s\S]{0,160}switchPage\('parent'\)/.test(indexHtml));
check('parent home exists before settings page', indexHtml.indexOf('id="page-parent"') >= 0 && indexHtml.indexOf('id="page-parent"') < indexHtml.indexOf('id="page-settings"'));
check('management leaf pages map to parent tab', /parent:\s*'parent'/.test(appJs) && /works:\s*'parent',\s*tools:\s*'parent',\s*settings:\s*'parent'/.test(appJs));
check('parent home links to management leaves', [
    /data-parent-entry="works"[\s\S]{0,220}switchPage\('works'\)/.test(indexHtml),
    /data-parent-entry="tools"[\s\S]{0,220}switchPage\('tools'\)/.test(indexHtml),
    /data-parent-entry="settings"[\s\S]{0,220}switchPage\('settings'\)/.test(indexHtml)
].every(Boolean));
const menuStart = appJs.indexOf('playground: [');
const menuEnd = appJs.indexOf(']', menuStart);
const playgroundMenuBlock = menuStart >= 0 && menuEnd > menuStart ? appJs.slice(menuStart, menuEnd) : '';
check('playground menu block was found', playgroundMenuBlock.length > 0);
check('playground menu does not expose tools/settings/works', !/(成长作品|工具箱|设置|page:\s*'works'|page:\s*'tools'|page:\s*'settings')/.test(playgroundMenuBlock), playgroundMenuBlock);
check('toolbox has advanced tools flag', /petbank_parent_admin_tools/.test(toolsJs));
check('advanced tools can be enabled by parentAdmin url param', /parentAdmin/.test(toolsJs));
check('data management card is gated', /if\s*\(\s*_isAdvancedToolsEnabled\(\)\s*\)\s*\{\s*cardRow\.appendChild\(createCard\('数据管理'/.test(toolsJs));
check('random picker remains visible by default', /cardRow\.appendChild\(createCard\('随机点名'/.test(toolsJs));
check('pomodoro remains visible by default', /cardRow\.appendChild\(createCard\('番茄计时'/.test(toolsJs));

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
