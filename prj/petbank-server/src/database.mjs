import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(moduleDir, '..', 'db', 'migrations');

function applyMigrations(database) {
    database.exec(`
        create table if not exists schema_migrations (
            name text primary key,
            applied_at text not null default current_timestamp
        )
    `);

    const applied = new Set(database.prepare('select name from schema_migrations').all().map((row) => row.name));
    const migrationNames = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
    for (const name of migrationNames) {
        if (applied.has(name)) continue;
        database.exec(fs.readFileSync(path.join(migrationsDir, name), 'utf8'));
        database.prepare('insert into schema_migrations (name) values (?)').run(name);
    }
}

export function openDatabase({ databasePath }) {
    fs.mkdirSync(path.dirname(databasePath), { recursive: true });
    const database = new Database(databasePath);
    database.exec('pragma journal_mode = WAL; pragma foreign_keys = ON; pragma busy_timeout = 5000;');
    applyMigrations(database);
    return database;
}
