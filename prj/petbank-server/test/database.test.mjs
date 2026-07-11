import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { openDatabase } from '../src/database.mjs';

test('openDatabase applies the core migration exactly once', () => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'petbank-server-'));
    const databasePath = path.join(dataDir, 'petbank.db');

    const database = openDatabase({ databasePath });
    const migrations = database.prepare('select name from schema_migrations order by name').all();
    const tables = database.prepare("select name from sqlite_master where type = 'table'").all().map((row) => row.name);
    database.close();

    assert.deepEqual(migrations.map((row) => row.name), ['001_core.sql']);
    assert.deepEqual(['accounts', 'households', 'children', 'state_snapshots'].every((table) => tables.includes(table)), true);

    const reopened = openDatabase({ databasePath });
    assert.equal(reopened.prepare('select count(*) as count from schema_migrations').get().count, 1);
    reopened.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
});
