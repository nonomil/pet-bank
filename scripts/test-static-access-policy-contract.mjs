import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const routerSource = fs.readFileSync(new URL('../js/page-router.js', import.meta.url), 'utf8');
const window = {};
vm.runInNewContext(routerSource, { window });
const router = window.PetBankPageRouter;

for (const page of ['parent', 'picturebooks', 'playground', 'mathpk', 'hanzi', 'typing-defense', 'learning-arcade', 'word-memory-map', 'leaderboard']) {
    assert.equal(router.requiresAccess(page), false, `${page} should remain a public experience route`);
}
for (const page of ['map', 'today', 'learn', 'pet', 'explore', 'shop', 'works', 'tools']) {
    assert.equal(router.requiresAccess(page), true, `${page} should require authorization`);
}
assert.equal(router.requiresAccess('settings', 'family'), false, 'settings family must remain a public login entry');
assert.equal(router.requiresAccess('settings', 'account'), false, 'settings account must remain a public login entry');
assert.equal(router.requiresAccess('settings', 'learning'), true, 'settings learning must require authorization');

const appSource = fs.readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
assert.match(appSource, /requiresAccess\(page/, 'SPA navigation must consult the access policy');
assert.match(appSource, /checkAccess\(\)/, 'SPA navigation must check the self-hosted session');
assert.match(appSource, /核心页面已锁定/, 'SPA navigation must fail closed when the authorization service is unavailable');
console.log('PASS static access policy contract');
