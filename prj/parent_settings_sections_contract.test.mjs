import { readFileSync } from 'node:fs';

const html = readFileSync('index.html', 'utf8');
const css = readFileSync('css/style.css', 'utf8');

const results = [];
function check(name, cond, detail = '') {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

const settingsStart = html.indexOf('<div class="page" id="page-settings">');
const todayStart = html.indexOf('<div class="page" id="page-today">', settingsStart);
const settingsBlock = settingsStart >= 0 && todayStart > settingsStart ? html.slice(settingsStart, todayStart) : '';

check('settings page block was found', settingsBlock.length > 0);

[
    '账号与孩子',
    '家庭云端',
    '学习与题目',
    '规则模板',
    '高级与危险操作'
].forEach((title) => {
    check(`settings section title exists: ${title}`, settingsBlock.includes(title));
});

[
    'settings-account-list',
    'auth-root',
    'household-root',
    'social-root',
    'settings-learning-mode',
    'settings-math-diff',
    'diagnostics-root'
].forEach((id) => {
    check(`settings mount point preserved: ${id}`, settingsBlock.includes(`id="${id}"`));
});

check('settings page uses parent settings shell', /parent-settings-shell/.test(settingsBlock));
check('settings section CSS exists', /\.parent-settings-section/.test(css));
check('advanced section explains hidden data tools', /parentAdmin=1/.test(settingsBlock));

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
