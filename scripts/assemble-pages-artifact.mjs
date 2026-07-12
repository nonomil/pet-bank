import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const outArg = process.argv[2] || '_site';
const outDir = path.resolve(repoRoot, outArg);

function toPosix(filePath) {
    return filePath.split(path.sep).join('/');
}

function relativeToRoot(filePath) {
    return toPosix(path.relative(repoRoot, filePath));
}

function assertSafeOutput(targetDir) {
    if (targetDir === repoRoot) {
        throw new Error('Refusing to assemble Pages artifact into the repository root.');
    }
    const relative = path.relative(repoRoot, targetDir);
    if (!relative || relative === '.') {
        throw new Error('Refusing to use an empty artifact output path.');
    }
}

const EXCLUDED_PREFIXES = [
    'assets/voice',
    'assets/pets/originals',
    'assets/pets/poses-originals',
    'assets/pets-originals',
    'assets/references',
    'data/source-snapshots',
    'data/GPT生图',
];

const ALLOWED_RASTER_EXACT = new Set([
    'assets/arena/arena-1.png',
    'assets/arena/arena-2.png',
    'assets/arena/arena-3.png',
    'assets/arena/arena-4.png',
    'assets/arena/arena-5.png',
    'assets/arena/training-bg-1.png',
    'assets/arena/training-bg-2.png',
    'assets/arena/training-bg-3.png',
    'assets/arena/training-bg-4.png',
    'assets/arena/training-bg-5.png',
    'assets/arena/human-kid.png',
    'assets/arena/robot-rival.png',
]);

const RASTER_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.bmp']);
const TRAVEL_MEMORY_RUNTIME_PREFIXES = [
    'assets/generated/travel-memory/badges/',
    'assets/generated/travel-memory/cards/',
    'assets/generated/travel-memory/fridge-magnets/',
    'assets/generated/travel-memory/pet-cards/',
];

function isAllowedRuntimeRaster(rel) {
    if (ALLOWED_RASTER_EXACT.has(rel)) return true;
    if (rel.startsWith('assets/ui/hanzi-img/') && rel.endsWith('.png')) return true;
    if (rel.startsWith('assets/learn/') && rel.endsWith('.png')) return true;
    if (TRAVEL_MEMORY_RUNTIME_PREFIXES.some((prefix) => rel.startsWith(prefix) && rel.endsWith('.png'))) return true;
    return false;
}

function shouldExclude(src) {
    const rel = relativeToRoot(src);
    if (!rel || rel.startsWith('..')) return false;
    if (rel.endsWith('.bak')) return true;
    if (EXCLUDED_PREFIXES.some((prefix) => rel === prefix || rel.startsWith(`${prefix}/`))) {
        return true;
    }

    const extension = path.extname(rel).toLowerCase();
    if (RASTER_EXTENSIONS.has(extension)) {
        return !isAllowedRuntimeRaster(rel);
    }

    return false;
}

function copyFile(fileName, destName = fileName) {
    const src = path.join(repoRoot, fileName);
    const dest = path.join(outDir, destName);
    if (!fs.existsSync(src)) {
        throw new Error(`Missing required file: ${fileName}`);
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

function copyMappedFile(srcName, destName) {
    const src = path.join(repoRoot, srcName);
    const dest = path.join(outDir, destName);
    if (!fs.existsSync(src)) {
        throw new Error(`Missing required file: ${srcName}`);
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
}

function copyDir(dirName) {
    const src = path.join(repoRoot, dirName);
    const dest = path.join(outDir, dirName);
    if (!fs.existsSync(src)) {
        throw new Error(`Missing required directory: ${dirName}`);
    }
    fs.cpSync(src, dest, {
        recursive: true,
        filter(srcPath) {
            return !shouldExclude(srcPath);
        },
    });
}

function copyDirWithFilter(dirName, includeRelativePath) {
    const src = path.join(repoRoot, dirName);
    const dest = path.join(outDir, dirName);
    if (!fs.existsSync(src)) {
        throw new Error(`Missing required directory: ${dirName}`);
    }
    fs.cpSync(src, dest, {
        recursive: true,
        filter(srcPath) {
            const rel = toPosix(path.relative(src, srcPath));
            if (!rel || rel === '.') return true;
            return includeRelativePath(rel);
        },
    });
}

function copyDirWithFilterTo(srcName, destName, includeRelativePath) {
    const src = path.join(repoRoot, srcName);
    const dest = path.join(outDir, destName);
    if (!fs.existsSync(src)) {
        throw new Error(`Missing required directory: ${srcName}`);
    }
    fs.cpSync(src, dest, {
        recursive: true,
        filter(srcPath) {
            const rel = toPosix(path.relative(src, srcPath));
            if (!rel || rel === '.') return true;
            return includeRelativePath(rel);
        },
    });
}

function normalizePublishedWordMemoryImageUrl(value) {
    const source = String(value || '').trim();
    if (!/^https:\/\/images\.unsplash\.com\//i.test(source)) return source;
    const firstQuestion = source.indexOf('?');
    const secondQuestion = firstQuestion < 0 ? -1 : source.indexOf('?', firstQuestion + 1);
    if (secondQuestion < 0) return source;
    return `${source.slice(0, secondQuestion)}&${source.slice(secondQuestion + 1)}`;
}

function sanitizePublishedWordMemoryCards() {
    const assetDir = path.join(outDir, 'prj', '单词记忆射击场原型', 'assets');
    const jsonPath = path.join(assetDir, 'word-memory-cards.json');
    const fallbackPath = path.join(assetDir, 'word-memory-cards.js');
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    let normalizedCount = 0;

    for (const card of raw.cards || []) {
        const normalized = normalizePublishedWordMemoryImageUrl(card.enemyImage);
        if (normalized !== card.enemyImage) {
            card.enemyImage = normalized;
            normalizedCount += 1;
        }
    }

    fs.writeFileSync(jsonPath, `${JSON.stringify(raw, null, 2)}\n`);
    const fallback = fs.readFileSync(fallbackPath, 'utf8');
    const assignment = 'window.WORD_MEMORY_CARDS_DATA = ';
    if (!fallback.startsWith(assignment) || !fallback.trimEnd().endsWith(';')) {
        throw new Error('Unexpected word-memory fallback card data format.');
    }
    fs.writeFileSync(fallbackPath, `${assignment}${JSON.stringify(raw, null, 2)};\n`);
    console.log(`[pages-artifact] normalized ${normalizedCount} malformed word-memory remote image URLs`);
}

const STATIC_ROUTE_ENTRIES = [
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

function writeStaticRouteEntry(route) {
    const segments = route.split('/').filter(Boolean);
    const relativeIndex = `${'../'.repeat(segments.length)}index.html`;
    const encodedRoute = encodeURIComponent(route);
    const entryPath = path.join(outDir, ...segments, 'index.html');
    const title = `正在打开 ${route}...`;
    const source = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta http-equiv="refresh" content="0; url=${relativeIndex}?route=${encodedRoute}">
    <script>
        (function () {
            var params = new URLSearchParams(window.location.search);
            params.set('route', '${route}');
            var nextUrl = '${relativeIndex}?' + params.toString();
            if (window.location.hash) nextUrl += window.location.hash;
            window.location.replace(nextUrl);
        })();
    </script>
</head>
<body><p>${title}</p></body>
</html>
`;
    fs.mkdirSync(path.dirname(entryPath), { recursive: true });
    fs.writeFileSync(entryPath, source);
}

function isDirectChildOf(parent, target) {
    return target === parent || target.startsWith(`${parent}/`);
}

function includeWhenAnyDescendantMatches(rel, exactFiles, allowedPrefixes) {
    if (exactFiles.has(rel)) return true;
    for (const prefix of allowedPrefixes) {
        if (isDirectChildOf(prefix, rel) || isDirectChildOf(rel, prefix)) {
            return true;
        }
    }
    return false;
}

function includeLearningArcadeRuntime(rel) {
    const exactFiles = new Set([
        'index.html',
        'styles.css',
        'game.js',
    ]);
    const allowedReferencePrefixes = [
        'assets/generated/reference/pinyin-racer-long-track-strip',
        'assets/generated/reference/pinyin-racer-long-track-skybridge',
        'assets/generated/reference/word-shooter-levels-gpt-20260711/agnes-20260712/dawn-training-ground-clean',
        'assets/generated/reference/word-shooter-levels-gpt-20260711/agnes-20260712/candy-nebula-clean',
        'assets/generated/reference/word-shooter-levels-gpt-20260711/agnes-20260712/volcanic-meteor-belt-clean',
    ];
    const allowedPrefixes = [
        'assets/generated',
    ];
    if (!includeWhenAnyDescendantMatches(rel, exactFiles, allowedPrefixes)) {
        return false;
    }
    if (isDirectChildOf('assets/generated/reference', rel)) {
        return allowedReferencePrefixes.some((prefix) =>
            isDirectChildOf(prefix, rel) || isDirectChildOf(rel, prefix)
        );
    }
    return !rel.endsWith('.md');
}

function includeTypingDefenseRuntime(rel) {
    const exactFiles = new Set([
        'assets/creeper-bow-scene-chatgpt-raw.png',
    ]);
    const allowedPrefixes = [
        'web',
        'assets/generated/audio',
        'assets/generated/minecraft-typing-defense',
        'assets/generated/typing-defense-assets',
        'assets/generated/word-cards',
    ];
    return includeWhenAnyDescendantMatches(rel, exactFiles, allowedPrefixes);
}

function includeWordMemoryRuntime(rel) {
    const exactFiles = new Set([
        'index.html',
        'styles.css',
        'game.js',
        'assets/word-memory-cards.js',
        'assets/word-memory-cards.json',
        'assets/word-memory-core-cards.js',
        'assets/word-memory-core-cards.json',
        'assets/word-memory-extension-cards.js',
        'assets/word-memory-extension-cards.json',
        'assets/stage-background.png',
        'assets/generated/reference/topdown-clean-bg-chatgpt.png',
        'assets/generated/world-bg-single/farm-gpt-panorama.png',
    ]);
    const allowedPrefixes = [
        'assets/voice',
        'assets/generated/hero-boy-assets',
        'assets/generated/topdown-farm-assets',
        'assets/generated/level-theme-assets/forest',
        'assets/generated/level-theme-assets/ocean',
        'assets/generated/world-bg-tiles',
        'assets/背景图片',
        'assets/MineCraft宠物图片/poses',
    ];
    if (exactFiles.has(rel) || [...exactFiles].some((filePath) => filePath.startsWith(`${rel}/`))) {
        return true;
    }
    return includeWhenAnyDescendantMatches(rel, exactFiles, allowedPrefixes);
}

assertSafeOutput(outDir);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

copyFile('index.html');
copyFile('index.html', '404.html');

for (const dirName of ['css', 'js', 'assets', 'data', 'app']) {
    copyDir(dirName);
}

copyDirWithFilter('prj/学习机玩法原型', includeLearningArcadeRuntime);
copyDirWithFilterTo(
    'prj/拼音块收集台原型',
    'prj/拼音块收集台原型',
    (rel) => rel === 'assets' || rel === 'assets/voice' || rel.startsWith('assets/voice/')
);
copyDirWithFilter('prj/单词记忆射击场原型', includeWordMemoryRuntime);
copyDirWithFilterTo('prj/消灭苦力怕打字游戏', 'app/playground/typing-defense-runtime', includeTypingDefenseRuntime);
sanitizePublishedWordMemoryCards();

for (const route of STATIC_ROUTE_ENTRIES) {
    writeStaticRouteEntry(route);
}

fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

console.log(`[pages-artifact] assembled ${outDir}`);
