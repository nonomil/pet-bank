import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const shell = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const routeScript = shell.match(/<script>\s*([\s\S]*?routeBasePrefix[\s\S]*?)<\/script>/)?.[1];

assert.ok(routeScript, 'the shell contains the route-correction bootstrap script');
assert.match(shell, /<base id="routeBase" href="\.\/">/, 'the app shell starts with a relative route base');
assert.match(shell, /<script src="js\/runtime-loader\.js(?:\?[^"']+)?"><\/script>/, 'the shell loads the runtime loader through the relative base');
assert.doesNotMatch(shell, /<script src="\/js\//, 'the shell does not use root-relative runtime scripts that break on Pages');

const location = {
    href: 'https://example.test/pet-bank/app/today/index.html?route=/app/learn',
    protocol: 'https:',
};
const window = {
    location,
    history: {
        state: null,
        replaceState(_state, _title, nextUrl) {
            location.href = new URL(nextUrl, location.href).href;
        },
    },
};

vm.runInNewContext(routeScript, { window, URL, console });

assert.equal(
    new URL(location.href).pathname,
    '/pet-bank/app/learn',
    'route correction preserves the Pages repository prefix when restoring a deep route'
);
assert.equal(new URL(location.href).search, '', 'the restored route query is removed from the address bar');

console.log('route-aware shell contract: PASS');
