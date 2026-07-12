import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('js/task-catalog.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const window = {};
vm.runInNewContext(source, { window, Object, Array, String, RegExp });

const catalog = window.PetBankTaskCatalog;
assert.ok(catalog, 'task catalog should expose one named namespace');
assert.deepEqual(Object.keys(catalog.DIMENSIONS), ['learning', 'sports', 'selfcontrol', 'exploration', 'practice', 'petcare']);
assert.equal(Object.values(catalog.DIMENSIONS).reduce((sum, item) => sum + item.tasks.length, 0), 37);
assert.equal(catalog.HOME_PRIORITY_TASKS.length, 3);
assert.match(catalog.getPointTaskArt({ name: '阅读 20 分钟' }), /kidstar-reading/);
assert.ok(index.lastIndexOf('js/task-catalog.js') < index.lastIndexOf('js/app.js'), 'task catalog must load before app.js');

console.log('PASS task catalog contract');
