import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { runAuthorizationCli } from '../src/authorization-cli.mjs';

function captureOutput(run) {
    const lines = [];
    const original = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try {
        run();
    } finally {
        console.log = original;
    }
    return lines.join('\n');
}

test('authorization CLI issues masked records and revokes a registration code', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'petbank-auth-cli-'));
    const env = {
        NODE_ENV: 'production',
        PETBANK_DATA_DIR: dataDir,
        PETBANK_JWT_SECRET: 'test-secret-that-is-long-enough-for-api-tests',
    };
    try {
        const issued = JSON.parse(captureOutput(() => runAuthorizationCli(['issue', '--label', 'CLI 测试', '--expires-days', '1', '--access-days', '30'], env)));
        assert.match(issued.code, /^[A-Z0-9]{8}$/);
        assert.equal(issued.label, 'CLI 测试');
        assert.match(issued.warning, /hash/);

        const listed = captureOutput(() => runAuthorizationCli(['list'], env));
        assert.match(listed, new RegExp(issued.code.slice(-4)));
        assert.doesNotMatch(listed, new RegExp(issued.code));

        const revoked = JSON.parse(captureOutput(() => runAuthorizationCli(['revoke', issued.code], env)));
        assert.equal(revoked.ok, true);
        assert.equal(revoked.codeHint, issued.code.slice(-4));
    } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
});
