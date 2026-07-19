import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const sourceDir = path.join(repoRoot, 'assets', 'story', 'pixel-worlds-v1', 'audio');
const outputDir = path.resolve(repoRoot, process.argv[2] || 'tmp/pixel-story-audio-artifact');
const releaseId = String(process.argv[3] || '').trim() || 'v20260719';

function toPosix(value) { return value.split(path.sep).join('/'); }
function walk(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const target = path.join(dir, entry.name);
        if (entry.isDirectory()) files.push(...walk(target));
        else if (entry.isFile()) files.push(target);
    }
    return files.sort();
}
function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

const sources = walk(sourceDir).filter((file) => file.endsWith('.ogg'));
if (sources.length !== 960) throw new Error(`Expected 960 Pixel Story OGG sources, found ${sources.length}`);
fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
const files = [];
for (const source of sources) {
    const relative = toPosix(path.relative(sourceDir, source));
    const target = path.join(outputDir, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    files.push({ path: relative, bytes: fs.statSync(source).size });
}
writeJson(path.join(outputDir, 'manifest.json'), {
    version: 1,
    id: 'pixel-worlds-story-audio',
    releaseId,
    format: 'OGG',
    subtype: 'OPUS',
    clipCount: files.length,
    files
});
console.log(`[pixel-story-audio-artifact] release=${releaseId} clips=${files.length} output=${outputDir}`);
