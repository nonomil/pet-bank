#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig } from './config.mjs';
import { openDatabase } from './database.mjs';
import { createId, createInviteCode, hashRegistrationCode, normalizeRegistrationCode, registrationCodeHint } from './security.mjs';

function readOption(args, name, fallback) {
    const index = args.indexOf(name);
    if (index < 0) return fallback;
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(name + ' requires a value');
    return value;
}

function integerOption(args, name, fallback, minimum = 0) {
    const value = Number.parseInt(readOption(args, name, String(fallback)), 10);
    if (!Number.isInteger(value) || value < minimum) throw new Error(name + ' must be an integer >= ' + minimum);
    return value;
}

function usage() {
    console.log([
        'Usage:',
        '  node src/authorization-cli.mjs issue [--label LABEL] [--max-uses N] [--expires-days N] [--access-days N]',
        '  node src/authorization-cli.mjs revoke CODE',
        '  node src/authorization-cli.mjs revoke-account ACCOUNT_ID',
        '  node src/authorization-cli.mjs list',
        '  node src/authorization-cli.mjs list-accounts',
    ].join('\n'));
}

function issue(database, config, args) {
    const label = readOption(args, '--label', '').trim().slice(0, 120);
    const maxUses = integerOption(args, '--max-uses', 1, 1);
    const expiresDays = integerOption(args, '--expires-days', 7);
    const accessDays = integerOption(args, '--access-days', 365);
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = expiresDays === 0 ? null : now + expiresDays * 86400;
    const authorizationExpiresAt = accessDays === 0 ? null : now + accessDays * 86400;
    let code;
    let row;
    database.transaction(() => {
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const candidate = createInviteCode();
            try {
                const id = createId();
                database.prepare([
                    'insert into registration_invites',
                    '(id, code_hash, code_hint, label, max_uses, expires_at, authorization_expires_at)',
                    'values (?, ?, ?, ?, ?, ?, ?)',
                ].join(' ')).run(id, hashRegistrationCode(candidate, config.jwtSecret), registrationCodeHint(candidate), label, maxUses, expiresAt, authorizationExpiresAt);
                code = candidate;
                row = database.prepare('select * from registration_invites where id = ?').get(id);
                break;
            } catch (error) {
                if (!String(error && error.message).includes('UNIQUE')) throw error;
            }
        }
        if (!code) throw new Error('unable to generate a unique registration code');
    })();
    console.log(JSON.stringify({
        code,
        id: row.id,
        label: row.label,
        maxUses: row.max_uses,
        expiresAt: row.expires_at,
        authorizationExpiresAt: row.authorization_expires_at,
        warning: 'Save this code now. The database stores only its hash and it cannot be recovered later.',
    }, null, 2));
}

function revoke(database, config, rawCode) {
    const code = normalizeRegistrationCode(rawCode);
    if (!code) throw new Error('CODE is required');
    const now = Math.floor(Date.now() / 1000);
    const result = database.transaction(() => {
        const invite = database.prepare('select id from registration_invites where code_hash = ?').get(hashRegistrationCode(code, config.jwtSecret));
        if (!invite) return { changes: 0 };
        database.prepare('update registration_invites set revoked_at = coalesce(revoked_at, ?) where id = ?').run(now, invite.id);
        database.prepare('update account_access_grants set revoked_at = coalesce(revoked_at, ?) where registration_invite_id = ?').run(now, invite.id);
        return { changes: 1 };
    })();
    if (!result.changes) throw new Error('registration code not found');
    console.log(JSON.stringify({ ok: true, codeHint: registrationCodeHint(code), revoked: result.changes }));
}

function revokeAccount(database, accountId) {
    const id = String(accountId || '').trim();
    if (!id) throw new Error('ACCOUNT_ID is required');
    const result = database.prepare('update account_access_grants set revoked_at = coalesce(revoked_at, ?) where account_id = ?')
        .run(Math.floor(Date.now() / 1000), id);
    if (!result.changes) throw new Error('account authorization not found');
    console.log(JSON.stringify({ ok: true, accountId: id, revoked: result.changes }));
}

function list(database) {
    const rows = database.prepare([
        'select id, code_hint, label, max_uses, used_count, expires_at,',
        'authorization_expires_at, revoked_at, created_at',
        'from registration_invites order by created_at desc',
    ].join(' ')).all();
    console.log(JSON.stringify(rows.map((row) => ({
        id: row.id,
        codeHint: row.code_hint,
        label: row.label,
        maxUses: row.max_uses,
        usedCount: row.used_count,
        expiresAt: row.expires_at,
        authorizationExpiresAt: row.authorization_expires_at,
        revokedAt: row.revoked_at,
        createdAt: row.created_at,
    })), null, 2));
}

function listAccounts(database) {
    const now = Math.floor(Date.now() / 1000);
    const rows = database.prepare(`
        select a.id, a.username, a.display_name, a.access_status, a.authorization_required, a.created_at,
               g.expires_at as grant_expires_at, g.revoked_at as grant_revoked_at,
               g.created_at as grant_created_at, ri.code_hint as grant_code_hint
        from accounts a
        left join account_access_grants g on g.id = (
            select latest.id
            from account_access_grants latest
            where latest.account_id = a.id
            order by latest.created_at desc
            limit 1
        )
        left join registration_invites ri on ri.id = g.registration_invite_id
        order by a.created_at desc
    `).all();
    console.log(JSON.stringify(rows.map((row) => {
        let authorizationStatus = 'not-required';
        if (row.authorization_required) {
            authorizationStatus = !row.grant_created_at
                ? 'missing'
                : row.grant_revoked_at
                    ? 'revoked'
                    : row.grant_expires_at != null && row.grant_expires_at <= now
                        ? 'expired'
                        : 'active';
        }
        return {
            id: row.id,
            username: row.username,
            displayName: row.display_name,
            accessStatus: row.access_status,
            authorizationRequired: Boolean(row.authorization_required),
            authorizationStatus,
            grantCodeHint: row.grant_code_hint || '',
            grantCreatedAt: row.grant_created_at || null,
            grantExpiresAt: row.grant_expires_at || null,
            createdAt: row.created_at,
        };
    }), null, 2));
}

export function runAuthorizationCli(argv = process.argv.slice(2), env = process.env) {
    const command = argv[0] || 'help';
    if (command === 'help' || command === '--help' || command === '-h') {
        usage();
        return;
    }
    const config = loadConfig(env);
    const database = openDatabase(config);
    try {
        if (command === 'issue') issue(database, config, argv.slice(1));
        else if (command === 'revoke') revoke(database, config, argv[1]);
        else if (command === 'revoke-account') revokeAccount(database, argv[1]);
        else if (command === 'list') list(database);
        else if (command === 'list-accounts') listAccounts(database);
        else throw new Error('unknown command: ' + command);
    } finally {
        database.close();
    }
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const modulePath = path.resolve(fileURLToPath(import.meta.url));
if (entryPath === modulePath) {
    try {
        runAuthorizationCli();
    } catch (error) {
        console.error('authorization CLI failed: ' + error.message);
        process.exitCode = 1;
    }
}
