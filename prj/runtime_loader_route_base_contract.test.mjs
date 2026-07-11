import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/runtime-loader.js', import.meta.url), 'utf8');
const document = {
    baseURI: 'https://example.test/pet-bank/app/today/',
    currentScript: { src: 'https://example.test/pet-bank/js/runtime-loader.js' },
    scripts: [],
    head: { appendChild() {} },
    body: { appendChild() {} },
    createElement() { return { dataset: {} }; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
};
const window = { document, location: { href: document.baseURI }, setTimeout() {} };

vm.runInNewContext(source, { window, document, URL, Promise, Map, Object, Array, console });

assert.equal(
    window.PetBankRuntime.resolveAssetUrl('js/home.js'),
    'https://example.test/pet-bank/js/home.js',
    'runtime-loaded assets retain the Pages repository base on deep routes'
);
assert.equal(
    window.PetBankRuntime.resolveAssetUrl('/css/walk.css'),
    'https://example.test/pet-bank/css/walk.css',
    'leading slashes do not escape the Pages repository base'
);

console.log('runtime loader route base contract: PASS');
