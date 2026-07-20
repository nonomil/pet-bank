import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/page-router.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const window = { location: { pathname: '/', protocol: 'http:' } };
vm.runInNewContext(source, { window, URL });

const router = window.PetBankPageRouter;
assert.ok(router, 'page router should expose one named namespace');
assert.equal(router.getPageToTab('mathpk'), 'playground');
assert.equal(router.getPageToTab('minecraft-vocab'), 'learn');
assert.equal(router.getRouteShell('walk'), 'app');
assert.equal(router.getRouteShell('minecraft-vocab'), 'app');
assert.equal(router.getRouteShell('settings'), 'parent');
assert.equal(router.getAppShellSurface('mathpk'), 'game');
assert.equal(router.getAppShellSurface('minecraft-vocab'), 'focus');
assert.equal(router.getAppDockPage('mathpk'), 'playground');
assert.equal(router.getAppDockPage('minecraft-vocab'), 'minecraft-vocab');
assert.equal(router.normalizeSettingsSection('account'), 'family');
assert.equal(router.getPathForPage('settings', 'advanced'), '/settings/advanced');
assert.equal(router.getPathForPage('minecraft-vocab'), '/app/learn/minecraft-vocab');

const deepLocation = {
    pathname: '/pet-bank/app/playground/math-pk/index.html',
    hash: '',
    protocol: 'https:'
};
assert.equal(router.resolveRouteFromLocation(deepLocation).page, 'mathpk');
assert.equal(router.resolveRouteFromLocation({ pathname: '/pet-bank/app/learn/minecraft-vocab/index.html' }).page, 'minecraft-vocab');
assert.equal(router.resolveRouteFromLocation({ pathname: '/index.html', search: '?route=%2Fparent%2Fsettings%2Ffamily' }).settingsSection, 'family');
assert.equal(router.inferRouteBase(deepLocation.pathname), '/pet-bank');
assert.equal(router.withRouteBase('/prj/demo/index.html', deepLocation.pathname), '/pet-bank/prj/demo/index.html');
assert.equal(router.resolveRouteFromLocation({ pathname: '/ignored', hash: '#/settings/learning' }).settingsSection, 'learning');
assert.ok(index.lastIndexOf('js/page-router.js') < index.lastIndexOf('js/app.js'), 'page router must load before app.js');

console.log('PASS page router contract');
