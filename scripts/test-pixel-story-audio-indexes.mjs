import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const storyRoot = path.join(repoRoot, 'data', 'story-packs', '05-pixel-worlds-story');
const source = JSON.parse(fs.readFileSync(path.join(storyRoot, 'audio-manifest.json'), 'utf8'));
const index = JSON.parse(fs.readFileSync(path.join(storyRoot, 'audio-index.json'), 'utf8'));
const sourceChapterIds = Object.keys(source.entries || {}).filter((id) => Array.isArray(source.entries[id]?.scenes));
assert.equal(index.id, 'pixel-worlds-story-audio-index');
assert.equal(index.chapterCount, sourceChapterIds.length);
assert.deepEqual(Object.keys(index.entries).sort(), sourceChapterIds.sort());
let lineCount = 0;
for (const [chapterId, metadata] of Object.entries(index.entries)) {
    const relative = metadata.path.replace(/^data\/story-packs\/05-pixel-worlds-story\//, '');
    const chapter = JSON.parse(fs.readFileSync(path.join(storyRoot, relative), 'utf8'));
    assert.equal(chapter.chapterId, chapterId);
    assert.ok(chapter.scenes.length > 0);
    const currentCount = chapter.scenes.reduce((sum, scene) => sum + scene.lines.length, 0);
    assert.equal(currentCount, metadata.lineCount);
    lineCount += currentCount;
    for (const scene of chapter.scenes) for (const line of scene.lines) assert.match(line.file, /\.wav$/);
}
assert.equal(lineCount, 880);
const engine = fs.readFileSync(path.join(repoRoot, 'js', 'pixel-story-engine.js'), 'utf8');
assert.match(engine, /audio-index\.json/);
assert.match(engine, /loadChapterAudioIndex/);
assert.match(engine, /pixelStoryAudioBaseUrl/);
console.log(`PASS pixel story audio indexes: chapters=${index.chapterCount} lines=${lineCount}`);
