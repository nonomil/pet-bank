import {
    createHmac,
    randomBytes,
    randomUUID,
    scryptSync,
    timingSafeEqual,
} from 'node:crypto';

const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const PASSWORD_HASH_BYTES = 64;

function base64url(value) {
    return Buffer.from(value).toString('base64url');
}

function fromBase64url(value) {
    return Buffer.from(value, 'base64url').toString('utf8');
}

function signJwt(input, secret) {
    return createHmac('sha256', secret).update(input).digest('base64url');
}

export function normalizeUsername(value) {
    const username = String(value || '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{2,31}$/.test(username)) throw new Error('INVALID_USERNAME');
    return username;
}

export function assertPassword(password) {
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        throw new Error('INVALID_PASSWORD');
    }
}

export function hashPassword(password) {
    assertPassword(password);
    const salt = randomBytes(16);
    const hash = scryptSync(password, salt, PASSWORD_HASH_BYTES, {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: 32 * 1024 * 1024,
    });
    return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export function verifyPassword(password, encoded) {
    try {
        const [algorithm, n, r, p, saltText, hashText] = String(encoded || '').split('$');
        if (algorithm !== 'scrypt' || Number(n) !== SCRYPT_N || Number(r) !== SCRYPT_R || Number(p) !== SCRYPT_P) return false;
        const salt = Buffer.from(saltText, 'base64url');
        const expected = Buffer.from(hashText, 'base64url');
        const actual = scryptSync(password, salt, expected.length, {
            N: Number(n), r: Number(r), p: Number(p), maxmem: 32 * 1024 * 1024,
        });
        return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
        return false;
    }
}

export function createAccessToken(accountId, secret, ttlSeconds, now = Math.floor(Date.now() / 1000)) {
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = base64url(JSON.stringify({ sub: accountId, iat: now, exp: now + ttlSeconds }));
    const input = `${header}.${payload}`;
    return `${input}.${signJwt(input, secret)}`;
}

export function verifyAccessToken(token, secret, now = Math.floor(Date.now() / 1000)) {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) throw new Error('INVALID_TOKEN');
    const [header, payload, signature] = parts;
    const expected = signJwt(`${header}.${payload}`, secret);
    const left = Buffer.from(signature);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error('INVALID_TOKEN');
    const parsedHeader = JSON.parse(fromBase64url(header));
    const parsedPayload = JSON.parse(fromBase64url(payload));
    if (parsedHeader.alg !== 'HS256' || !parsedPayload.sub || !Number.isInteger(parsedPayload.exp) || parsedPayload.exp <= now) {
        throw new Error('INVALID_TOKEN');
    }
    return parsedPayload;
}

export function createRefreshToken() {
    return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token) {
    return createHmac('sha256', 'petbank-refresh-token-v1').update(String(token || '')).digest('hex');
}

export function createId() {
    return randomUUID();
}

export function createInviteCode() {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = randomBytes(8);
    return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

export function normalizeRegistrationCode(value) {
    return String(value || '').trim().toUpperCase().replace(/[\s-]/g, '');
}

export function hashRegistrationCode(value, secret) {
    const normalized = normalizeRegistrationCode(value);
    return createHmac('sha256', String(secret || 'petbank-registration-code-v1')).update(normalized).digest('hex');
}

export function registrationCodeHint(value) {
    const normalized = normalizeRegistrationCode(value);
    return normalized ? normalized.slice(-4) : '';
}
