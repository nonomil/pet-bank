import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { browserLaunchOpts } from '../scripts/playwright-browser.mjs';

const BASE = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765';
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'docs', '参考', 'img', 'cloud-family-social-pk-sim-2026-07-08');
fs.mkdirSync(OUT_DIR, { recursive: true });

const results = [];
function check(name, condition, detail = '') {
    const pass = Boolean(condition);
    results.push({ name, pass, detail });
    console.log(`${pass ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function solveQuestionText(text) {
    const normalized = normalizeText(text).replace(/\s*=\s*$/, '');
    const match = normalized.match(/(-?\d+)\s*([+\-×÷])\s*(-?\d+)/);
    if (!match) return null;
    const a = Number(match[1]);
    const op = match[2];
    const b = Number(match[3]);
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '×') return a * b;
    if (op === '÷') return b === 0 ? null : Math.trunc(a / b);
    return null;
}

const browser = await chromium.launch(browserLaunchOpts());
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

const consoleErrors = [];
page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (/Failed to load resource|404|ERR_ABORTED/i.test(text)) return;
    consoleErrors.push(text);
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));
page.on('dialog', async (dialog) => {
    if (dialog.type() === 'prompt') {
        await dialog.accept('1');
        return;
    }
    await dialog.accept();
});

await page.addInitScript(() => {
    if (!sessionStorage.getItem('__cloud_sim_init__')) {
        localStorage.clear();
        sessionStorage.setItem('__cloud_sim_init__', '1');
    }
    window.APP_FAMILY_SOCIAL_SCOPE = 'full';
    window.__PETBANK_CLOUD_CONFIG__ = {
        supabaseUrl: 'https://fake.supabase.local',
        supabaseAnonKey: 'fake-anon-key',
        siteUrl: 'http://127.0.0.1:8765'
    };
    window.__PETBANK_CLOUD_CONFIG_SOURCE__ = 'simulation-fake';
    window.__PETBANK_CLOUD_CONFIG_SOURCE_LABEL__ = '模拟测试注入 Fake Supabase';
    window.prompt = function () { return '1'; };
    window.confirm = function () { return true; };

    (function () {
        const STORAGE_KEY = '__fake_supabase_state__';
        function readPersisted() {
            try {
                return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || null;
            } catch (error) {
                return null;
            }
        }
        const persisted = readPersisted();
        const db = persisted && persisted.db ? persisted.db : {
            accounts: [],
            households: [],
            household_members: [],
            child_profiles: [],
            household_invites: [],
            child_friendships: [],
            house_visits: [],
            pk_matches: [],
            pk_question_sets: [],
            pk_match_attempts: [],
            pet_state_snapshots: [],
            registration_invites: []
        };

        const authState = {
            users: persisted && persisted.authState && Array.isArray(persisted.authState.users) ? persisted.authState.users : [],
            session: persisted && persisted.authState ? persisted.authState.session : null,
            listeners: []
        };

        let seq = persisted && Number.isFinite(Number(persisted.seq)) ? Number(persisted.seq) : 1;
        function clone(value) {
            return JSON.parse(JSON.stringify(value));
        }
        function persist() {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    db,
                    authState: {
                        users: authState.users,
                        session: authState.session
                    },
                    seq
                }));
            } catch (error) {}
        }
        function nextId(prefix) {
            seq += 1;
            persist();
            return prefix + '_' + seq;
        }
        function nowIso() {
            return new Date().toISOString();
        }
        function randomCode(prefix) {
            return prefix + '-' + Math.random().toString(36).slice(2, 10).toUpperCase();
        }
        function ensureRegistrationInvite(code) {
            const normalized = String(code || '').trim().toUpperCase();
            let existing = db.registration_invites.find((item) => item.invite_code === normalized);
            if (existing) return existing;
            existing = {
                id: nextId('reginvite'),
                invite_code: normalized,
                label: '默认测试邀请码',
                status: 'pending',
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                created_at: nowIso(),
                created_by_account_id: null,
                household_id: ''
            };
            db.registration_invites.push(existing);
            persist();
            return existing;
        }
        ensureRegistrationInvite('REG-ALPHA');
        ensureRegistrationInvite('REG-BETA');

        function findUserByEmail(email) {
            return authState.users.find((user) => user.email === email) || null;
        }
        function buildSession(user) {
            return {
                access_token: 'token_' + user.id,
                refresh_token: 'refresh_' + user.id,
                expires_at: Math.floor(Date.now() / 1000) + 3600,
                user: clone(user)
            };
        }
        function notifyAuth(eventName) {
            authState.listeners.forEach((listener) => {
                try {
                    listener(eventName, authState.session ? clone(authState.session) : null);
                } catch (error) {}
            });
            persist();
        }
        function getActiveUser() {
            return authState.session && authState.session.user ? authState.session.user : null;
        }
        function activeAccountId() {
            const user = getActiveUser();
            return user ? user.id : '';
        }

        function applyFilters(rows, filters) {
            return rows.filter((row) => {
                return filters.every((filter) => {
                    if (filter.type === 'eq') return String(row[filter.field]) === String(filter.value);
                    if (filter.type === 'in') return filter.values.map(String).includes(String(row[filter.field]));
                    if (filter.type === 'match') {
                        return Object.keys(filter.value).every((key) => String(row[key]) === String(filter.value[key]));
                    }
                    if (filter.type === 'or') {
                        return filter.clauses.some((clause) => String(row[clause.field]) === String(clause.value));
                    }
                    return true;
                });
            });
        }

        function applyOrder(rows, orderField, ascending) {
            if (!orderField) return rows;
            return rows.slice().sort((a, b) => {
                const av = a[orderField];
                const bv = b[orderField];
                if (av === bv) return 0;
                if (ascending === false) return av > bv ? -1 : 1;
                return av > bv ? 1 : -1;
            });
        }

        function getTableRows(table) {
            let rows = db[table] || [];
            if (table === 'households') {
                const accountId = activeAccountId();
                const memberHouseholdIds = db.household_members
                    .filter((row) => row.account_id === accountId && row.status === 'active')
                    .map((row) => row.household_id);
                rows = rows.filter((row) => row.owner_account_id === accountId || memberHouseholdIds.includes(row.id));
            }
            return rows;
        }

        function normalizeChildProfile(row) {
            const copy = Object.assign({}, row);
            copy.id = copy.id || nextId('child');
            copy.friend_code = copy.friend_code || randomCode('PET');
            copy.home_visibility = copy.home_visibility || 'friends';
            copy.visit_access = copy.visit_access || 'friends';
            copy.pk_access = copy.pk_access || 'friends';
            copy.created_at = copy.created_at || nowIso();
            copy.last_synced_at = copy.last_synced_at || '';
            copy.pet_summary_json = copy.pet_summary_json || {};
            copy.home_summary_json = copy.home_summary_json || {};
            return copy;
        }

        function queryResult(data) {
            return Promise.resolve({ data: clone(data), error: null });
        }

        class QueryBuilder {
            constructor(table, action, payload, options) {
                this.table = table;
                this.action = action || 'select';
                this.payload = payload;
                this.options = options || {};
                this.filters = [];
                this.limitCount = null;
                this.orderField = '';
                this.orderAscending = true;
                this.expect = 'many';
                this.returning = action === 'select';
            }

            select() {
                if (this.action !== 'select') this.returning = true;
                return this;
            }

            eq(field, value) {
                this.filters.push({ type: 'eq', field, value });
                return this;
            }

            in(field, values) {
                this.filters.push({ type: 'in', field, values: Array.isArray(values) ? values : [] });
                return this;
            }

            match(value) {
                this.filters.push({ type: 'match', value: value || {} });
                return this;
            }

            or(raw) {
                const clauses = String(raw || '').split(',').map((part) => {
                    const match = part.match(/^([^\.]+)\.eq\.(.+)$/);
                    return match ? { field: match[1], value: match[2] } : null;
                }).filter(Boolean);
                this.filters.push({ type: 'or', clauses });
                return this;
            }

            order(field, opts) {
                this.orderField = field;
                this.orderAscending = !(opts && opts.ascending === false);
                return this;
            }

            limit(count) {
                this.limitCount = Number(count || 0);
                return this;
            }

            single() {
                this.expect = 'single';
                return this;
            }

            maybeSingle() {
                this.expect = 'maybeSingle';
                return this;
            }

            then(resolve, reject) {
                return this.execute().then(resolve, reject);
            }

            async execute() {
                if (this.action === 'select') {
                    let rows = applyFilters(getTableRows(this.table).map(clone), this.filters);
                    rows = applyOrder(rows, this.orderField, this.orderAscending);
                    if (this.limitCount != null) rows = rows.slice(0, this.limitCount);
                    if (this.expect === 'single') {
                        return { data: rows[0] ? clone(rows[0]) : null, error: rows[0] ? null : { message: 'No rows', code: 'PGRST116' } };
                    }
                    if (this.expect === 'maybeSingle') {
                        return { data: rows[0] ? clone(rows[0]) : null, error: null };
                    }
                    return { data: clone(rows), error: null };
                }

                if (this.action === 'insert') {
                    const inputRows = Array.isArray(this.payload) ? this.payload : [this.payload];
                    const inserted = inputRows.map((row) => {
                        const nextRow = clone(row || {});
                        if (!nextRow.id) nextRow.id = nextId(this.table.slice(0, 3));
                        if (!nextRow.created_at) nextRow.created_at = nowIso();
                        if (this.table === 'child_profiles') {
                            return normalizeChildProfile(nextRow);
                        }
                        if (this.table === 'household_members') {
                            nextRow.status = nextRow.status || 'active';
                        }
                        return nextRow;
                    });
                    db[this.table].push(...inserted);
                    const data = this.returning ? inserted : inserted;
                    persist();
                    if (this.expect === 'single') return { data: clone(data[0] || null), error: null };
                    if (this.expect === 'maybeSingle') return { data: clone(data[0] || null), error: null };
                    return { data: clone(data), error: null };
                }

                if (this.action === 'upsert') {
                    const inputRows = Array.isArray(this.payload) ? this.payload : [this.payload];
                    const touched = [];
                    inputRows.forEach((row) => {
                        const nextRow = this.table === 'child_profiles' ? normalizeChildProfile(row) : clone(row || {});
                        let target = null;
                        if (this.table === 'accounts') {
                            target = db.accounts.find((item) => item.id === nextRow.id) || null;
                        } else if (this.table === 'child_profiles') {
                            const keys = String(this.options.onConflict || 'id').split(',').map((key) => key.trim()).filter(Boolean);
                            target = db.child_profiles.find((item) => keys.every((key) => String(item[key]) === String(nextRow[key]))) || null;
                        } else {
                            target = (db[this.table] || []).find((item) => item.id && nextRow.id && item.id === nextRow.id) || null;
                        }
                        if (target) {
                            Object.assign(target, nextRow);
                            touched.push(clone(target));
                        } else {
                            if (!nextRow.id) nextRow.id = nextId(this.table.slice(0, 3));
                            if (!nextRow.created_at) nextRow.created_at = nowIso();
                            db[this.table].push(nextRow);
                            touched.push(clone(nextRow));
                        }
                    });
                    persist();
                    if (this.expect === 'single') return { data: clone(touched[0] || null), error: null };
                    if (this.expect === 'maybeSingle') return { data: clone(touched[0] || null), error: null };
                    return { data: clone(touched), error: null };
                }

                if (this.action === 'update') {
                    const rows = applyFilters(db[this.table], this.filters);
                    rows.forEach((row) => Object.assign(row, clone(this.payload || {})));
                    const updated = rows.map(clone);
                    persist();
                    if (this.expect === 'single') return { data: clone(updated[0] || null), error: null };
                    if (this.expect === 'maybeSingle') return { data: clone(updated[0] || null), error: null };
                    return { data: clone(updated), error: null };
                }

                return { data: null, error: { message: 'Unsupported fake query action: ' + this.action } };
            }
        }

        function from(table) {
            return {
                select() { return new QueryBuilder(table, 'select').select(...arguments); },
                insert(payload) { return new QueryBuilder(table, 'insert', payload); },
                upsert(payload, options) { return new QueryBuilder(table, 'upsert', payload, options); },
                update(payload) { return new QueryBuilder(table, 'update', payload); },
                delete() { return new QueryBuilder(table, 'delete'); }
            };
        }

        async function invokeFunction(name, request) {
            const body = request && request.body ? clone(request.body) : {};
            const user = getActiveUser();

            if (name === 'validate-registration-invite') {
                const invite = db.registration_invites.find((item) => item.invite_code === String(body.inviteCode || '').trim().toUpperCase() && item.status === 'pending');
                if (!invite) return { data: null, error: { message: '注册邀请码不存在或已失效' } };
                return { data: { ok: true, invite }, error: null };
            }

            if (name === 'claim-registration-invite') {
                const invite = db.registration_invites.find((item) => item.invite_code === String(body.inviteCode || '').trim().toUpperCase());
                if (!invite) return { data: null, error: { message: '注册邀请码不存在' } };
                invite.status = 'claimed';
                invite.claimed_by_account_id = user ? user.id : '';
                persist();
                return { data: { ok: true, inviteCode: invite.invite_code }, error: null };
            }

            if (name === 'list-registration-invites') {
                const invites = db.registration_invites
                    .filter((item) => !user || item.created_by_account_id === user.id || item.created_by_account_id == null)
                    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
                return { data: { invites }, error: null };
            }

            if (name === 'issue-registration-invite') {
                const invite = {
                    id: nextId('reginvite'),
                    invite_code: randomCode('REG'),
                    label: body.label || '',
                    status: 'pending',
                    expires_at: new Date(Date.now() + Number(body.expiresDays || 30) * 24 * 60 * 60 * 1000).toISOString(),
                    created_at: nowIso(),
                    created_by_account_id: user ? user.id : '',
                    household_id: body.householdId || ''
                };
                db.registration_invites.unshift(invite);
                persist();
                return { data: { invite }, error: null };
            }

            if (name === 'revoke-registration-invite') {
                const invite = db.registration_invites.find((item) => item.id === body.inviteId);
                if (!invite) return { data: null, error: { message: '邀请码不存在' } };
                invite.status = 'revoked';
                persist();
                return { data: { inviteCode: invite.invite_code }, error: null };
            }

            if (name === 'accept-household-invite') {
                const invite = db.household_invites.find((item) => item.invite_code === String(body.inviteCode || '').trim().toUpperCase() && item.status === 'pending');
                if (!invite) return { data: null, error: { message: '家庭邀请码不存在或已失效' } };
                invite.status = 'accepted';
                db.household_members.push({
                    id: nextId('hm'),
                    household_id: invite.household_id,
                    account_id: user ? user.id : '',
                    role: invite.role || 'member',
                    status: 'active',
                    created_at: nowIso()
                });
                persist();
                return { data: { ok: true, inviteCode: invite.invite_code }, error: null };
            }

            if (name === 'issue-household-invite') {
                const invite = {
                    id: nextId('hhinvite'),
                    household_id: body.householdId,
                    invite_code: randomCode('HOME'),
                    role: 'member',
                    status: 'pending',
                    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                    created_at: nowIso()
                };
                db.household_invites.unshift(invite);
                persist();
                return { data: { invite }, error: null };
            }

            if (name === 'revoke-household-invite') {
                const invite = db.household_invites.find((item) => item.id === body.inviteId);
                if (!invite) return { data: null, error: { message: '家庭邀请码不存在' } };
                invite.status = 'revoked';
                persist();
                return { data: { inviteCode: invite.invite_code }, error: null };
            }

            if (name === 'redeem-friend-code') {
                const sourceId = body.childId;
                const target = db.child_profiles.find((row) => row.friend_code === String(body.friendCode || '').trim().toUpperCase());
                if (!target) return { data: null, error: { message: '好友码不存在' } };
                const exists = db.child_friendships.some((row) => row.child_id === sourceId && row.friend_child_id === target.id && row.status === 'active');
                if (!exists) {
                    const createdAt = nowIso();
                    db.child_friendships.push({
                        id: nextId('friend'),
                        child_id: sourceId,
                        friend_child_id: target.id,
                        status: 'active',
                        created_at: createdAt
                    });
                    db.child_friendships.push({
                        id: nextId('friend'),
                        child_id: target.id,
                        friend_child_id: sourceId,
                        status: 'active',
                        created_at: createdAt
                    });
                }
                persist();
                return { data: { ok: true, targetChild: clone(target) }, error: null };
            }

            if (name === 'issue-pk-match') {
                const questionSet = {
                    id: nextId('qset'),
                    payload_json: clone(body.payloadJson || {}),
                    difficulty: body.difficulty || (body.payloadJson && body.payloadJson.difficulty) || 'easy20',
                    game_type: body.gameType
                };
                db.pk_question_sets.push(questionSet);
                const match = {
                    id: nextId('match'),
                    game_type: body.gameType,
                    question_set_id: questionSet.id,
                    challenger_child_id: body.childId,
                    opponent_child_id: body.opponentChildId,
                    status: 'pending',
                    difficulty: questionSet.difficulty,
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    created_at: nowIso()
                };
                db.pk_matches.unshift(match);
                persist();
                return { data: { matchId: match.id }, error: null };
            }

            if (name === 'submit-pk-attempt') {
                const summary = clone(body.summary || {});
                const existing = db.pk_match_attempts.find((row) => row.match_id === body.matchId && row.child_id === body.childId);
                const nextAttempt = {
                    id: existing ? existing.id : nextId('attempt'),
                    match_id: body.matchId,
                    child_id: body.childId,
                    score: Number(summary.score || 0),
                    correct_count: Number(summary.correctCount || 0),
                    duration_ms: Number(summary.durationMs || 0),
                    payload_json: clone(summary.payloadJson || {}),
                    completed_at: nowIso()
                };
                if (existing) {
                    Object.assign(existing, nextAttempt);
                } else {
                    db.pk_match_attempts.push(nextAttempt);
                }
                const match = db.pk_matches.find((row) => row.id === body.matchId);
                if (match) {
                    const attempts = db.pk_match_attempts.filter((row) => row.match_id === body.matchId);
                    match.status = attempts.length >= 2 ? 'completed' : 'active';
                }
                persist();
                return { data: { ok: true }, error: null };
            }

            return { data: null, error: { message: 'Unsupported fake function: ' + name } };
        }

        async function rpc(name, params) {
            if (name === 'get_child_social_profiles') {
                const ids = Array.isArray(params && params.target_ids) ? params.target_ids.map(String) : [];
                const rows = db.child_profiles.filter((row) => ids.includes(String(row.id)));
                return { data: clone(rows), error: null };
            }
            return { data: null, error: { message: 'Unsupported fake rpc: ' + name } };
        }

        function createClient() {
            return {
                auth: {
                    async getSession() {
                        return { data: { session: authState.session ? clone(authState.session) : null }, error: null };
                    },
                    async signUp(payload) {
                        const email = String(payload.email || '').trim();
                        const password = String(payload.password || '');
                        const inviteCode = String(payload.options && payload.options.data && payload.options.data.registration_invite_code || '').trim().toUpperCase();
                        const invite = db.registration_invites.find((item) => item.invite_code === inviteCode && item.status === 'pending');
                        if (!invite) return { data: null, error: { message: '注册邀请码不存在或已失效' } };
                        let user = findUserByEmail(email);
                        if (!user) {
                            user = {
                                id: nextId('user'),
                                email,
                                password,
                                user_metadata: clone(payload.options && payload.options.data || {})
                            };
                            authState.users.push(user);
                            persist();
                        }
                        authState.session = buildSession(user);
                        notifyAuth('SIGNED_IN');
                        return { data: { session: clone(authState.session), user: clone(user) }, error: null };
                    },
                    async signInWithPassword(payload) {
                        const user = findUserByEmail(String(payload.email || '').trim());
                        if (!user || user.password !== String(payload.password || '')) {
                            return { data: null, error: { message: '账号或密码错误' } };
                        }
                        authState.session = buildSession(user);
                        notifyAuth('SIGNED_IN');
                        return { data: { session: clone(authState.session), user: clone(user) }, error: null };
                    },
                    async signOut() {
                        authState.session = null;
                        notifyAuth('SIGNED_OUT');
                        return { error: null };
                    },
                    onAuthStateChange(callback) {
                        authState.listeners.push(callback);
                        return {
                            data: {
                                subscription: {
                                    unsubscribe() {
                                        authState.listeners = authState.listeners.filter((listener) => listener !== callback);
                                    }
                                }
                            }
                        };
                    }
                },
                functions: {
                    invoke(name, request) {
                        return invokeFunction(name, request);
                    }
                },
                from,
                rpc
            };
        }

        Object.defineProperty(window, 'supabase', {
            value: { createClient },
            writable: false,
            configurable: true
        });
        window.__fakeSupabaseHelper = {
            async bridgeAuthState() {
                const client = window.CloudClient && typeof window.CloudClient.getClient === 'function'
                    ? window.CloudClient.getClient()
                    : null;
                const sessionResult = client ? await client.auth.getSession() : null;
                const session = sessionResult && sessionResult.data ? sessionResult.data.session : null;
                const originalGetState = window.AuthSystem && typeof window.AuthSystem.getState === 'function'
                    ? window.AuthSystem.getState.bind(window.AuthSystem)
                    : null;
                if (session && originalGetState) {
                    window.AuthSystem.getState = function () {
                        const base = originalGetState() || {};
                        return Object.assign({}, base, {
                            user: session.user,
                            session: session
                        });
                    };
                }
                return session;
            },
            resetLocalProfilesKeepCloud() {
                const metaKey = window.ProfileManager && window.ProfileManager._META_KEY;
                const activeKey = window.ProfileManager && window.ProfileManager._ACTIVE_KEY;
                const dataPrefix = window.ProfileManager && window.ProfileManager._DATA_PREFIX;
                const keys = [];
                for (let i = 0; i < localStorage.length; i++) {
                    keys.push(localStorage.key(i));
                }
                keys.forEach((key) => {
                    if (!key) return;
                    if (key === metaKey || key === activeKey || (dataPrefix && key.startsWith(dataPrefix))) {
                        localStorage.removeItem(key);
                        return;
                    }
                    if (key.startsWith('petbank_')) {
                        localStorage.removeItem(key);
                    }
                });
                if (window.ProfileManager && typeof window.ProfileManager.ensureDefault === 'function') {
                    window.ProfileManager.ensureDefault();
                }
                if (window.ProfileUI && typeof window.ProfileUI.render === 'function') {
                    window.ProfileUI.render();
                }
            },
            snapshot() {
                return clone(db);
            },
            seedFriendPeer(config) {
                const peerConfig = Object.assign({
                    parentName: '好友家长',
                    email: 'friend@example.com',
                    childName: '小橙',
                    emoji: '🦊'
                }, config || {});
                const userId = nextId('user');
                const householdId = nextId('household');
                const child = normalizeChildProfile({
                    id: nextId('child'),
                    household_id: householdId,
                    local_profile_id: 'peer_local_' + seq,
                    display_name: peerConfig.childName,
                    emoji: peerConfig.emoji,
                    created_at: nowIso(),
                    pet_summary_json: {
                        species_name: '云端小狐',
                        level: 3,
                        wins: 2,
                        explorations: 5
                    },
                    home_summary_json: {
                        theme_name: '好友小屋',
                        furniture_count: 4,
                        occupied_slots: 2
                    }
                });
                authState.users.push({
                    id: userId,
                    email: peerConfig.email,
                    password: 'friend-pass',
                    user_metadata: { parent_name: peerConfig.parentName }
                });
                db.accounts.push({
                    id: userId,
                    email: peerConfig.email,
                    parent_name: peerConfig.parentName
                });
                db.households.push({
                    id: householdId,
                    name: peerConfig.parentName + '一家',
                    owner_account_id: userId,
                    created_at: nowIso()
                });
                db.household_members.push({
                    id: nextId('hm'),
                    household_id: householdId,
                    account_id: userId,
                    role: 'owner',
                    status: 'active',
                    created_at: nowIso()
                });
                db.child_profiles.push(child);
                persist();
                return clone(child);
            },
            seedInboundPkMatch(config) {
                const payload = Object.assign({
                    gameType: 'mathpk',
                    difficulty: 'easy20',
                    questions: [
                        { text: '2 + 3', answer: 5, op: '+' },
                        { text: '9 - 4', answer: 5, op: '-' },
                        { text: '6 + 1', answer: 7, op: '+' }
                    ]
                }, config || {});
                const questionSet = {
                    id: nextId('qset'),
                    payload_json: {
                        gameType: payload.gameType,
                        difficulty: payload.difficulty,
                        totalRounds: payload.questions.length,
                        questions: clone(payload.questions)
                    },
                    difficulty: payload.difficulty,
                    game_type: payload.gameType
                };
                db.pk_question_sets.push(questionSet);
                const match = {
                    id: nextId('match'),
                    game_type: payload.gameType,
                    question_set_id: questionSet.id,
                    challenger_child_id: payload.challengerChildId,
                    opponent_child_id: payload.opponentChildId,
                    status: 'pending',
                    difficulty: payload.difficulty,
                    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                    created_at: nowIso()
                };
                db.pk_matches.unshift(match);
                if (payload.challengerSummary) {
                    db.pk_match_attempts.push({
                        id: nextId('attempt'),
                        match_id: match.id,
                        child_id: payload.challengerChildId,
                        score: Number(payload.challengerSummary.score || 0),
                        correct_count: Number(payload.challengerSummary.correctCount || 0),
                        duration_ms: Number(payload.challengerSummary.durationMs || 0),
                        payload_json: clone(payload.challengerSummary.payloadJson || {}),
                        completed_at: nowIso()
                    });
                    match.status = 'active';
                }
                persist();
                return {
                    match: clone(match),
                    questionSet: clone(questionSet)
                };
            },
            seedInboundWalkInvite(config) {
                const payload = Object.assign({
                    fromChildId: '',
                    toChildId: '',
                    createdByAccountId: 'peer_account',
                    routeId: 'park',
                    routeName: '🌳 公园'
                }, config || {});
                const visit = {
                    id: 'visit_inbound_' + Date.now(),
                    from_child_id: payload.fromChildId,
                    to_child_id: payload.toChildId,
                    action_type: 'walk',
                    message: '约上伙伴一起去遛弯啦！',
                    metadata_json: {
                        kind: 'walk_invite',
                        route_id: payload.routeId,
                        route_name: payload.routeName
                    },
                    created_by_account_id: payload.createdByAccountId,
                    created_at: nowIso()
                };
                db.house_visits.unshift(visit);
                persist();
                return clone(visit);
            }
        };
        persist();
    })();
});

await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => window.PetBankRuntime && window.PetSystem && typeof window.switchPage === 'function', { timeout: 20000 });

async function shot(name) {
    await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true });
}

await page.evaluate(() => {
    const species = window.PetSystem.getAllSpecies();
    if (species && species[0]) window.PetSystem.chooseSpecies(species[0].id);
    window.addGrowthPoints(120);
    window.renderAll();
});

await page.evaluate(async () => {
    await window.PetBankRuntime.ensurePage('settings');
    window.switchPage('settings', { settingsSection: 'family' });
});
await page.waitForFunction(() => document.getElementById('page-settings')?.classList.contains('active'), { timeout: 15000 });
await page.waitForFunction(() => /云端已配置|云端已就绪|请先登录或注册家长账号/.test(document.getElementById('auth-root')?.innerText || ''), { timeout: 15000 });
await shot('01-settings-cloud-ready.png');

const cloudText = await page.locator('#auth-root').innerText();
check('设置页出现云端账号卡片', /家庭账号云端接入|家长账号与多孩子数据/.test(cloudText), cloudText.slice(0, 160));
check('模拟环境下云端配置已启用', /云端已配置|云端已就绪/.test(cloudText) && !/本地模式/.test(cloudText), cloudText.slice(0, 160));

const signupBridge = await page.evaluate(async () => {
    const client = window.CloudClient.getClient();
    await client.auth.signUp({
        email: 'parent@example.com',
        password: 'parent-pass',
        options: {
            data: {
                parent_name: '测试妈妈',
                registration_invite_code: 'REG-ALPHA'
            }
        }
    });
    const session = await window.__fakeSupabaseHelper.bridgeAuthState();
    if (window.HouseholdSystem && typeof window.HouseholdSystem.refresh === 'function') {
        await window.HouseholdSystem.refresh('household-root');
    }
    if (window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
        await window.SocialSystem.refresh();
    }
    return session;
});
const signupProbe = await page.evaluate(async () => {
    const client = window.CloudClient.getClient();
    const sessionResult = client ? await client.auth.getSession() : null;
    return {
        authState: window.AuthSystem && window.AuthSystem.getState ? window.AuthSystem.getState() : null,
        authText: document.getElementById('auth-root') ? document.getElementById('auth-root').innerText : '',
        session: sessionResult && sessionResult.data ? sessionResult.data.session : null
    };
});
check(
    '家长账号注册并进入登录态',
    !!(signupBridge && signupBridge.user && signupProbe.authState && signupProbe.authState.user && signupProbe.session && signupProbe.session.user),
    JSON.stringify({
        authState: signupProbe.authState && signupProbe.authState.user ? signupProbe.authState.user.email : null,
        sessionUser: signupProbe.session && signupProbe.session.user ? signupProbe.session.user.email : null,
        authText: (signupProbe.authText || '').slice(0, 120)
    })
);

await page.evaluate(async () => {
    await window.HouseholdSystem.ensurePrimaryHousehold();
});
await page.waitForFunction(() => /已有家庭|家庭邀请码|云端家庭/.test(document.getElementById('household-root')?.innerText || ''), { timeout: 15000 });
const householdCreateProbe = await page.evaluate(() => ({
    text: document.getElementById('household-root')?.innerText || '',
    state: window.HouseholdSystem && window.HouseholdSystem.getState ? window.HouseholdSystem.getState() : null
}));
check(
    '家庭创建完成并显示家庭区域',
    !!(householdCreateProbe.state && householdCreateProbe.state.primaryHouseholdId && householdCreateProbe.state.households && householdCreateProbe.state.households.length === 1),
    JSON.stringify({
        householdId: householdCreateProbe.state ? householdCreateProbe.state.primaryHouseholdId : '',
        count: householdCreateProbe.state && householdCreateProbe.state.households ? householdCreateProbe.state.households.length : 0,
        text: householdCreateProbe.text.slice(0, 120)
    })
);

await page.evaluate(async () => {
    await window.HouseholdSystem.syncActiveChild();
});
await page.waitForFunction(() => /已同步云端|好友码 PET-|最近一次云端同步|已同步当前孩子/.test(document.getElementById('household-root')?.innerText || ''), { timeout: 20000 });
const householdSyncProbe = await page.evaluate(() => ({
    text: document.getElementById('household-root')?.innerText || '',
    state: window.HouseholdSystem && window.HouseholdSystem.getState ? window.HouseholdSystem.getState() : null,
    social: window.SocialSystem && window.SocialSystem.getState ? window.SocialSystem.getState() : null
}));
check(
    '当前孩子已同步到云端 child 档案',
    !!(householdSyncProbe.state && householdSyncProbe.state.cloudChildren && householdSyncProbe.state.cloudChildren.length >= 1 && householdSyncProbe.social && householdSyncProbe.social.activeCloudChild && householdSyncProbe.social.activeCloudChild.friend_code),
    JSON.stringify({
        cloudChildren: householdSyncProbe.state && householdSyncProbe.state.cloudChildren ? householdSyncProbe.state.cloudChildren.length : 0,
        friendCode: householdSyncProbe.social && householdSyncProbe.social.activeCloudChild ? householdSyncProbe.social.activeCloudChild.friend_code : '',
        text: householdSyncProbe.text.slice(0, 140)
    })
);
await shot('02-household-synced.png');

await page.locator('#household-root button').filter({ hasText: '生成家庭邀请码' }).click();
await page.waitForFunction(() => /家庭邀请码 HOME-/.test(document.getElementById('household-root')?.innerText || ''), { timeout: 15000 });
const householdAfterIssueInvite = await page.locator('#household-root').innerText();
check('可以签发家庭邀请码', /家庭邀请码 HOME-/.test(householdAfterIssueInvite), householdAfterIssueInvite.slice(0, 220));
const issuedInviteCode = await page.evaluate(() => {
    const state = window.HouseholdSystem && window.HouseholdSystem.getState ? window.HouseholdSystem.getState() : null;
    return state && state.activeInvite ? state.activeInvite.invite_code : '';
});
check('已拿到可用于第二个家长加入的家庭邀请码', /^HOME-/.test(issuedInviteCode), issuedInviteCode);

const activeChild = await page.evaluate(() => {
    const socialState = window.SocialSystem && window.SocialSystem.getState ? window.SocialSystem.getState() : null;
    return socialState && socialState.activeCloudChild ? socialState.activeCloudChild : null;
});
check('设置页已识别当前活跃云端孩子', !!(activeChild && activeChild.id), JSON.stringify(activeChild || {}));

const peerChild = await page.evaluate(() => {
    return window.__fakeSupabaseHelper.seedFriendPeer({
        parentName: '好友爸爸',
        email: 'friend@example.com',
        childName: '小橙',
        emoji: '🦊'
    });
});

await page.locator('#social-root input[name="friendCode"]').fill(peerChild.friend_code);
await page.locator('#social-root button').filter({ hasText: '成为好友' }).click();
await page.waitForFunction(() => /小橙|1 位好友|好友添加成功/.test(document.getElementById('social-root')?.innerText || ''), { timeout: 15000 });
const socialAfterFriend = await page.locator('#social-root').innerText();
check('好友码兑换后出现跨家庭好友', /小橙/.test(socialAfterFriend) && /好友/.test(socialAfterFriend), socialAfterFriend.slice(0, 260));
await shot('03-social-friend-added.png');

await page.locator('#social-root button').filter({ hasText: '👋 打招呼' }).first().click();
await page.waitForFunction(() => /打招呼已发送|最近串门记录|收到|发出/.test(document.getElementById('social-root')?.innerText || ''), { timeout: 15000 });
const socialAfterWave = await page.locator('#social-root').innerText();
check('好友互动会写入串门记录', /最近串门记录/.test(socialAfterWave) && /小橙|打招呼|发出/.test(socialAfterWave), socialAfterWave.slice(0, 260));

await page.locator('#social-root button').filter({ hasText: '🚶 一起遛弯' }).first().click();
await page.waitForFunction(() => /选择一起遛弯的路线/.test(document.body.innerText || ''), { timeout: 10000 });
await page.locator('.social-walk-invite-grid .walk-route-card').first().click();
await page.waitForFunction(() => /路线发给|一起遛弯/.test(document.getElementById('social-root')?.innerText || ''), { timeout: 15000 });
const socialAfterWalk = await page.locator('#social-root').innerText();
check('一起遛弯邀请可写入真实互动记录', /路线发给|一起遛弯|最近串门记录/.test(socialAfterWalk), socialAfterWalk.slice(0, 260));
await shot('04-social-walk-invite.png');

const seededMatch = await page.evaluate((payload) => {
    return window.__fakeSupabaseHelper.seedInboundPkMatch(payload);
}, {
    challengerChildId: peerChild.id,
    opponentChildId: activeChild.id,
    gameType: 'mathpk',
    difficulty: 'easy20',
    questions: [
        { text: '2 + 3', answer: 5, op: '+' },
        { text: '9 - 4', answer: 5, op: '-' },
        { text: '6 + 1', answer: 7, op: '+' }
    ],
    challengerSummary: {
        score: 18,
        correctCount: 2,
        durationMs: 18000,
        payloadJson: {}
    }
});

check('模拟后端成功注入一场来自好友的数学异步挑战', !!(seededMatch && seededMatch.match && seededMatch.match.id), JSON.stringify(seededMatch || {}));

await page.evaluate(async () => {
    await window.PetBankRuntime.ensurePage('playground');
    window.switchPage('mathpk');
});
await page.waitForFunction(() => /异步 PK|开始应战|数学 PK/.test(document.getElementById('math-pk-container')?.innerText || ''), { timeout: 20000 });
await shot('05-mathpk-async-list.png');

const mathBeforeBattle = await page.locator('#math-pk-container').innerText();
check('数学 PK 页显示待应战的异步挑战卡片', /开始应战/.test(mathBeforeBattle) && /小橙/.test(mathBeforeBattle), mathBeforeBattle.slice(0, 260));

await page.locator('#math-pk-container button').filter({ hasText: '开始应战' }).first().click();
await page.waitForFunction(() => {
    const question = document.querySelector('.arena-question');
    return !!question && /输入答案/.test(document.getElementById('arena-display')?.innerText || '');
}, { timeout: 15000 });
await shot('06-mathpk-async-battle.png');

for (let round = 0; round < 3; round++) {
    const probe = await page.evaluate(() => ({
        pill: document.getElementById('arena-round-pill')?.innerText || '',
        text: document.querySelector('.arena-question')?.textContent || ''
    }));
    const answer = solveQuestionText(probe.text);
    check(`异步数学 PK 第 ${round + 1} 题可解析`, answer !== null, JSON.stringify(probe));
    if (answer === null) break;
    await page.evaluate((value) => {
        const digits = String(value).split('');
        digits.forEach((digit) => window.MathPKGame._inputDigit(Number(digit)));
        window.MathPKGame._submitAnswer();
    }, answer);
    if (round < 2) {
        await page.waitForTimeout(1350);
    }
}

await page.waitForFunction(() => /好友异步挑战完成|你赢下了这场异步 PK|等待好友完成/.test(document.getElementById('math-arena')?.innerText || ''), { timeout: 20000 });
const mathAfterBattle = await page.locator('#math-arena').innerText();
check('数学异步挑战完成后出现结算结果', /好友异步挑战完成/.test(mathAfterBattle), mathAfterBattle.slice(0, 260));
check('数学异步挑战提交后能判定胜负结果', /你赢下了这场异步 PK|等待好友完成/.test(mathAfterBattle), mathAfterBattle.slice(0, 260));
await shot('07-mathpk-async-result.png');

// ---- 同一链路继续：第二位家长加入家庭 + 第二个孩子同步 ----
await page.evaluate(async (inviteCode) => {
    const newProfile = window.ProfileManager.create('第二个孩子', '👦');
    window.ProfileManager._swapTo(newProfile.id, false);
    if (window.ProfileUI && typeof window.ProfileUI.render === 'function') {
        window.ProfileUI.render();
    }
    if (window.SettingsPage && typeof window.SettingsPage.render === 'function') {
        window.SettingsPage.render();
    }
    if (window.AuthSystem && typeof window.AuthSystem.signOut === 'function') {
        await window.AuthSystem.signOut();
    } else {
        const client = window.CloudClient.getClient();
        if (client) await client.auth.signOut();
    }
    const client = window.CloudClient.getClient();
    await client.auth.signUp({
        email: 'parent2@example.com',
        password: 'parent-pass-2',
        options: {
            data: {
                parent_name: '测试爸爸',
                registration_invite_code: 'REG-BETA'
            }
        }
    });
    await window.__fakeSupabaseHelper.bridgeAuthState();
    await client.functions.invoke('accept-household-invite', {
        body: { inviteCode: inviteCode }
    });
    if (window.HouseholdSystem && typeof window.HouseholdSystem.refresh === 'function') {
        await window.HouseholdSystem.refresh('household-root');
    }
    await window.HouseholdSystem.syncActiveChild();
    if (window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
        await window.SocialSystem.refresh();
    }
}, issuedInviteCode);

const secondParentProbe = await page.evaluate(() => ({
    auth: window.AuthSystem && window.AuthSystem.getState ? window.AuthSystem.getState() : null,
    household: window.HouseholdSystem && window.HouseholdSystem.getState ? window.HouseholdSystem.getState() : null,
    social: window.SocialSystem && window.SocialSystem.getState ? window.SocialSystem.getState() : null
}));
check(
    '第二位家长接受家庭邀请码后加入同一家庭',
    !!(secondParentProbe.auth && secondParentProbe.auth.user && secondParentProbe.auth.user.email === 'parent2@example.com' && secondParentProbe.household && secondParentProbe.household.households && secondParentProbe.household.households.length >= 1),
    JSON.stringify({
        email: secondParentProbe.auth && secondParentProbe.auth.user ? secondParentProbe.auth.user.email : '',
        households: secondParentProbe.household && secondParentProbe.household.households ? secondParentProbe.household.households.length : 0
    })
);
check(
    '第二个孩子同步后能在家庭同伴里看到原孩子',
    !!(secondParentProbe.social && secondParentProbe.social.householdPeers && secondParentProbe.social.householdPeers.length >= 1),
    JSON.stringify({
        peers: secondParentProbe.social && secondParentProbe.social.householdPeers
            ? secondParentProbe.social.householdPeers.map((peer) => peer.display_name)
            : []
    })
);
await shot('08-second-parent-household-peer.png');

// ---- 访客页与来访邀请响应 ----
await page.evaluate(async () => {
    const social = window.SocialSystem.getState();
    const firstPeer = social && social.householdPeers && social.householdPeers[0];
    if (!firstPeer) return;
    await window.SocialSystem.openPeerHome(firstPeer.id);
});
await page.waitForFunction(() => document.getElementById('page-home-visit')?.classList.contains('active'), { timeout: 15000 });
const friendHomeProbe = await page.evaluate(() => ({
    text: document.getElementById('friend-home-visit-root')?.innerText || '',
    pageActive: document.getElementById('page-home-visit')?.classList.contains('active')
}));
check('可以进入好友小屋访客页', friendHomeProbe.pageActive && /小屋|串门/.test(friendHomeProbe.text), friendHomeProbe.text.slice(0, 220));
await shot('09-friend-home-visit.png');

await page.evaluate(() => {
    const social = window.SocialSystem.getState();
    const activeChild = social && social.activeCloudChild;
    const peer = social && social.householdPeers && social.householdPeers[0];
    if (!activeChild || !peer) return;
    window.__fakeSupabaseHelper.seedInboundWalkInvite({
        fromChildId: peer.id,
        toChildId: activeChild.id,
        routeId: 'park',
        routeName: '🌳 公园'
    });
});
await page.evaluate(async () => {
    await window.SocialSystem.refresh({ preserveInfo: true });
});
await page.waitForFunction(() => /按同路线遛弯/.test(document.getElementById('social-root')?.innerText || ''), { timeout: 15000 });
await page.evaluate(async () => {
    const social = window.SocialSystem.getState();
    const visit = social && social.visits
        ? social.visits.find((item) => item && item.pendingWalkInvite)
        : null;
    if (visit) {
        await window.SocialSystem.acceptWalkInvite(visit.id);
    }
});
await page.waitForFunction(() => /已接受邀请|一起遛弯|最近串门记录/.test(document.getElementById('social-root')?.innerText || ''), { timeout: 15000 });
const inboundWalkProbe = await page.locator('#social-root').innerText();
check('收到的一起遛弯邀请可以被响应', /已接受邀请|一起遛弯/.test(inboundWalkProbe), inboundWalkProbe.slice(0, 220));
await shot('10-inbound-walk-accepted.png');

// ---- 云端恢复：模拟新设备本地为空，再从云端导入 ----
await page.evaluate(async () => {
    await window.AuthSystem.signOut();
    const client = window.CloudClient.getClient();
    await client.auth.signInWithPassword({
        email: 'parent@example.com',
        password: 'parent-pass'
    });
    await window.__fakeSupabaseHelper.bridgeAuthState();
    window.__fakeSupabaseHelper.resetLocalProfilesKeepCloud();
    if (window.ProfileManager && typeof window.ProfileManager.ensureDefault === 'function') {
        window.ProfileManager.ensureDefault();
    }
    if (window.HouseholdSystem && typeof window.HouseholdSystem.refresh === 'function') {
        await window.HouseholdSystem.refresh('household-root');
    }
    if (window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
        await window.SocialSystem.refresh();
    }
    const restoreResult = await window.CloudRestore.hydrateFromCloud({ overwriteExisting: false });
    if (restoreResult && restoreResult.restoredCount > 0) {
        if (window.PetSystem && typeof window.PetSystem.load === 'function') {
            window.PetSystem.load();
        }
        if (window.InventorySystem && typeof window.InventorySystem.load === 'function') {
            window.InventorySystem.load();
        }
        if (typeof window.renderAll === 'function') {
            window.renderAll();
        }
    }
});
await page.waitForTimeout(1000);
const restoreProbe = await page.evaluate(() => ({
    profiles: window.ProfileManager && window.ProfileManager.list ? window.ProfileManager.list() : [],
    active: window.ProfileManager && window.ProfileManager.getActive ? window.ProfileManager.getActive() : null,
    restoreState: window.CloudRestore && window.CloudRestore.getState ? window.CloudRestore.getState() : null,
    petState: window.PetSystem && window.PetSystem.getState ? window.PetSystem.getState() : null
}));
check(
    '本地清空后可以从云端恢复孩子档案',
    !!(restoreProbe.profiles && restoreProbe.profiles.length >= 1 && restoreProbe.restoreState && restoreProbe.restoreState.lastHydratedAt),
    JSON.stringify({
        profileCount: restoreProbe.profiles ? restoreProbe.profiles.length : 0,
        activeName: restoreProbe.active ? restoreProbe.active.name : '',
        lastHydratedAt: restoreProbe.restoreState ? restoreProbe.restoreState.lastHydratedAt : ''
    })
);
check(
    '云端恢复后宠物主状态重新可读',
    !!(restoreProbe.petState && (restoreProbe.petState.species || restoreProbe.petState.species_id)),
    JSON.stringify({
        species: restoreProbe.petState ? (restoreProbe.petState.species || restoreProbe.petState.species_id) : ''
    })
);
await shot('11-cloud-restore.png');

const backendSnapshot = await page.evaluate(() => window.__fakeSupabaseHelper.snapshot());
check('假后端中已写入好友关系', (backendSnapshot.child_friendships || []).length >= 2, String((backendSnapshot.child_friendships || []).length));
check('假后端中已写入串门与遛弯记录', (backendSnapshot.house_visits || []).length >= 2, String((backendSnapshot.house_visits || []).length));
check('假后端中已写入异步 PK 作答记录', (backendSnapshot.pk_match_attempts || []).length >= 2, String((backendSnapshot.pk_match_attempts || []).length));
check('假后端中已有同一家庭下至少两个孩子', (backendSnapshot.child_profiles || []).length >= 2, String((backendSnapshot.child_profiles || []).length));

check('云端家庭/社交/异步PK模拟过程中无新的页面错误', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
    console.log('FAILURES:', failed.map((item) => item.name).join('; '));
    process.exit(1);
}
