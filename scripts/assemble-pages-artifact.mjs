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

function isAllowedRuntimeRaster(rel) {
    if (ALLOWED_RASTER_EXACT.has(rel)) return true;
    if (rel.startsWith('assets/ui/hanzi-img/') && rel.endsWith('.png')) return true;
    if (rel.startsWith('assets/learn/') && rel.endsWith('.png')) return true;
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

function copyOptionalCloudConfigStub(fileName) {
    const src = path.join(repoRoot, fileName);
    const dest = path.join(outDir, fileName);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        return;
    }
    fs.writeFileSync(dest, [
        'window.__PETBANK_CLOUD_CONFIG__ = window.__PETBANK_CLOUD_CONFIG__ || {',
        "    supabaseUrl: '',",
        "    supabaseAnonKey: '',",
        "    siteUrl: ''",
        '};',
        '',
    ].join('\n'));
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
    const allowedPrefixes = [
        'assets/generated',
    ];
    if (!includeWhenAnyDescendantMatches(rel, exactFiles, allowedPrefixes)) {
        return false;
    }
    if (isDirectChildOf('assets/generated/reference', rel)) {
        return isDirectChildOf('assets/generated/reference/pinyin-racer-long-track-strip', rel)
            || isDirectChildOf('assets/generated/reference/pinyin-racer-long-track-skybridge', rel);
    }
    return !rel.endsWith('.md');
}

function includeTypingDefenseRuntime(rel) {
    const exactFiles = new Set([
        'web/index.html',
        'web/styles.css',
        'web/game.js',
        'assets/creeper-bow-scene-chatgpt-raw.png',
    ]);
    const allowedPrefixes = [
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
        'assets/stage-background.png',
        'assets/generated/reference/topdown-clean-bg-chatgpt.png',
    ]);
    const allowedPrefixes = [
        'assets/voice',
        'assets/generated/hero-boy-assets',
        'assets/generated/topdown-farm-assets',
        'assets/generated/world-bg-tiles',
        'assets/背景图片',
        'assets/MineCraft宠物图片/poses',
    ];
    return includeWhenAnyDescendantMatches(rel, exactFiles, allowedPrefixes);
}

assertSafeOutput(outDir);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const fileName of ['index.html', 'admin.html']) {
    copyFile(fileName);
}
copyOptionalCloudConfigStub('cloud-config.local.js');
copyFile('index.html', '404.html');

for (const dirName of ['css', 'js', 'assets', 'data', 'app']) {
    copyDir(dirName);
}

copyDirWithFilter('prj/学习机玩法原型', includeLearningArcadeRuntime);
copyDirWithFilter('prj/消灭苦力怕打字游戏', includeTypingDefenseRuntime);
copyDirWithFilter('prj/单词记忆射击场原型', includeWordMemoryRuntime);

fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

console.log(`[pages-artifact] assembled ${outDir}`);
