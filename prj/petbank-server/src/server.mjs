import http from 'node:http';

import {
    assertPassword,
    createAccessToken,
    createId,
    createInviteCode,
    createRefreshToken,
    hashPassword,
    hashRefreshToken,
    hashRegistrationCode,
    normalizeUsername,
    normalizeRegistrationCode,
    verifyAccessToken,
    verifyPassword,
} from './security.mjs';

const JSON_HEADERS = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
};
const SESSION_COOKIE_NAME = 'petbank_access_token';

function sendJson(response, statusCode, payload, config, extraHeaders = {}) {
    const headers = { ...JSON_HEADERS, ...extraHeaders };
    if (config.allowedOrigin) {
        headers['access-control-allow-origin'] = config.allowedOrigin;
        headers.vary = 'Origin';
    }
    response.writeHead(statusCode, headers);
    response.end(JSON.stringify(payload));
}

function sendError(response, statusCode, code, message, config, details) {
    sendJson(response, statusCode, { error: { code, message, ...(details ? { details } : {}) } }, config);
}

function accountView(row) {
    return {
        id: row.id,
        username: row.username || row.identifier || row.email,
        displayName: row.display_name,
        createdAt: row.created_at,
        accessStatus: row.access_status,
    };
}

function householdView(row) {
    return { id: row.id, name: row.name, ownerAccountId: row.owner_account_id, createdAt: row.created_at };
}

function childView(row) {
    return {
        id: row.id,
        householdId: row.household_id,
        name: row.name,
        localProfileId: row.local_profile_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function parseJsonBody(request) {
    return new Promise((resolve, reject) => {
        let body = '';
        let size = 0;
        request.setEncoding('utf8');
        request.on('data', (chunk) => {
            size += Buffer.byteLength(chunk);
            if (size > 1024 * 1024) {
                reject(new Error('BODY_TOO_LARGE'));
                request.destroy();
                return;
            }
            body += chunk;
        });
        request.on('end', () => {
            if (!body.trim()) return resolve({});
            try {
                const value = JSON.parse(body);
                if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_JSON');
                resolve(value);
            } catch {
                reject(new Error('INVALID_JSON'));
            }
        });
        request.on('error', reject);
    });
}

function getBearerToken(request) {
    const value = String(request.headers.authorization || '');
    return value.startsWith('Bearer ') ? value.slice(7).trim() : '';
}

function getCookie(request, name) {
    const cookies = String(request.headers.cookie || '').split(';');
    for (const item of cookies) {
        const separator = item.indexOf('=');
        if (separator === -1) continue;
        if (item.slice(0, separator).trim() === name) return item.slice(separator + 1).trim();
    }
    return '';
}

function requireAccount(request, database, config) {
    const token = getBearerToken(request) || getCookie(request, SESSION_COOKIE_NAME);
    if (!token) throw Object.assign(new Error('UNAUTHORIZED'), { statusCode: 401 });
    let claims;
    try {
        claims = verifyAccessToken(token, config.jwtSecret);
    } catch {
        throw Object.assign(new Error('UNAUTHORIZED'), { statusCode: 401 });
    }
    const account = database.prepare('select * from accounts where id = ?').get(claims.sub);
    if (!account) throw Object.assign(new Error('UNAUTHORIZED'), { statusCode: 401 });
    return account;
}

function requireMember(database, accountId, householdId) {
    const member = database.prepare(`
        select hm.*, h.name, h.owner_account_id, h.created_at
        from household_members hm
        join households h on h.id = hm.household_id
        where hm.household_id = ? and hm.account_id = ?
    `).get(householdId, accountId);
    if (!member) throw Object.assign(new Error('FORBIDDEN'), { statusCode: 403 });
    return member;
}

function requireHouseholdOwner(database, accountId, householdId) {
    const member = requireMember(database, accountId, householdId);
    if (member.role !== 'owner') throw Object.assign(new Error('FORBIDDEN'), { statusCode: 403 });
    return member;
}

function requireChild(database, accountId, childId) {
    const child = database.prepare('select * from children where id = ?').get(childId);
    if (!child) throw Object.assign(new Error('CHILD_NOT_FOUND'), { statusCode: 404 });
    requireMember(database, accountId, child.household_id);
    return child;
}

function validateName(value, field) {
    const name = String(value || '').trim();
    if (!name || name.length > 80) throw Object.assign(new Error(`INVALID_${field.toUpperCase()}`), { statusCode: 400 });
    return name;
}

function issueSession(database, config, accountId, now = Math.floor(Date.now() / 1000)) {
    const accessToken = createAccessToken(accountId, config.jwtSecret, config.accessTokenTtlSeconds, now);
    const refreshToken = createRefreshToken();
    const refreshTokenId = createId();
    database.prepare(`
        insert into auth_refresh_tokens (id, account_id, token_hash, expires_at)
        values (?, ?, ?, ?)
    `).run(refreshTokenId, accountId, hashRefreshToken(refreshToken), now + config.refreshTokenTtlSeconds);
    return { accessToken, refreshToken, expiresIn: config.accessTokenTtlSeconds };
}

function sessionCookie(config, token, maxAge) {
    const secure = (config.sessionCookieSecure ?? config.production) ? '; Secure' : '';
    return `${SESSION_COOKIE_NAME}=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${secure}`;
}

function clearSessionCookie(config) {
    const secure = (config.sessionCookieSecure ?? config.production) ? '; Secure' : '';
    return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${secure}`;
}

function requireAccountAccess(database, account, now = Math.floor(Date.now() / 1000)) {
    if (account.access_status !== 'active') throw Object.assign(new Error('ACCESS_NOT_AUTHORIZED'), { statusCode: 403 });
    if (!account.authorization_required) return null;
    const grant = database.prepare(`
        select * from account_access_grants
        where account_id = ? and revoked_at is null
          and (expires_at is null or expires_at > ?)
        order by created_at desc limit 1
    `).get(account.id, now);
    if (!grant) throw Object.assign(new Error('ACCESS_NOT_AUTHORIZED'), { statusCode: 403 });
    return grant;
}

function findRegistrationInvite(database, code, secret, now = Math.floor(Date.now() / 1000)) {
    const normalized = normalizeRegistrationCode(code);
    if (!normalized) throw Object.assign(new Error('REGISTRATION_CODE_REQUIRED'), { statusCode: 400 });
    const invite = database.prepare('select * from registration_invites where code_hash = ?')
        .get(hashRegistrationCode(normalized, secret));
    if (!invite || invite.revoked_at || (invite.expires_at != null && invite.expires_at <= now) || invite.used_count >= invite.max_uses) {
        throw Object.assign(new Error('REGISTRATION_INVITE_NOT_FOUND'), { statusCode: 400 });
    }
    return invite;
}

function publicInvite(row) {
    return { id: row.id, householdId: row.household_id, code: row.code, role: row.role, expiresAt: row.expires_at };
}

function mapKnownError(error) {
    if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') return { statusCode: 409, code: 'ALREADY_EXISTS', message: 'The requested record already exists.' };
    if (error?.message === 'INVALID_USERNAME') return { statusCode: 400, code: 'INVALID_USERNAME', message: '用户名需为 3 到 32 位字母、数字或下划线，且以字母开头。' };
    if (error?.message === 'INVALID_PASSWORD') return { statusCode: 400, code: 'INVALID_PASSWORD', message: '密码长度需为 8 到 128 个字符。' };
    if (error?.message === 'INVALID_JSON') return { statusCode: 400, code: 'INVALID_JSON', message: '请求数据格式不正确。' };
    if (error?.message === 'BODY_TOO_LARGE') return { statusCode: 413, code: 'BODY_TOO_LARGE', message: '请求内容过大。' };
    if (error?.message === 'INVALID_NAME') return { statusCode: 400, code: 'INVALID_NAME', message: '名称不能为空且不能超过 80 个字符。' };
    if (error?.message === 'INVALID_CHILD_NAME') return { statusCode: 400, code: 'INVALID_CHILD_NAME', message: '孩子昵称不能为空且不能超过 80 个字符。' };
    if (error?.message === 'FORBIDDEN') return { statusCode: 403, code: 'FORBIDDEN', message: '没有权限访问该家庭数据。' };
    if (error?.message === 'CHILD_NOT_FOUND') return { statusCode: 404, code: 'CHILD_NOT_FOUND', message: '孩子档案不存在。' };
    if (error?.message === 'UNAUTHORIZED') return { statusCode: 401, code: 'UNAUTHORIZED', message: '登录状态已失效，请重新登录。' };
    if (error?.message === 'HOUSEHOLD_NOT_FOUND') return { statusCode: 404, code: 'HOUSEHOLD_NOT_FOUND', message: '家庭不存在。' };
    if (error?.message === 'INVITE_NOT_FOUND') return { statusCode: 404, code: 'INVITE_NOT_FOUND', message: '邀请码不存在、已使用或已过期。' };
    if (error?.message === 'SNAPSHOT_REVISION_CONFLICT') return { statusCode: 409, code: 'SNAPSHOT_REVISION_CONFLICT', message: '本地数据版本落后，请先恢复最新快照。' };
    if (error?.message === 'REGISTRATION_DISABLED') return { statusCode: 403, code: 'REGISTRATION_DISABLED', message: '当前暂未开放注册。' };
    if (error?.message === 'REGISTRATION_CODE_REQUIRED') return { statusCode: 400, code: 'REGISTRATION_CODE_REQUIRED', message: '注册需要管理员提供的注册码。' };
    if (error?.message === 'REGISTRATION_INVITE_NOT_FOUND') return { statusCode: 400, code: 'REGISTRATION_INVITE_NOT_FOUND', message: '注册码不存在、已使用、已撤销或已过期。' };
    if (error?.message === 'ACCESS_NOT_AUTHORIZED') return { statusCode: 403, code: 'ACCESS_NOT_AUTHORIZED', message: '当前账号尚未获得使用授权或授权已失效。' };
    if (error?.message === 'INVALID_CREDENTIALS') return { statusCode: 401, code: 'INVALID_CREDENTIALS', message: '账号或密码不正确。' };
    if (error?.message === 'REFRESH_REUSED') return { statusCode: 401, code: 'REFRESH_REUSED', message: '刷新凭证已失效，请重新登录。' };
    if (error?.message === 'OWNER_CANNOT_BE_REMOVED') return { statusCode: 409, code: 'OWNER_CANNOT_BE_REMOVED', message: '家庭所有者不能被移除。' };
    if (error?.message === 'MEMBER_NOT_FOUND') return { statusCode: 404, code: 'MEMBER_NOT_FOUND', message: '家庭成员不存在。' };
    if (error?.message === 'ACCOUNT_OWNS_HOUSEHOLDS') return { statusCode: 409, code: 'ACCOUNT_OWNS_HOUSEHOLDS', message: '请先转移或删除名下家庭，再删除账号。' };
    if (error?.message === 'INVALID_PASSWORD_CONFIRMATION') return { statusCode: 400, code: 'INVALID_PASSWORD_CONFIRMATION', message: '请输入当前账号密码确认。' };
    if (error?.message === 'INVALID_SNAPSHOT') return { statusCode: 400, code: 'INVALID_SNAPSHOT', message: '快照版本或内容不正确。' };
    return { statusCode: error?.statusCode || 500, code: 'INTERNAL_ERROR', message: error?.statusCode ? '请求无法完成。' : '服务器暂时无法处理请求。' };
}

export function createServer({ config, database }) {
    const json = (response, status, payload, headers) => sendJson(response, status, payload, config, headers);
    return http.createServer(async (request, response) => {
        if (request.method === 'OPTIONS') {
            response.writeHead(204, {
                'access-control-allow-origin': config.allowedOrigin || '*',
                'access-control-allow-headers': 'authorization, content-type',
                'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
                'access-control-max-age': '86400',
            });
            response.end();
            return;
        }
        const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
        try {
            if (request.method === 'GET' && url.pathname === '/api/v1/health') {
                const migrationCount = database.prepare('select count(*) as count from schema_migrations').get().count;
                return json(response, 200, { ok: true, service: 'petbank-server', migrationCount });
            }

            if (request.method === 'POST' && url.pathname === '/api/v1/auth/register') {
                if (!config.enableRegistration) throw new Error('REGISTRATION_DISABLED');
                const body = await parseJsonBody(request);
                const username = normalizeUsername(body.username);
                assertPassword(body.password);
                const displayName = validateName(body.displayName || '家长', 'name');
                const accountId = createId();
                const email = `${username}@local.petbank.invalid`;
                const now = Math.floor(Date.now() / 1000);
                const registrationCode = normalizeRegistrationCode(body.registrationCode);
                let invite = null;
                try {
                    database.transaction(() => {
                        if (config.requireRegistrationCode || registrationCode) {
                            invite = findRegistrationInvite(database, registrationCode, config.jwtSecret, now);
                        }
                        database.prepare(`insert into accounts (id, email, identifier, username, password_hash, display_name, authorization_required) values (?, ?, ?, ?, ?, ?, ?)`)
                            .run(accountId, email, username, username, hashPassword(body.password), displayName, invite ? 1 : 0);
                        if (invite) {
                            const consumed = database.prepare(`
                                update registration_invites
                                set used_count = used_count + 1
                                where id = ? and revoked_at is null
                                  and (expires_at is null or expires_at > ?)
                                  and used_count < max_uses
                            `).run(invite.id, now);
                            if (consumed.changes !== 1) throw Object.assign(new Error('REGISTRATION_INVITE_NOT_FOUND'), { statusCode: 400 });
                            database.prepare('insert into account_access_grants (id, account_id, registration_invite_id, expires_at) values (?, ?, ?, ?)')
                                .run(createId(), accountId, invite.id, invite.authorization_expires_at);
                        }
                    })();
                } catch (error) {
                    if (String(error?.message).includes('UNIQUE')) throw Object.assign(new Error('ACCOUNT_EXISTS'), { statusCode: 409 });
                    throw error;
                }
                const session = issueSession(database, config, accountId);
                const account = database.prepare('select * from accounts where id = ?').get(accountId);
                return json(response, 201, { ...session, account: accountView(account) }, {
                    'set-cookie': sessionCookie(config, session.accessToken, session.expiresIn),
                });
            }

            if (request.method === 'POST' && url.pathname === '/api/v1/auth/login') {
                const body = await parseJsonBody(request);
                const username = normalizeUsername(body.username);
                const account = database.prepare('select * from accounts where username = ? or identifier = ?').get(username, username);
                if (!account || !verifyPassword(body.password, account.password_hash)) throw new Error('INVALID_CREDENTIALS');
                requireAccountAccess(database, account);
                const session = issueSession(database, config, account.id);
                return json(response, 200, { ...session, account: accountView(account) }, {
                    'set-cookie': sessionCookie(config, session.accessToken, session.expiresIn),
                });
            }

            if (request.method === 'POST' && url.pathname === '/api/v1/auth/refresh') {
                const body = await parseJsonBody(request);
                const token = String(body.refreshToken || '');
                const now = Math.floor(Date.now() / 1000);
                const current = database.prepare(`select * from auth_refresh_tokens where token_hash = ?`).get(hashRefreshToken(token));
                if (!current || current.revoked_at || current.expires_at <= now) throw new Error('REFRESH_REUSED');
                const refreshAccount = database.prepare('select * from accounts where id = ?').get(current.account_id);
                if (!refreshAccount) throw new Error('REFRESH_REUSED');
                requireAccountAccess(database, refreshAccount, now);
                const nextToken = createRefreshToken();
                const nextId = createId();
                database.transaction(() => {
                    database.prepare('insert into auth_refresh_tokens (id, account_id, token_hash, expires_at) values (?, ?, ?, ?)')
                        .run(nextId, current.account_id, hashRefreshToken(nextToken), now + config.refreshTokenTtlSeconds);
                    database.prepare('update auth_refresh_tokens set revoked_at = ?, replaced_by_id = ? where id = ?').run(now, nextId, current.id);
                })();
                const accessToken = createAccessToken(current.account_id, config.jwtSecret, config.accessTokenTtlSeconds, now);
                return json(response, 200, {
                    accessToken,
                    refreshToken: nextToken,
                    expiresIn: config.accessTokenTtlSeconds,
                }, { 'set-cookie': sessionCookie(config, accessToken, config.accessTokenTtlSeconds) });
            }

            if (request.method === 'POST' && url.pathname === '/api/v1/auth/logout') {
                const body = await parseJsonBody(request);
                if (body.refreshToken) database.prepare('update auth_refresh_tokens set revoked_at = coalesce(revoked_at, ?) where token_hash = ?')
                    .run(Math.floor(Date.now() / 1000), hashRefreshToken(body.refreshToken));
                return json(response, 204, {}, { 'set-cookie': clearSessionCookie(config) });
            }

            if (request.method === 'GET' && url.pathname === '/api/v1/auth/check') {
                const account = requireAccount(request, database, config);
                requireAccountAccess(database, account);
                return json(response, 204, {});
            }

            const account = requireAccount(request, database, config);
            requireAccountAccess(database, account);
            if (request.method === 'DELETE' && url.pathname === '/api/v1/auth/account') {
                const body = await parseJsonBody(request);
                const password = String(body.password || '');
                if (!password) throw new Error('INVALID_PASSWORD_CONFIRMATION');
                if (!verifyPassword(password, account.password_hash)) throw new Error('INVALID_CREDENTIALS');
                const ownedHouseholds = database.prepare('select count(*) as count from households where owner_account_id = ?').get(account.id).count;
                if (ownedHouseholds > 0) throw new Error('ACCOUNT_OWNS_HOUSEHOLDS');
                database.transaction(() => {
                    database.prepare('delete from auth_refresh_tokens where account_id = ?').run(account.id);
                    database.prepare('delete from accounts where id = ?').run(account.id);
                })();
                return json(response, 204, {});
            }
            if (request.method === 'GET' && url.pathname === '/api/v1/auth/me') {
                return json(response, 200, { account: accountView(account) });
            }

            if (request.method === 'GET' && url.pathname === '/api/v1/households') {
                const households = database.prepare(`select h.* from households h join household_members hm on hm.household_id = h.id where hm.account_id = ? order by h.created_at`).all(account.id);
                return json(response, 200, { households: households.map(householdView) });
            }

            if (request.method === 'POST' && url.pathname === '/api/v1/households') {
                const body = await parseJsonBody(request);
                const name = validateName(body.name, 'name');
                const householdId = createId();
                database.transaction(() => {
                    database.prepare('insert into households (id, owner_account_id, name) values (?, ?, ?)').run(householdId, account.id, name);
                    database.prepare("insert into household_members (household_id, account_id, role) values (?, ?, 'owner')").run(householdId, account.id);
                })();
                const household = database.prepare('select * from households where id = ?').get(householdId);
                return json(response, 201, { household: householdView(household) });
            }

            const membersMatch = url.pathname.match(/^\/api\/v1\/households\/([^/]+)\/members$/);
            if (request.method === 'GET' && membersMatch) {
                const householdId = membersMatch[1];
                requireMember(database, account.id, householdId);
                const members = database.prepare(`select a.id, a.username, a.identifier, a.email, a.display_name, a.created_at, hm.role, hm.created_at as joined_at from household_members hm join accounts a on a.id = hm.account_id where hm.household_id = ? order by hm.created_at`).all(householdId);
                return json(response, 200, { members: members.map((member) => ({ account: accountView(member), role: member.role, joinedAt: member.joined_at })) });
            }

            const memberPath = url.pathname.match(/^\/api\/v1\/households\/([^/]+)\/members\/([^/]+)$/);
            if (request.method === 'DELETE' && memberPath) {
                const householdId = memberPath[1];
                const targetAccountId = memberPath[2];
                const actingMember = requireMember(database, account.id, householdId);
                const targetMember = database.prepare('select role from household_members where household_id = ? and account_id = ?')
                    .get(householdId, targetAccountId);
                if (!targetMember) throw Object.assign(new Error('MEMBER_NOT_FOUND'), { statusCode: 404 });
                if (targetMember.role === 'owner') throw new Error('OWNER_CANNOT_BE_REMOVED');
                if (actingMember.role !== 'owner' && targetAccountId !== account.id) {
                    throw Object.assign(new Error('FORBIDDEN'), { statusCode: 403 });
                }
                database.prepare('delete from household_members where household_id = ? and account_id = ?').run(householdId, targetAccountId);
                return json(response, 204, {});
            }

            const inviteMatch = url.pathname.match(/^\/api\/v1\/households\/([^/]+)\/invites$/);
            if (request.method === 'POST' && inviteMatch) {
                const householdId = inviteMatch[1];
                const member = requireMember(database, account.id, householdId);
                if (member.role !== 'owner') throw Object.assign(new Error('FORBIDDEN'), { statusCode: 403 });
                const body = await parseJsonBody(request);
                const expiresIn = Math.min(Math.max(Number(body.expiresInSeconds || 7 * 86400), 3600), 30 * 86400);
                let code;
                for (let attempt = 0; attempt < 5; attempt += 1) {
                    const candidate = createInviteCode();
                    if (!database.prepare('select 1 from household_invites where code = ?').get(candidate)) { code = candidate; break; }
                }
                if (!code) throw new Error('INTERNAL_ERROR');
                const inviteId = createId();
                const invite = { id: inviteId, household_id: householdId, code, role: 'parent', expires_at: Math.floor(Date.now() / 1000) + expiresIn };
                database.prepare('insert into household_invites (id, household_id, created_by_account_id, code, expires_at) values (?, ?, ?, ?, ?)')
                    .run(inviteId, householdId, account.id, code, invite.expires_at);
                return json(response, 201, { invite: publicInvite(invite) });
            }

            if (request.method === 'POST' && url.pathname === '/api/v1/household-invites/redeem') {
                const body = await parseJsonBody(request);
                const invite = database.prepare('select * from household_invites where code = ?').get(String(body.code || '').trim().toUpperCase());
                const now = Math.floor(Date.now() / 1000);
                if (!invite || invite.redeemed_at || invite.expires_at <= now) throw new Error('INVITE_NOT_FOUND');
                database.transaction(() => {
                    database.prepare("insert or ignore into household_members (household_id, account_id, role) values (?, ?, 'parent')").run(invite.household_id, account.id);
                    database.prepare('update household_invites set redeemed_by_account_id = ?, redeemed_at = ? where id = ?').run(account.id, now, invite.id);
                })();
                const household = database.prepare('select * from households where id = ?').get(invite.household_id);
                return json(response, 200, { household: householdView(household) });
            }

            if (request.method === 'GET' && url.pathname === '/api/v1/children') {
                const householdId = url.searchParams.get('householdId');
                const households = householdId ? [householdId] : database.prepare('select household_id from household_members where account_id = ?').all(account.id).map((row) => row.household_id);
                households.forEach((id) => requireMember(database, account.id, id));
                const placeholders = households.map(() => '?').join(',') || "''";
                const children = database.prepare(`select * from children where household_id in (${placeholders}) order by created_at`).all(...households);
                return json(response, 200, { children: children.map(childView) });
            }

            if (request.method === 'POST' && url.pathname === '/api/v1/children') {
                const body = await parseJsonBody(request);
                const householdId = String(body.householdId || '');
                requireMember(database, account.id, householdId);
                const name = validateName(body.name, 'child_name');
                const localProfileId = body.localProfileId == null ? null : String(body.localProfileId).trim().slice(0, 120) || null;
                const childId = createId();
                try {
                    database.prepare('insert into children (id, household_id, name, local_profile_id) values (?, ?, ?, ?)').run(childId, householdId, name, localProfileId);
                } catch (error) {
                    if (String(error?.message).includes('UNIQUE')) throw Object.assign(new Error('ALREADY_EXISTS'), { statusCode: 409 });
                    throw error;
                }
                const child = database.prepare('select * from children where id = ?').get(childId);
                return json(response, 201, { child: childView(child) });
            }

            const childPath = url.pathname.match(/^\/api\/v1\/children\/([^/]+)$/);
            if (childPath && (request.method === 'GET' || request.method === 'PATCH' || request.method === 'DELETE')) {
                const child = requireChild(database, account.id, childPath[1]);
                if (request.method === 'GET') return json(response, 200, { child: childView(child) });
                if (request.method === 'DELETE') {
                    requireHouseholdOwner(database, account.id, child.household_id);
                    database.prepare('delete from children where id = ?').run(child.id);
                    return json(response, 204, {});
                }
                const body = await parseJsonBody(request);
                const name = validateName(body.name, 'child_name');
                database.prepare('update children set name = ?, updated_at = current_timestamp where id = ?').run(name, child.id);
                return json(response, 200, { child: childView(database.prepare('select * from children where id = ?').get(child.id)) });
            }

            const latestMatch = url.pathname.match(/^\/api\/v1\/children\/([^/]+)\/snapshots\/latest$/);
            if (request.method === 'GET' && latestMatch) {
                const child = requireChild(database, account.id, latestMatch[1]);
                const snapshot = database.prepare('select * from state_snapshots where child_id = ? order by revision desc limit 1').get(child.id);
                if (!snapshot) return json(response, 200, { snapshot: null });
                return json(response, 200, { snapshot: { id: snapshot.id, childId: snapshot.child_id, revision: snapshot.revision, payload: JSON.parse(snapshot.payload_json), createdAt: snapshot.created_at } });
            }

            const snapshotMatch = url.pathname.match(/^\/api\/v1\/children\/([^/]+)\/snapshots$/);
            if (request.method === 'POST' && snapshotMatch) {
                const child = requireChild(database, account.id, snapshotMatch[1]);
                const body = await parseJsonBody(request);
                const revision = Number(body.revision);
                if (!Number.isSafeInteger(revision) || revision < 1 || !body.payload || typeof body.payload !== 'object') throw Object.assign(new Error('INVALID_SNAPSHOT'), { statusCode: 400 });
                const latest = database.prepare('select revision from state_snapshots where child_id = ? order by revision desc limit 1').get(child.id);
                if (latest && revision <= latest.revision) throw new Error('SNAPSHOT_REVISION_CONFLICT');
                const snapshotId = createId();
                database.prepare('insert into state_snapshots (id, child_id, revision, payload_json) values (?, ?, ?, ?)')
                    .run(snapshotId, child.id, revision, JSON.stringify(body.payload));
                return json(response, 201, { snapshot: { id: snapshotId, childId: child.id, revision, payload: body.payload } });
            }

            return sendError(response, 404, 'NOT_FOUND', 'API route not found.', config);
        } catch (error) {
            const mapped = mapKnownError(error);
            if (error?.message === 'ACCOUNT_EXISTS') return sendError(response, 409, 'ACCOUNT_EXISTS', '该用户名已注册。', config);
            return sendError(response, mapped.statusCode, mapped.code, mapped.message, config);
        }
    });
}
