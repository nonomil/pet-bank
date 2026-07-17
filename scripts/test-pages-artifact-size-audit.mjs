import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const repoRoot = process.cwd();
const auditScript = path.join(repoRoot, 'scripts', 'audit-pages-artifact-size.mjs');

function createFixture() {
    const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'petbank-pages-audit-'));
    fs.mkdirSync(path.join(fixture, 'js'), { recursive: true });
    fs.mkdirSync(path.join(fixture, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(fixture, 'index.html'), 'root');
    fs.writeFileSync(path.join(fixture, 'js', 'app.js'), 'duplicate-content');
    fs.writeFileSync(path.join(fixture, 'assets', 'a.png'), 'duplicate-content');
    fs.writeFileSync(path.join(fixture, 'assets', 'b.png'), 'unique-content');
    return fixture;
}

function runAudit(fixture, ...args) {
    return spawnSync(process.execPath, [auditScript, fixture, '--json', ...args], {
        cwd: repoRoot,
        encoding: 'utf8'
    });
}

test('reports artifact totals, top-level sizes, largest files, and duplicate content', () => {
    const fixture = createFixture();
    try {
        const result = runAudit(fixture);
        assert.equal(result.status, 0, result.stderr);
        const report = JSON.parse(result.stdout);
        assert.equal(report.files, 4);
        assert.equal(report.totalBytes, 52);
        assert.equal(report.topLevel.find((item) => item.path === 'assets').files, 2);
        assert.equal(report.largestFiles[0].path, 'assets/a.png');
        assert.equal(report.duplicateGroups.length, 1);
        assert.deepEqual(report.duplicateGroups[0].paths.sort(), ['assets/a.png', 'js/app.js']);
    } finally {
        fs.rmSync(fixture, { recursive: true, force: true });
    }
});

test('returns a failing status when the artifact exceeds the configured budget', () => {
    const fixture = createFixture();
    try {
        const result = runAudit(fixture, '--max-mib=0.000001');
        assert.equal(result.status, 1, result.stderr);
        const report = JSON.parse(result.stdout);
        assert.equal(report.budget.exceeded, true);
        assert.equal(report.budget.maxMiB, 0.000001);
    } finally {
        fs.rmSync(fixture, { recursive: true, force: true });
    }
});
