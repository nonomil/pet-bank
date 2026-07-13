import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = process.cwd();
const artifactDir = fs.mkdtempSync(path.join(os.tmpdir(), 'petbank-pages-routes-'));
const expectedRoutes = [
    '/app',
    '/app/today',
    '/app/today/learning-sheet',
    '/app/today/review',
    '/app/today/reward',
    '/app/today/shop',
    '/app/today/inventory',
    '/app/learn',
    '/app/learn/pack',
    '/app/learn/plan',
    '/app/learn/lesson',
    '/app/learn/print',
    '/app/learn/minecraft-vocab',
    '/app/pet',
    '/app/pet/home',
    '/app/pet/walk',
    '/app/pet/cards',
    '/app/explore',
    '/app/playground',
    '/app/playground/math-pk',
    '/app/playground/hanzi',
    '/app/playground/typing-defense',
    '/app/playground/learning-arcade',
    '/app/playground/word-memory-map',
    '/app/playground/leaderboard',
    '/parent',
    '/parent/works',
    '/parent/tools',
    '/parent/settings',
    '/parent/settings/account',
    '/parent/settings/family',
    '/parent/settings/learning',
    '/parent/settings/rules',
    '/parent/settings/advanced',
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
    if (!typingDefenseSource.includes('const BASE_WORD_TASKS = TASK_BANKS.words.map')) {
        fail('typing defense initial word tasks do not normalize their nested image paths');
    }
    if (fs.existsSync(path.join(artifactDir, 'prj', '消灭苦力怕打字游戏'))) {
        fail('typing defense development prototype must not be duplicated in the Pages artifact');
    }
    for (const runtimePath of [
        ['prj', '学习机玩法原型', 'index.html'],
        ['prj', '单词记忆射击场原型', 'index.html'],
    ]) {
        if (!fs.existsSync(path.join(artifactDir, ...runtimePath))) {
            fail(`embedded game runtime is missing from the Pages artifact: ${runtimePath.join('/')}`);
        }
    }

    const farmPanorama = path.join(artifactDir, 'prj', '单词记忆射击场原型', 'assets', 'generated', 'world-bg-single', 'farm-gpt-panorama.png');
    if (!fs.existsSync(farmPanorama)) {
        fail('word memory default farm panorama is missing from the Pages artifact');
    }
    for (const excludedPanorama of ['farm-panorama.png', 'space-panorama.png']) {
        if (fs.existsSync(path.join(path.dirname(farmPanorama), excludedPanorama))) {
            fail(`word memory optional panorama ${excludedPanorama} exceeds the Pages artifact budget`);
        }
    }
    const wordMemoryJson = fs.readFileSync(path.join(artifactDir, 'prj', '单词记忆射击场原型', 'assets', 'word-memory-cards.json'), 'utf8');
    const wordMemoryFallback = fs.readFileSync(path.join(artifactDir, 'prj', '单词记忆射击场原型', 'assets', 'word-memory-cards.js'), 'utf8');
    const coreVocabViewPath = path.join(artifactDir, 'data', 'vocab', 'core-english', 'views', 'core.json');
    const coreVocabDbPath = path.join(artifactDir, 'data', 'vocab', 'core-english', 'core-english.db');
    const coreWordMemoryPath = path.join(artifactDir, 'prj', '单词记忆射击场原型', 'assets', 'word-memory-core-cards.json');
    const extensionVocabViewPath = path.join(artifactDir, 'data', 'vocab', 'extension-english', 'views', 'extension.json');
    const extensionVocabDbPath = path.join(artifactDir, 'data', 'vocab', 'extension-english', 'extension-english.db');
    const extensionWordMemoryPath = path.join(artifactDir, 'prj', '单词记忆射击场原型', 'assets', 'word-memory-extension-cards.json');
    if (/https:\/\/images\.unsplash\.com\/[^"'\s]*\?[^"'\s]*\?/.test(wordMemoryJson)) {
        fail('word memory artifact still contains malformed Unsplash image URLs');
    }
    if (/https:\/\/images\.unsplash\.com\/[^"'\s]*\?[^"'\s]*\?/.test(wordMemoryFallback)) {
        fail('word memory fallback artifact still contains malformed Unsplash image URLs');
    }
    if (!fs.existsSync(coreVocabViewPath) || !fs.existsSync(coreVocabDbPath) || !fs.existsSync(coreWordMemoryPath)) {
        fail('core English vocabulary database, view, or word-memory adapter is missing from the Pages artifact');
    }
    const coreView = JSON.parse(fs.readFileSync(coreVocabViewPath, 'utf8'));
    const coreCards = JSON.parse(fs.readFileSync(coreWordMemoryPath, 'utf8'));
    if (coreView.cards.length < 100 || coreCards.cards.length !== coreView.cards.length) {
        fail('core English runtime card count is invalid in the Pages artifact');
    }
    if (coreCards.cards.some((card) => !card.word || !card.translation || !card.enemyImage || !card.enemyFallbackImage)) {
        fail('core English runtime cards must preserve text and image fallbacks');
    }
    if (!fs.existsSync(extensionVocabViewPath) || !fs.existsSync(extensionVocabDbPath) || !fs.existsSync(extensionWordMemoryPath)) {
        fail('extension English vocabulary database, view, or word-memory adapter is missing from the Pages artifact');
    }
    const extensionView = JSON.parse(fs.readFileSync(extensionVocabViewPath, 'utf8'));
    const extensionCards = JSON.parse(fs.readFileSync(extensionWordMemoryPath, 'utf8'));
    if (extensionView.cards.length < 30 || extensionCards.cards.length !== extensionView.cards.length) {
        fail('extension English runtime card count is invalid in the Pages artifact');
    }
} finally {
    fs.rmSync(artifactDir, { recursive: true, force: true });
}

if (process.exitCode) {
    process.exit(process.exitCode);
}

console.log(`PASS static route entries: ${expectedRoutes.length} routes`);
