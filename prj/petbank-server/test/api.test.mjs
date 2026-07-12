import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createServer } from '../src/server.mjs';
import { openDatabase } from '../src/database.mjs';

async function withApi(run) {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'petbank-api-'));
    const database = openDatabase({ databasePath: path.join(dataDir, 'petbank.db') });
    const server = createServer({
        config: {
            production: false,
            host: '127.0.0.1',
            port: 0,
            jwtSecret: 'test-secret-that-is-long-enough-for-api-tests',
            accessTokenTtlSeconds: 900,
            refreshTokenTtlSeconds: 86400,
            enableRegistration: true,
            allowedOrigin: 'http://127.0.0.1:8765',
        },
        database,
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const request = async (method, pathname, body, token) => {
        const headers = { accept: 'application/json' };
        if (body !== undefined) headers['content-type'] = 'application/json';
        if (token) headers.authorization = `Bearer ${token}`;
        const response = await fetch(`${baseUrl}${pathname}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await response.text();
        return { response, data: text ? JSON.parse(text) : null };
    };
    try {
        await run({ request });
    } finally {
        await new Promise((resolve) => server.close(resolve));
        database.close();
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
}

test('account, household, child and snapshot journey enforces ownership and revision conflicts', async () => {
    await withApi(async ({ request }) => {
        const register = await request('POST', '/api/v1/auth/register', {
            identifier: '13800138000',
            password: 'StrongPass123!',
            displayName: '家长A',
        });
        assert.equal(register.response.status, 201);
        assert.ok(register.data.accessToken);
        assert.ok(register.data.refreshToken);
        assert.equal(register.data.account.identifier, '13800138000');

        const duplicate = await request('POST', '/api/v1/auth/register', {
            identifier: '13800138000',
            password: 'StrongPass123!',
            displayName: '重复账号',
        });
        assert.equal(duplicate.response.status, 409);
        assert.equal(duplicate.data.error.code, 'ACCOUNT_EXISTS');

        const login = await request('POST', '/api/v1/auth/login', {
            identifier: '13800138000',
            password: 'StrongPass123!',
        });
        assert.equal(login.response.status, 200);
        const token = login.data.accessToken;

        const me = await request('GET', '/api/v1/auth/me', undefined, token);
        assert.equal(me.response.status, 200);
        assert.equal(me.data.account.displayName, '家长A');

        const household = await request('POST', '/api/v1/households', { name: 'A家庭' }, token);
        assert.equal(household.response.status, 201);
        const householdId = household.data.household.id;

        const child = await request('POST', '/api/v1/children', {
            householdId,
            name: '小A',
            localProfileId: 'p_a',
        }, token);
        assert.equal(child.response.status, 201);
        const childId = child.data.child.id;

        const snapshot = await request('POST', `/api/v1/children/${childId}/snapshots`, {
            revision: 1,
            payload: { points: 10, pet: { species: 'dog' } },
        }, token);
        assert.equal(snapshot.response.status, 201);

        const latest = await request('GET', `/api/v1/children/${childId}/snapshots/latest`, undefined, token);
        assert.equal(latest.response.status, 200);
        assert.equal(latest.data.snapshot.revision, 1);
        assert.equal(latest.data.snapshot.payload.points, 10);

        const conflict = await request('POST', `/api/v1/children/${childId}/snapshots`, {
            revision: 1,
            payload: { points: 999 },
        }, token);
        assert.equal(conflict.response.status, 409);
        assert.equal(conflict.data.error.code, 'SNAPSHOT_REVISION_CONFLICT');

        const secondSnapshot = await request('POST', `/api/v1/children/${childId}/snapshots`, {
            revision: 2,
            payload: { points: 20 },
        }, token);
        assert.equal(secondSnapshot.response.status, 201);

        const refreshed = await request('POST', '/api/v1/auth/refresh', { refreshToken: register.data.refreshToken });
        assert.equal(refreshed.response.status, 200);
        assert.notEqual(refreshed.data.refreshToken, register.data.refreshToken);

        const reusedRefresh = await request('POST', '/api/v1/auth/refresh', { refreshToken: register.data.refreshToken });
        assert.equal(reusedRefresh.response.status, 401);
    });
});

test('household invite joins a second account and blocks unrelated access', async () => {
    await withApi(async ({ request }) => {
        const first = await request('POST', '/api/v1/auth/register', {
            identifier: '13900139000', password: 'StrongPass123!', displayName: '家长一',
        });
        const firstToken = first.data.accessToken;
        const household = await request('POST', '/api/v1/households', { name: '共享家庭' }, firstToken);
        const householdId = household.data.household.id;

        const invite = await request('POST', `/api/v1/households/${householdId}/invites`, {}, firstToken);
        assert.equal(invite.response.status, 201);
        assert.match(invite.data.invite.code, /^[A-Z0-9]{8}$/);

        const second = await request('POST', '/api/v1/auth/register', {
            identifier: '13700137000', password: 'StrongPass123!', displayName: '家长二',
        });
        const secondToken = second.data.accessToken;

        const blocked = await request('GET', `/api/v1/households/${householdId}/members`, undefined, secondToken);
        assert.equal(blocked.response.status, 403);

        const redeemed = await request('POST', '/api/v1/household-invites/redeem', {
            code: invite.data.invite.code,
        }, secondToken);
        assert.equal(redeemed.response.status, 200);
        assert.equal(redeemed.data.household.id, householdId);

        const members = await request('GET', `/api/v1/households/${householdId}/members`, undefined, secondToken);
        assert.equal(members.response.status, 200);
        assert.equal(members.data.members.length, 2);

        const memberId = members.data.members.find((member) => member.account.identifier === '13700137000').account.id;
        const removed = await request('DELETE', `/api/v1/households/${householdId}/members/${memberId}`, undefined, firstToken);
        assert.equal(removed.response.status, 204);
        const membersAfterRemoval = await request('GET', `/api/v1/households/${householdId}/members`, undefined, firstToken);
        assert.equal(membersAfterRemoval.data.members.length, 1);

        const secondHouseholdCheck = await request('GET', '/api/v1/households', undefined, secondToken);
        assert.equal(secondHouseholdCheck.response.status, 200);
        assert.deepEqual(secondHouseholdCheck.data.households, []);
    });
});

test('owner can delete a child and its snapshots but cannot remove the household owner', async () => {
    await withApi(async ({ request }) => {
        const registered = await request('POST', '/api/v1/auth/register', {
            identifier: '13500135000', password: 'StrongPass123!', displayName: '家庭所有者',
        });
        const token = registered.data.accessToken;
        const household = await request('POST', '/api/v1/households', { name: '可管理家庭' }, token);
        const householdId = household.data.household.id;
        const child = await request('POST', '/api/v1/children', { householdId, name: '待删除孩子', localProfileId: 'p_delete' }, token);
        const childId = child.data.child.id;
        await request('POST', `/api/v1/children/${childId}/snapshots`, { revision: 1, payload: { points: 1 } }, token);

        const ownerMember = await request('GET', `/api/v1/households/${householdId}/members`, undefined, token);
        const ownerId = ownerMember.data.members[0].account.id;
        const removeOwner = await request('DELETE', `/api/v1/households/${householdId}/members/${ownerId}`, undefined, token);
        assert.equal(removeOwner.response.status, 409);
        assert.equal(removeOwner.data.error.code, 'OWNER_CANNOT_BE_REMOVED');

        const removedChild = await request('DELETE', `/api/v1/children/${childId}`, undefined, token);
        assert.equal(removedChild.response.status, 204);
        const childCheck = await request('GET', `/api/v1/children/${childId}`, undefined, token);
        assert.equal(childCheck.response.status, 404);
    });
});

test('account deletion requires the current password and removes the account session', async () => {
    await withApi(async ({ request }) => {
        const registered = await request('POST', '/api/v1/auth/register', {
            identifier: '13400134000', password: 'StrongPass123!', displayName: '待删除家长',
        });
        const token = registered.data.accessToken;
        const wrongPassword = await request('DELETE', '/api/v1/auth/account', { password: 'wrong-password' }, token);
        assert.equal(wrongPassword.response.status, 401);
        assert.equal(wrongPassword.data.error.code, 'INVALID_CREDENTIALS');

        const household = await request('POST', '/api/v1/households', { name: '删除前家庭' }, token);
        assert.equal(household.response.status, 201);
        const blocked = await request('DELETE', '/api/v1/auth/account', { password: 'StrongPass123!' }, token);
        assert.equal(blocked.response.status, 409);
        assert.equal(blocked.data.error.code, 'ACCOUNT_OWNS_HOUSEHOLDS');
    });
});

test('refresh token and password material are never returned by the account endpoint', async () => {
    await withApi(async ({ request }) => {
        const registered = await request('POST', '/api/v1/auth/register', {
            identifier: '13600136000', password: 'StrongPass123!', displayName: '家长三',
        });
        const response = await request('GET', '/api/v1/auth/me', undefined, registered.data.accessToken);
        assert.equal(response.response.status, 200);
        assert.deepEqual(Object.keys(response.data.account).sort(), ['createdAt', 'displayName', 'id', 'identifier']);
        assert.doesNotMatch(JSON.stringify(response.data), /password_hash|refreshToken|jwtSecret/i);
    });
});
