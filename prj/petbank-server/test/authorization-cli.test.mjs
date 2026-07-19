import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { openDatabase } from '../src/database.mjs';
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

        const database = openDatabase({ databasePath: path.join(dataDir, 'petbank.db') });
        database.prepare(`
            insert into accounts (id, email, password_hash, display_name, access_status, authorization_required, identifier, username)
            values (?, ?, ?, ?, 'active', 0, ?, ?)
        `).run('account-cli-test', 'cli-test@local.petbank.invalid', 'not-a-real-password-hash', 'CLI 账号', 'cli_test', 'cli_test');
        database.prepare(`
            insert into accounts (id, email, password_hash, display_name, access_status, authorization_required, identifier, username)
            values (?, ?, ?, ?, 'active', 1, ?, ?)
        `).run('account-cli-missing-grant', 'missing-grant@local.petbank.invalid', 'not-a-real-password-hash', '缺失授权', 'missing_grant', 'missing_grant');
        database.close();
        const accounts = JSON.parse(captureOutput(() => runAuthorizationCli(['list-accounts'], env)));
        const localAccount = accounts.find((account) => account.username === 'cli_test');
        const missingGrantAccount = accounts.find((account) => account.username === 'missing_grant');
        assert.equal(localAccount.authorizationStatus, 'not-required');
        assert.equal(localAccount.grantCodeHint, '');
        assert.equal(missingGrantAccount.authorizationStatus, 'missing');

        const revoked = JSON.parse(captureOutput(() => runAuthorizationCli(['revoke', issued.code], env)));
        assert.equal(revoked.ok, true);
        assert.equal(revoked.codeHint, issued.code.slice(-4));
    } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
});
