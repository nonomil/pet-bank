(function () {
    'use strict';

    const ACCESS_KEY = 'petbank_self_hosted_access_token';
    const REFRESH_KEY = 'petbank_self_hosted_refresh_token';
    const BASE_KEY = 'petbank_self_hosted_api_base_url';

    function resolveBaseUrl() {
        const injected = String(window.__PETBANK_API_BASE_URL__ || '').trim();
        if (injected) return injected.replace(/\/+$/, '');
        const saved = String(localStorage.getItem(BASE_KEY) || '').trim();
        if (saved) return saved.replace(/\/+$/, '');
        if (window.location && window.location.port === '7000') return 'http://127.0.0.1:3000/api/v1';
        return '/api/v1';
    }

    function readToken(key) {
        try { return localStorage.getItem(key) || ''; } catch (error) { return ''; }
    }

    function writeToken(key, value) {
        try {
            if (value) localStorage.setItem(key, value);
            else localStorage.removeItem(key);
        } catch (error) {}
    }

    async function parseResponse(response) {
        if (response.status === 204) return null;
        const text = await response.text();
        if (!text) return null;
        try { return JSON.parse(text); } catch (error) {
            throw new Error(`服务返回了无法识别的数据（${response.status}）`);
        }
    }

    function apiError(response, payload) {
        const error = payload && payload.error;
        const message = error && error.message ? error.message : `请求失败（${response.status}）`;
        const result = new Error(message);
        result.status = response.status;
        result.code = error && error.code ? error.code : 'HTTP_ERROR';
        return result;
    }

    async function request(path, options, retry) {
        const config = Object.assign({ method: 'GET', headers: {} }, options || {});
        config.headers = Object.assign({ accept: 'application/json' }, config.headers);
        const accessToken = readToken(ACCESS_KEY);
        if (accessToken) config.headers.authorization = `Bearer ${accessToken}`;
        if (config.body !== undefined && typeof config.body !== 'string') {
            config.headers['content-type'] = 'application/json';
            config.body = JSON.stringify(config.body);
        }
        const response = await fetch(`${resolveBaseUrl()}${path}`, config);
        const payload = await parseResponse(response);
        if (response.status === 401 && !retry && readToken(REFRESH_KEY) && !path.includes('/auth/refresh')) {
            try {
                await refresh();
                return request(path, options, true);
            } catch (error) {
                clearSession();
            }
        }
        if (!response.ok) throw apiError(response, payload);
        return payload;
    }

    async function refresh() {
        const refreshToken = readToken(REFRESH_KEY);
        if (!refreshToken) throw new Error('没有可用的刷新凭证');
        const payload = await request('/auth/refresh', { method: 'POST', body: { refreshToken } }, true);
        writeToken(ACCESS_KEY, payload.accessToken);
        writeToken(REFRESH_KEY, payload.refreshToken);
        return payload;
    }

    function clearSession() {
        writeToken(ACCESS_KEY, '');
        writeToken(REFRESH_KEY, '');
    }

    async function register(username, password, displayName, registrationCode) {
        const payload = await request('/auth/register', { method: 'POST', body: { username, password, displayName, registrationCode } });
        writeToken(ACCESS_KEY, payload.accessToken);
        writeToken(REFRESH_KEY, payload.refreshToken);
        return payload;
    }

    async function login(username, password) {
        const payload = await request('/auth/login', { method: 'POST', body: { username, password } });
        writeToken(ACCESS_KEY, payload.accessToken);
        writeToken(REFRESH_KEY, payload.refreshToken);
        return payload;
    }

    async function logout() {
        const refreshToken = readToken(REFRESH_KEY);
        try {
            if (refreshToken) await request('/auth/logout', { method: 'POST', body: { refreshToken } }, true);
        } finally {
            clearSession();
        }
    }

    const SelfHostedApi = {
        get baseUrl() { return resolveBaseUrl(); },
        isSignedIn() { return Boolean(readToken(ACCESS_KEY) || readToken(REFRESH_KEY)); },
        setBaseUrl(value) {
            const normalized = String(value || '').trim().replace(/\/+$/, '');
            if (normalized) localStorage.setItem(BASE_KEY, normalized);
            else localStorage.removeItem(BASE_KEY);
        },
        clearSession,
        register,
        login,
        logout,
        refresh,
        me: () => request('/auth/me'),
        deleteAccount: (password) => request('/auth/account', { method: 'DELETE', body: { password } }),
        listHouseholds: () => request('/households'),
        createHousehold: (name) => request('/households', { method: 'POST', body: { name } }),
        listMembers: (householdId) => request(`/households/${encodeURIComponent(householdId)}/members`),
        removeMember: (householdId, accountId) => request(`/households/${encodeURIComponent(householdId)}/members/${encodeURIComponent(accountId)}`, { method: 'DELETE' }),
        createInvite: (householdId, expiresInSeconds) => request(`/households/${encodeURIComponent(householdId)}/invites`, { method: 'POST', body: { expiresInSeconds } }),
        redeemInvite: (code) => request('/household-invites/redeem', { method: 'POST', body: { code } }),
        listChildren: (householdId) => request(`/children?householdId=${encodeURIComponent(householdId)}`),
        createChild: (householdId, name, localProfileId) => request('/children', { method: 'POST', body: { householdId, name, localProfileId } }),
        getChild: (childId) => request(`/children/${encodeURIComponent(childId)}`),
        renameChild: (childId, name) => request(`/children/${encodeURIComponent(childId)}`, { method: 'PATCH', body: { name } }),
        deleteChild: (childId) => request(`/children/${encodeURIComponent(childId)}`, { method: 'DELETE' }),
        latestSnapshot: (childId) => request(`/children/${encodeURIComponent(childId)}/snapshots/latest`),
        pushSnapshot: (childId, revision, payload) => request(`/children/${encodeURIComponent(childId)}/snapshots`, { method: 'POST', body: { revision, payload } }),
    };

    window.SelfHostedApi = SelfHostedApi;
})();
