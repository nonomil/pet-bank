import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runnerPath = path.join(root, 'scripts', 'run-full-regression.mjs');
const runner = fs.readFileSync(runnerPath, 'utf8');
const taskList = runner.match(/const TASKS = \[([\s\S]*?)\n\];/)[1];
const taskBlocks = [...taskList.matchAll(/\{ label: '([^']+)', cmd: '([^']+)', args: \[([^\]]+)\] \}/g)];
const taskPaths = taskBlocks.map((match) => {
    const args = [...match[3].matchAll(/'([^']+)'/g)].map((arg) => arg[1]);
    return args[0] === '--test' ? args[1] : args[args.length - 1];
});

assert.ok(taskBlocks.length > 0, 'regression runner should declare at least one task');
assert.equal(taskPaths.length, taskBlocks.length, 'every regression task should expose a test path');
assert.equal(new Set(taskPaths).size, taskPaths.length, 'regression runner should not duplicate task paths');
assert.ok(taskPaths.includes('scripts/test-no-legacy-account-runtime.mjs'), 'regression runner should include the local-only runtime gate');

const missing = taskPaths.filter((taskPath) => !fs.existsSync(path.join(root, taskPath)));
assert.deepEqual(missing, [], `regression runner references missing files: ${missing.join(', ')}`);

console.log(`PASS regression runner integrity: ${taskPaths.length} task files exist`);
