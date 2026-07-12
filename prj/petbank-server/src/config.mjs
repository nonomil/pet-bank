import path from 'node:path';

const MIN_JWT_SECRET_LENGTH = 32;

function parseBoolean(value, fallback) {
    if (value === undefined || value === '') return fallback;
    return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parsePositiveInteger(value, fallback, name) {
    const result = Number.parseInt(value ?? String(fallback), 10);
    if (!Number.isInteger(result) || result < 1) throw new Error(`${name} must be a positive integer.`);
    return result;
}

export function loadConfig(env = process.env) {
    const production = env.NODE_ENV === 'production';
    const dataDir = String(env.PETBANK_DATA_DIR || '').trim();
    const jwtSecret = String(env.PETBANK_JWT_SECRET || '').trim();

    if (production && !dataDir) {
        throw new Error('PETBANK_DATA_DIR is required in production and must point to the shared data directory.');
    }
    if (production && jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
        throw new Error(`PETBANK_JWT_SECRET must contain at least ${MIN_JWT_SECRET_LENGTH} characters in production.`);
    }

    const resolvedDataDir = dataDir || path.resolve(process.cwd(), 'var', 'data');
    const port = Number.parseInt(env.PORT || '3000', 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('PORT must be an integer between 1 and 65535.');
    }

    return {
        production,
        host: String(env.HOST || '127.0.0.1'),
        port,
        dataDir: resolvedDataDir,
        databasePath: path.join(resolvedDataDir, 'petbank.db'),
        jwtSecret,
        accessTokenTtlSeconds: parsePositiveInteger(env.PETBANK_ACCESS_TOKEN_TTL_SECONDS, 900, 'PETBANK_ACCESS_TOKEN_TTL_SECONDS'),
        refreshTokenTtlSeconds: parsePositiveInteger(env.PETBANK_REFRESH_TOKEN_TTL_SECONDS, 2_592_000, 'PETBANK_REFRESH_TOKEN_TTL_SECONDS'),
        enableRegistration: parseBoolean(env.PETBANK_ENABLE_REGISTRATION, true),
        allowedOrigin: String(env.PETBANK_ALLOWED_ORIGIN || '').trim(),
    };
}
