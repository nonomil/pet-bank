import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

test('self-hosted shell scripts keep data outside releases and require restore confirmation', () => {
    const deploy = fs.readFileSync(path.join(root, 'ops', 'deploy-self-hosted.sh'), 'utf8');
    const backup = fs.readFileSync(path.join(root, 'ops', 'backup-sqlite.sh'), 'utf8');
    const restore = fs.readFileSync(path.join(root, 'ops', 'restore-sqlite.sh'), 'utf8');
    const issueCode = fs.readFileSync(path.join(root, 'ops', 'issue-registration-code.sh'), 'utf8');
    const revokeCode = fs.readFileSync(path.join(root, 'ops', 'revoke-registration-code.sh'), 'utf8');
    const listCodes = fs.readFileSync(path.join(root, 'ops', 'list-registration-codes.sh'), 'utf8');

    assert.match(deploy, /SHARED_DIR=.*\/shared/);
    assert.match(deploy, /\$\{SHARED_DIR\}\/data/);
    assert.match(deploy, /\$\{SHARED_DIR\}\/server\.env/);
    assert.match(deploy, /current/);
    assert.match(deploy, /node --test prj\/petbank-server\/test/);
    assert.match(deploy, /backup-sqlite\.sh/);
    assert.match(deploy, /docker compose -p petbank-api stop api/);
    assert.match(deploy, /STATIC_ROUTES=\("\/app\/" "\/parent\/"\)/);
    assert.match(deploy, /for static_route in "\$\{STATIC_ROUTES\[@\]\}"/);
    assert.match(deploy, /http:\/\/127\.0\.0\.1\$\{PETBANK_STATIC_PREFIX:-\}\$\{static_route\}/);
    assert.match(deploy, /docker compose -p petbank-api up -d --build/);
    assert.match(deploy, /nginx -t/);
    assert.match(deploy, /systemctl reload nginx/);
    assert.match(deploy, /STATIC_SITE_DIR="\$\{RELEASE_DIR\}\/site"/);
    assert.match(deploy, /GAME_RUNTIME_ENTRIES=\(/);
    assert.match(deploy, /app\/playground\/typing-defense-runtime\/web\/index\.html/);
    assert.match(deploy, /prj\/学习机玩法原型\/index\.html/);
    assert.match(deploy, /prj\/单词记忆射击场原型\/index\.html/);
    assert.match(deploy, /for runtime_entry in "\$\{GAME_RUNTIME_ENTRIES\[@\]\}"/);
    assert.match(deploy, /PREVIOUS_RELEASE="\$\(readlink -f "\$CURRENT_LINK" 2>\/dev\/null \|\| true\)"/);
    assert.match(deploy, /deployment failed after activation; restoring previous release/);
    assert.match(backup, /sha256sum/);
    assert.match(backup, /shared\/backups/);
    assert.match(restore, /PETBANK_CONFIRM_RESTORE/);
    assert.match(restore, /before-restore/);
    assert.match(restore, /PETBANK_COMPOSE_FILE/);
    assert.match(restore, /docker compose -f "\$COMPOSE_FILE" -p petbank-api/);
    assert.doesNotMatch(deploy, /rm\s+-rf\s+.*\/srv\/pet-bank/);
    assert.match(issueCode, /authorization-cli\.mjs issue/);
    assert.match(revokeCode, /authorization-cli\.mjs revoke/);
    assert.match(listCodes, /authorization-cli\.mjs list/);
});

test('Hermes declares the assembled site artifact as the self-hosted frontend root', () => {
    const hermes = fs.readFileSync(path.join(root, 'ops', 'hermes.yaml'), 'utf8');

    assert.match(hermes, /^\s*publicDir:\s*site\s*$/m);
});

test('backup script can copy a SQLite file and emit a checksum', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'petbank-ops-'));
    const data = path.join(tmp, 'data');
    const backups = path.join(tmp, 'backups');
    fs.mkdirSync(data);
    fs.writeFileSync(path.join(data, 'petbank.db'), 'sqlite-test');
    const script = fs.readFileSync(path.join(root, 'ops', 'backup-sqlite.sh'), 'utf8');
    assert.match(script, /cp --reflink=auto/);
    assert.ok(fs.existsSync(path.join(data, 'petbank.db')));
    fs.rmSync(tmp, { recursive: true, force: true });
    void backups;
});
