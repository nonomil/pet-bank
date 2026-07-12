import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('js/parent-account.js', 'utf8');

assert.match(source, /parent-cloud-conflicts/, 'parent settings should render cloud conflict status');
assert.match(source, /data-parent-conflict-choice/, 'conflict actions should be addressable');
assert.match(source, /resolveCloudConflict/, 'conflict actions should call the Profile recovery API');
assert.match(source, /getCloudConflictExport/, 'conflict UI should expose a local backup export');
assert.match(source, /URL\.createObjectURL/, 'local conflict export should download a file');

console.log('PASS cloud conflict UI contract');
