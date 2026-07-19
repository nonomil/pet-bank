import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const storyRoot = path.join(repoRoot, 'data', 'story-packs', '05-pixel-worlds-story');
const sourcePath = path.join(storyRoot, 'audio-manifest.json');
const rootPath = path.join(storyRoot, 'audio-index.json');
const indexDir = path.join(storyRoot, 'audio-indexes');
const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

function writeJson(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

const entries = source.entries || {};
const rootEntries = {};
fs.rmSync(indexDir, { recursive: true, force: true });
for (const [chapterId, entry] of Object.entries(entries)) {
    if (!entry || !Array.isArray(entry.scenes)) continue;
    const chapterIndex = {
        version: 1,
        id: `pixel-worlds-story-audio-${chapterId}`,
        chapterId,
        audioFormat: 'wav',
        audioSubtype: 'source',
        scenes: entry.scenes.map((scene) => ({
            sceneId: scene.sceneId,
            lines: (scene.lines || []).map((line) => ({ file: line.file }))
        }))
    };
    const relativePath = `audio-indexes/${chapterId}.json`;
    writeJson(path.join(storyRoot, relativePath), chapterIndex);
    rootEntries[chapterId] = {
        path: `data/story-packs/05-pixel-worlds-story/${relativePath}`,
        sceneCount: chapterIndex.scenes.length,
        lineCount: chapterIndex.scenes.reduce((sum, scene) => sum + scene.lines.length, 0)
    };
}

writeJson(rootPath, {
    version: 1,
    id: 'pixel-worlds-story-audio-index',
    storyId: 'pixel-worlds-story',
    sourceManifest: 'data/story-packs/05-pixel-worlds-story/audio-manifest.json',
    chapterCount: Object.keys(rootEntries).length,
    entries: rootEntries
});
console.log(`[pixel-story-audio-indexes] chapters=${Object.keys(rootEntries).length} output=${rootPath}`);
