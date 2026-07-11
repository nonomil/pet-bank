import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'petbank-pages-routes-'));
const expectedRoutes = [
    '/app',
    '/app/today',
    '/app/learn',
    '/app/pet',
    '/app/explore',
    '/app/playground',
    '/parent',
    '/parent/works',
    '/parent/tools',
    '/parent/settings',
    '/settings',
    '/settings/account',
    '/settings/family',
    '/settings/learning',
    '/settings/rules',
    '/settings/advanced',
];

function fail(message) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
}

try {
    execFileSync(process.execPath, ['scripts/assemble-pages-artifact.mjs', artifactDir], {
        cwd: repoRoot,
        stdio: 'pipe',
    });

    for (const route of expectedRoutes) {
        const entry = path.join(artifactDir, route.slice(1), 'index.html');
        if (!fs.existsSync(entry)) {
            fail(`${route} is missing a static entry page`);
            continue;
        }
        const source = fs.readFileSync(entry, 'utf8');
        if (!source.includes(`route=${encodeURIComponent(route)}`)) {
            fail(`${route} entry does not preserve its route query`);
        }
    }

    const appSource = fs.readFileSync(path.join(artifactDir, 'index.html'), 'utf8');
    if (!appSource.includes('routeBasePrefix')) {
        fail('index.html does not retain the GitHub Pages repository base when restoring route queries');
    }
} finally {
    fs.rmSync(artifactDir, { recursive: true, force: true });
}

if (process.exitCode) {
    process.exit(process.exitCode);
}

console.log(`PASS static route entries: ${expectedRoutes.length} routes`);
