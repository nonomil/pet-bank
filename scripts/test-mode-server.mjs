#!/usr/bin/env node

// Local-only preview: it never starts the API or changes production auth.
process.env.PETBANK_TEST_MODE = '1';
process.env.PETBANK_HOST = '127.0.0.1';
process.env.PETBANK_PORT = process.env.PETBANK_TEST_PORT || '7001';
await import('./local-server.mjs');
