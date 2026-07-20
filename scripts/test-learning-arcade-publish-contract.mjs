import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const manifestPath = path.join(repoRoot, 'scripts', 'runtime-asset-manifests', 'learning-arcade.json');
const artifactArg = process.argv[2];
const artifactRoot = artifactArg ? path.resolve(repoRoot, artifactArg) : null;

function fail(message) {
    console.error(`FAIL learning arcade publish contract: ${message}`);
    process.exitCode = 1;
}

function assertRelativePath(value, label) {
    assert.equal(typeof value, 'string', `${label} must be a string`);
    assert.ok(value && !value.startsWith('/') && !value.includes('..'), `${label} must stay inside the package`);
}

if (!fs.existsSync(manifestPath)) {
    fail(`missing manifest: ${path.relative(repoRoot, manifestPath)}`);
    process.exit(process.exitCode);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.equal(manifest.version, 1, 'manifest version must be 1');
assert.equal(manifest.packageRoot, 'prj/学习机玩法原型', 'manifest must identify the learning arcade package');
assert.ok(Array.isArray(manifest.runtimeFiles) && manifest.runtimeFiles.length > 0, 'runtimeFiles must not be empty');
assert.ok(Array.isArray(manifest.runtimePrefixes) && manifest.runtimePrefixes.length > 0, 'runtimePrefixes must not be empty');
assert.ok(Array.isArray(manifest.excludedPrefixes) && manifest.excludedPrefixes.length > 0, 'excludedPrefixes must not be empty');

for (const file of manifest.runtimeFiles) assertRelativePath(file, 'runtime file');
for (const prefix of [...manifest.runtimePrefixes, ...manifest.excludedPrefixes]) {
    assertRelativePath(prefix, 'runtime prefix');
}

assert.ok(
    manifest.excludedPrefixes.includes('assets/generated/pinyin-racer-prepared-assets'),
    'prepared pinyin-racer library must be explicitly excluded'
);
assert.ok(
    manifest.runtimeFiles.includes('assets/拼音赛车/拼音赛车参考图-01-彩色卡通赛车道.webp'),
    'the selected pinyin-racer background must be published from the runtime map set'
);
assert.ok(
    manifest.runtimeFiles.includes('assets/generated/english-typing-index.json'),
    'the HTTP runtime must publish the typing vocab index'
);
assert.ok(
    manifest.excludedPrefixes.includes('assets/generated/minecraft-typing-expanded.json'),
    'the source-only Minecraft typing JSON must be explicitly excluded from Pages'
);
assert.ok(
    !manifest.runtimeFiles.includes('assets/generated/minecraft-typing-expanded.json'),
    'the source-only Minecraft typing JSON must not be listed as an HTTP runtime file'
);
assert.ok(
    manifest.runtimeFiles.includes('assets/generated/hanzi-pinyin-runtime.json'),
    'the HTTP runtime must publish the hanzi and pinyin runtime JSON'
);
for (const webpFile of [
    'assets/generated/pinyin-racer-reference-bg.webp',
    'assets/拼音赛车/拼音赛车参考图-01-彩色卡通赛车道.webp',
    'assets/拼音赛车/拼音赛车参考图-02-漂浮天空赛道.webp',
    'assets/拼音赛车/拼音赛车参考图-03--玩具森林赛道png.webp',
    'assets/拼音赛车/拼音赛车参考图-04-梦幻通话赛道.webp',
    'assets/拼音赛车/拼音赛车参考图-05--赛道终点.webp'
]) {
    assert.ok(manifest.runtimeFiles.includes(webpFile), `learning arcade should publish WebP runtime image: ${webpFile}`);
}
for (const webpFile of [
    'assets/generated/home-card-word-shooter.webp',
    'assets/generated/home-card-word-cannon.webp',
    'assets/generated/home-card-pinyin-snake.webp',
    'assets/generated/learning-arcade-stage.webp'
]) {
    assert.ok(manifest.runtimeFiles.includes(webpFile), `learning arcade should publish WebP portal image: ${webpFile}`);
}
for (const sourceFile of [
    'assets/generated/pinyin-racer-reference-bg.png',
    'assets/拼音赛车/拼音赛车参考图-01-彩色卡通赛车道.png',
    'assets/拼音赛车/拼音赛车参考图-02-漂浮天空赛道.png',
    'assets/拼音赛车/拼音赛车参考图-03--玩具森林赛道png.png',
    'assets/拼音赛车/拼音赛车参考图-04-梦幻通话赛道.png',
    'assets/拼音赛车/拼音赛车参考图-05--赛道终点.png'
]) {
    assert.ok(!manifest.runtimeFiles.includes(sourceFile), `source PNG must stay out of Pages runtime manifest: ${sourceFile}`);
}
for (const sourceFile of [
    'assets/generated/home-card-word-shooter.png',
    'assets/generated/home-card-word-cannon.png',
    'assets/generated/home-card-pinyin-snake.png',
    'assets/generated/learning-arcade-stage.png'
]) {
    assert.ok(!manifest.runtimeFiles.includes(sourceFile), `learning arcade portal source PNG must stay out of Pages runtime manifest: ${sourceFile}`);
}
for (const fallbackFile of [
    'assets/generated/english-typing-unified.js',
    'assets/generated/minecraft-typing-expanded.js'
]) {
    assert.ok(
        !manifest.runtimeFiles.includes(fallbackFile),
        `file:// fallback script must stay out of the Pages runtime manifest: ${fallbackFile}`
    );
}

for (const sourceOnlyFile of [
    'assets/generated/minecraft-typing-expanded.json'
]) {
    assert.ok(
        fs.existsSync(path.join(repoRoot, manifest.packageRoot, sourceOnlyFile)),
        `source-only learning arcade data must remain available: ${sourceOnlyFile}`
    );
}

for (const file of manifest.runtimeFiles) {
    assert.ok(
        fs.existsSync(path.join(repoRoot, manifest.packageRoot, file)),
        `missing source runtime file: ${file}`
    );
}

if (artifactRoot) {
    assert.ok(fs.existsSync(artifactRoot), `missing artifact: ${artifactArg}`);
    const publishedGamePath = path.join(artifactRoot, manifest.packageRoot, 'game.js');
    const publishedGame = fs.readFileSync(publishedGamePath, 'utf8');
    const publishedIndex = fs.readFileSync(path.join(artifactRoot, manifest.packageRoot, 'index.html'), 'utf8');
    const publishedStyles = fs.readFileSync(path.join(artifactRoot, manifest.packageRoot, 'styles.css'), 'utf8');
    for (const filename of [
        '拼音赛车参考图-01-彩色卡通赛车道',
        '拼音赛车参考图-02-漂浮天空赛道',
        '拼音赛车参考图-03--玩具森林赛道png',
        '拼音赛车参考图-04-梦幻通话赛道',
        '拼音赛车参考图-05--赛道终点'
    ]) {
        assert.ok(
            publishedGame.includes(`${filename}.webp`),
            `published learning arcade game must reference the WebP racer background: ${filename}`
        );
        assert.ok(
            !publishedGame.includes(`${filename}.png`),
            `published learning arcade game must not reference the PNG racer background: ${filename}`
        );
    }
    for (const filename of [
        'home-card-word-shooter',
        'home-card-word-cannon',
        'home-card-pinyin-snake',
        'learning-arcade-stage'
    ]) {
        assert.ok(
            publishedGame.includes(`${filename}.webp`)
                || publishedIndex.includes(`${filename}.webp`)
                || publishedStyles.includes(`${filename}.webp`),
            `published learning arcade must reference the WebP portal image: ${filename}`
        );
        assert.ok(
            !publishedGame.includes(`${filename}.png`)
                && !publishedIndex.includes(`${filename}.png`)
                && !publishedStyles.includes(`${filename}.png`),
            `published learning arcade must not reference the PNG portal image: ${filename}`
        );
    }
    const publishedFiles = [];
    const stack = [artifactRoot];
    while (stack.length) {
        const current = stack.pop();
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const absolute = path.join(current, entry.name);
            if (entry.isDirectory()) stack.push(absolute);
            else publishedFiles.push(path.relative(artifactRoot, absolute).split(path.sep).join('/'));
        }
    }

    for (const file of manifest.runtimeFiles) {
        assert.ok(publishedFiles.includes(`${manifest.packageRoot}/${file}`), `missing published runtime file: ${file}`);
    }
    for (const sourceFile of [
        'assets/generated/home-card-word-shooter.png',
        'assets/generated/home-card-word-cannon.png',
        'assets/generated/home-card-pinyin-snake.png',
        'assets/generated/learning-arcade-stage.png'
    ]) {
        assert.ok(!publishedFiles.includes(`${manifest.packageRoot}/${sourceFile}`), `portal source PNG leaked: ${sourceFile}`);
    }
    for (const sourceOnlyFile of [
        'assets/generated/minecraft-typing-expanded.json'
    ]) {
        assert.ok(
            !publishedFiles.includes(`${manifest.packageRoot}/${sourceOnlyFile}`),
            `source-only learning arcade data leaked: ${sourceOnlyFile}`
        );
    }
    for (const prefix of manifest.excludedPrefixes) {
        const leaked = publishedFiles.filter((file) =>
            file === `${manifest.packageRoot}/${prefix}` || file.startsWith(`${manifest.packageRoot}/${prefix}/`)
        );
        assert.equal(leaked.length, 0, `excluded learning arcade assets leaked: ${prefix}`);
    }

    for (const prefix of manifest.runtimePrefixes) {
        assert.ok(
            publishedFiles.some((file) => file.startsWith(`${manifest.packageRoot}/${prefix}/`)),
            `runtime prefix is empty in artifact: ${prefix}`
        );
    }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(artifactRoot
    ? `PASS learning arcade publish contract: ${path.relative(repoRoot, artifactRoot)}`
    : 'PASS learning arcade publish manifest contract');
