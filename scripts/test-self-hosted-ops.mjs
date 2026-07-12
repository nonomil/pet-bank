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

    assert.match(deploy, /SHARED_DIR=.*\/shared/);
    assert.match(deploy, /\$\{SHARED_DIR\}\/data/);
    assert.match(deploy, /\$\{SHARED_DIR\}\/server\.env/);
    assert.match(deploy, /current/);
    assert.match(deploy, /node --test prj\/petbank-server\/test/);
    assert.match(deploy, /backup-sqlite\.sh/);
    assert.match(deploy, /docker compose -p petbank-api stop api/);
    assert.match(deploy, /curl --fail .*\/app\//);
    assert.match(deploy, /curl --fail .*\/parent\//);
    assert.match(deploy, /docker compose -p petbank-api up -d --build/);
    assert.match(deploy, /nginx -t/);
    assert.match(deploy, /systemctl reload nginx/);
    assert.match(backup, /sha256sum/);
    assert.match(backup, /shared\/backups/);
    assert.match(restore, /PETBANK_CONFIRM_RESTORE/);
    assert.match(restore, /before-restore/);
    assert.match(restore, /PETBANK_COMPOSE_FILE/);
    assert.match(restore, /docker compose -f "\$COMPOSE_FILE" -p petbank-api/);
    assert.doesNotMatch(deploy, /rm\s+-rf\s+.*\/srv\/pet-bank/);
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
