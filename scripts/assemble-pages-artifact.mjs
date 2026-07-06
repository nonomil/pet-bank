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

function copyFile(fileName) {
    const src = path.join(repoRoot, fileName);
    const dest = path.join(outDir, fileName);
    if (!fs.existsSync(src)) {
        throw new Error(`Missing required file: ${fileName}`);
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

assertSafeOutput(outDir);
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

for (const fileName of ['index.html', 'admin.html', 'cloud-config.local.js']) {
    copyFile(fileName);
}

for (const dirName of ['css', 'js', 'assets', 'data']) {
    copyDir(dirName);
}

fs.writeFileSync(path.join(outDir, '.nojekyll'), '');

console.log(`[pages-artifact] assembled ${outDir}`);
