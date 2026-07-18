import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { loadConfig } from '../src/config.mjs';

test('loadConfig keeps database data outside the release directory', () => {
    const config = loadConfig({
        NODE_ENV: 'production',
        PETBANK_DATA_DIR: '/srv/pet-bank/shared/data',
        PETBANK_JWT_SECRET: 'test-secret-with-more-than-thirty-two-characters',
    });

    assert.equal(config.dataDir, '/srv/pet-bank/shared/data');
    assert.equal(config.databasePath, path.join('/srv/pet-bank/shared/data', 'petbank.db'));
});

test('loadConfig rejects production startup without a persistent data directory', () => {
    assert.throws(
        () => loadConfig({ NODE_ENV: 'production', PETBANK_JWT_SECRET: 'test-secret-with-more-than-thirty-two-characters' }),
        /PETBANK_DATA_DIR/,
    );
});

test('production config requires registration codes by default', () => {
    const config = loadConfig({
        NODE_ENV: 'production',
        PETBANK_DATA_DIR: '/srv/pet-bank/shared/data',
        PETBANK_JWT_SECRET: 'test-secret-with-more-than-thirty-two-characters',
    });

    assert.equal(config.requireRegistrationCode, true);
});
