import path from 'node:path';

const MIN_JWT_SECRET_LENGTH = 32;

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
    };
}
