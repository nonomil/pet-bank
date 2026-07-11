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
const playgroundCardAssets = [
    'pg-card-mathpk.webp',
    'pg-card-hanzi.webp',
    'pg-card-arena.webp',
    'pg-card-typing-defense.webp',
    'pg-card-word-shooter.webp',
    'pg-card-word-cannon.webp',
    'pg-card-pinyin-snake.webp',
    'pg-card-word-memory.webp',
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
    if (appSource.includes('src="assets/pets/poses/dog_idle.webp"')) {
        fail('index.html must not preload the default pet image with a deep-route-relative src');
    }
    if (/assets\/ui\/pg-card-[^"']+\.png/i.test(appSource)) {
        fail('index.html still references a PNG playground card that Pages excludes from the artifact');
    }
    for (const name of playgroundCardAssets) {
        const assetPath = path.join(artifactDir, 'assets', 'ui', name);
        if (!fs.existsSync(assetPath)) {
            fail(`playground card ${name} is missing from the Pages artifact`);
            continue;
        }
        if (fs.statSync(assetPath).size > 250 * 1024) {
            fail(`playground card ${name} exceeds the 250KB publish budget`);
        }
    }
    if (!appSource.includes('<base id="routeBase" href="./">')) {
        fail('index.html must use a relative initial route base before the browser preloads assets');
    }
    if (!appSource.includes('routeBasePrefix')) {
        fail('index.html does not retain the GitHub Pages repository base when restoring route queries');
    }

    const typingDefenseSource = fs.readFileSync(path.join(artifactDir, 'app', 'playground', 'typing-defense-runtime', 'web', 'game.js'), 'utf8');
    if (/["']\.\.\/\.\.\/\.\.\/assets\/learn\/english-vocab\/minecraft-card\.webp/.test(typingDefenseSource)) {
        fail('typing defense fallback image does not climb out of the nested runtime path');
    }
} finally {
    fs.rmSync(artifactDir, { recursive: true, force: true });
}

if (process.exitCode) {
    process.exit(process.exitCode);
}

console.log(`PASS static route entries: ${expectedRoutes.length} routes`);
