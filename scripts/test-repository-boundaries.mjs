import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const boundariesPath = path.join(root, 'docs_project', 'PROJECT-BOUNDARIES.md');
const cleanupRunbookPath = path.join(root, 'docs_project', 'runbooks', 'repository-cleanup.md');
const gitignorePath = path.join(root, '.gitignore');
const artifactScriptPath = path.join(root, 'scripts', 'assemble-pages-artifact.mjs');

for (const file of [boundariesPath, cleanupRunbookPath, gitignorePath, artifactScriptPath]) {
    assert.ok(fs.existsSync(file), `required repository-boundary file should exist: ${file}`);
}

const boundaries = fs.readFileSync(boundariesPath, 'utf8');
const cleanupRunbook = fs.readFileSync(cleanupRunbookPath, 'utf8');
const gitignore = fs.readFileSync(gitignorePath, 'utf8');
const artifactScript = fs.readFileSync(artifactScriptPath, 'utf8');

for (const requiredSection of [
    '网页运行时',
    '受版本控制源码',
    '原始素材',
    '可再生成产物',
    '本地缓存',
    '参考资料'
]) {
    assert.match(boundaries, new RegExp(requiredSection), `boundaries should document ${requiredSection}`);
}

assert.match(cleanupRunbook, /禁止删除/, 'cleanup runbook should identify protected directories');
assert.match(cleanupRunbook, /验证/, 'cleanup runbook should provide verification steps');
assert.match(gitignore, /^tmp\/$/m, 'temporary workspace should stay ignored');
assert.match(gitignore, /^docs\/\*$/m, 'local research docs should stay ignored by default');
assert.match(gitignore, /^prj\/browser-act-imagegen\/$/m, 'browser profile workspace should stay ignored');
assert.match(artifactScript, /includeWordMemoryRuntime/, 'artifact assembly should use an explicit word-memory allowlist');
assert.match(artifactScript, /includeTypingDefenseRuntime/, 'artifact assembly should use an explicit typing-defense allowlist');
assert.doesNotMatch(artifactScript, /copyDir\('tmp'/, 'artifact assembly must not publish the temporary workspace');

console.log('PASS repository boundaries contract');
